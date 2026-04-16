import { Err, Ok, type Result } from "../lib/result";
import type { IEventRepository, IRSVPRepository } from "../repository/EventRepository";

export type DashboardRsvpEntry = {
  rsvpId: number;
  rsvpStatus: "going" | "waitlisted" | "cancelled";
  rsvpedAt: Date;
  event: {
    id: number;
    title: string;
    description: string;
    location: string;
    category: string;
    status: "draft" | "published" | "cancelled" | "past";
    startDateTime: Date;
    endDateTime: Date;
  };
};

export type MemberRsvpsDashboard = {
  upcoming: DashboardRsvpEntry[];
  history: DashboardRsvpEntry[];
};

export type MemberRsvpsDashboardError =
  | {
      name: "UnexpectedDependencyError";
      message: string;
    }
  | {
      name: "ValidationError";
      message: string;
    }
  | {
      name: "RSVPNotFound";
      message: string;
    }
  | {
      name: "InvalidRSVPState";
      message: string;
    };

export interface IMemberRsvpsDashboardService {
  getMemberRsvpsDashboard(
    userId: string,
  ): Promise<Result<MemberRsvpsDashboard, MemberRsvpsDashboardError>>;
  cancelUpcomingRsvp(
    userId: string,
    eventId: number,
  ): Promise<Result<DashboardRsvpEntry, MemberRsvpsDashboardError>>;
}

function ValidationError(message: string): MemberRsvpsDashboardError {
  return { name: "ValidationError", message };
}

function RSVPNotFound(message: string): MemberRsvpsDashboardError {
  return { name: "RSVPNotFound", message };
}

function InvalidRSVPState(message: string): MemberRsvpsDashboardError {
  return { name: "InvalidRSVPState", message };
}

function UnexpectedDependencyError(message: string): MemberRsvpsDashboardError {
  return { name: "UnexpectedDependencyError", message };
}

class InMemoryMemberRsvpsDashboardService implements IMemberRsvpsDashboardService {
  constructor(
    private readonly events: IEventRepository,
    private readonly rsvps: IRSVPRepository,
  ) {}

  private isHistoryEntry(entry: DashboardRsvpEntry): boolean {
    return (
      entry.rsvpStatus === "cancelled" ||
      entry.event.status === "cancelled" ||
      entry.event.status === "past"
    );
  }

  private sortUpcoming(entries: DashboardRsvpEntry[]): DashboardRsvpEntry[] {
    return [...entries].sort((left, right) => {
      const byStart = left.event.startDateTime.getTime() - right.event.startDateTime.getTime();
      if (byStart !== 0) {
        return byStart;
      }
      return left.rsvpedAt.getTime() - right.rsvpedAt.getTime();
    });
  }

  private sortHistory(entries: DashboardRsvpEntry[]): DashboardRsvpEntry[] {
    return [...entries].sort((left, right) => {
      const byStart = right.event.startDateTime.getTime() - left.event.startDateTime.getTime();
      if (byStart !== 0) {
        return byStart;
      }
      return right.rsvpedAt.getTime() - left.rsvpedAt.getTime();
    });
  }

  private async buildDashboardEntry(
    rsvpId: number,
    userId: string,
  ): Promise<Result<DashboardRsvpEntry, MemberRsvpsDashboardError>> {
    const rsvpResult = await this.rsvps.getRSVPById(rsvpId);
    if (rsvpResult.ok === false) {
      return Err(RSVPNotFound(rsvpResult.value.message));
    }

    const rsvp = rsvpResult.value;
    if (rsvp.userId !== userId) {
      return Err(RSVPNotFound("That RSVP does not belong to the current user."));
    }

    const eventResult = await this.events.getEventById(rsvp.eventId);
    if (eventResult.ok === false) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }

    return Ok({
      rsvpId: rsvp.id,
      rsvpStatus: rsvp.status,
      rsvpedAt: rsvp.createdAt,
      event: {
        id: eventResult.value.id,
        title: eventResult.value.title,
        description: eventResult.value.description,
        location: eventResult.value.location,
        category: eventResult.value.category,
        status: eventResult.value.status,
        startDateTime: eventResult.value.startDateTime,
        endDateTime: eventResult.value.endDateTime,
      },
    });
  }

  async getMemberRsvpsDashboard(
    userId: string,
  ): Promise<Result<MemberRsvpsDashboard, MemberRsvpsDashboardError>> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return Err(ValidationError("User id is required."));
    }

    const rsvpResult = await this.rsvps.listRSVPsByUser(normalizedUserId);
    if (rsvpResult.ok === false) {
      return Err(UnexpectedDependencyError(rsvpResult.value.message));
    }

    const entries: DashboardRsvpEntry[] = [];
    for (const rsvp of rsvpResult.value) {
      const eventResult = await this.events.getEventById(rsvp.eventId);
      if (eventResult.ok === false) {
        return Err(UnexpectedDependencyError(eventResult.value.message));
      }

      entries.push({
        rsvpId: rsvp.id,
        rsvpStatus: rsvp.status,
        rsvpedAt: rsvp.createdAt,
        event: {
          id: eventResult.value.id,
          title: eventResult.value.title,
          description: eventResult.value.description,
          location: eventResult.value.location,
          category: eventResult.value.category,
          status: eventResult.value.status,
          startDateTime: eventResult.value.startDateTime,
          endDateTime: eventResult.value.endDateTime,
        },
      });
    }

    const upcoming = this.sortUpcoming(entries.filter((entry) => !this.isHistoryEntry(entry)));
    const history = this.sortHistory(entries.filter((entry) => this.isHistoryEntry(entry)));

    return Ok({
      upcoming,
      history,
    });
  }

  async cancelUpcomingRsvp(
    userId: string,
    eventId: number,
  ): Promise<Result<DashboardRsvpEntry, MemberRsvpsDashboardError>> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return Err(ValidationError("User id is required."));
    }

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return Err(ValidationError("A valid event id is required."));
    }

    const rsvpResult = await this.rsvps.getRSVPByEventAndUser(eventId, normalizedUserId);
    if (rsvpResult.ok === false) {
      return Err(RSVPNotFound("You do not have an RSVP for this event."));
    }

    const eventResult = await this.events.getEventById(eventId);
    if (eventResult.ok === false) {
      return Err(UnexpectedDependencyError(eventResult.value.message));
    }

    if (eventResult.value.status === "past" || eventResult.value.status === "cancelled") {
      return Err(InvalidRSVPState("Only upcoming RSVPs can be cancelled from this page."));
    }

    if (rsvpResult.value.status === "cancelled") {
      return Err(InvalidRSVPState("This RSVP has already been cancelled."));
    }

    const updatedResult = await this.rsvps.updateRSVPStatus(rsvpResult.value.id, "cancelled");
    if (updatedResult.ok === false) {
      return Err(UnexpectedDependencyError(updatedResult.value.message));
    }

    return this.buildDashboardEntry(updatedResult.value.id, normalizedUserId);
  }
}

export function CreateMemberRsvpsDashboardService(
  events: IEventRepository,
  rsvps: IRSVPRepository,
): IMemberRsvpsDashboardService {
  return new InMemoryMemberRsvpsDashboardService(events, rsvps);
}
