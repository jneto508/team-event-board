import { Ok, Err, Result } from "../lib/result";
import type {
  IEventRepository,
  IRSVPRepository,
} from "../repository/EventRepository";
import type { IUserRepository } from "../auth/UserRepository";
import type { UserRole } from "../auth/User";
import {
  type EventError,
  EventNotFound,
  Forbidden,
  UnexpectedDependencyError,
} from "./errors";

export interface AttendeeEntry {
  displayName: string;
  rsvpedAt: Date;
}

export interface AttendeeListView {
  attending: AttendeeEntry[];
  waitlisted: AttendeeEntry[];
  cancelled: AttendeeEntry[];
}

export interface IAttendeeListService {
  getAttendeeList(
    eventId: number,
    actor: { userId: string; role: UserRole },
  ): Promise<Result<AttendeeListView, EventError>>;
}

export class AttendeeListService implements IAttendeeListService {
  constructor(
    private readonly eventRepository: IEventRepository,
    private readonly rsvpRepository: IRSVPRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async getAttendeeList(
    eventId: number,
    actor: { userId: string; role: UserRole },
  ): Promise<Result<AttendeeListView, EventError>> {
    const eventResult = await this.eventRepository.getEventById(eventId);
    if (!eventResult.ok) {
      return Err(EventNotFound(`Event with id ${eventId} not found.`));
    }

    const event = eventResult.value;
    const isOrganizer = actor.userId === event.organizerId;
    const isAdmin = actor.role === "admin";

    if (!isOrganizer && !isAdmin) {
      return Err(Forbidden("You are not allowed to view this attendee list."));
    }

    const rsvpResult = await this.rsvpRepository.listRSVPsByEvent(eventId);
    if (!rsvpResult.ok) {
            return Err(
        UnexpectedDependencyError(
          `Unable to load RSVPs for event with id ${eventId}.`,
        ),
      );
    }

    const view: AttendeeListView = {
      attending: [],
      waitlisted: [],
      cancelled: [],
    };

    const sortedRsvps = [...rsvpResult.value].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );

    for (const rsvp of sortedRsvps) {
      const userResult = await this.userRepository.findById(rsvp.userId);

      if (!userResult.ok) {
        return Err(
          UnexpectedDependencyError(
            `Unable to load attendee user with id ${rsvp.userId}.`,
          ),
        );
      }

      const user = userResult.value;
      if (user === null) {
        return Err(
          UnexpectedDependencyError(
            `Attendee user with id ${rsvp.userId} was not found.`,
          ),
        );
      }

      const entry: AttendeeEntry = {
        displayName: user.displayName,
        rsvpedAt: rsvp.createdAt,
      };

      if (rsvp.status === "going") {
        view.attending.push(entry);
      } else if (rsvp.status === "waitlisted") {
        view.waitlisted.push(entry);
      } else {
        view.cancelled.push(entry);
      }
    }

    return Ok(view);
  }
}

export function CreateAttendeeListService(
  eventRepository: IEventRepository,
  rsvpRepository: IRSVPRepository,
  userRepository: IUserRepository,
): IAttendeeListService {
  return new AttendeeListService(
    eventRepository,
    rsvpRepository,
    userRepository,
  );
}