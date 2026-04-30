import {
  Prisma,
  type PrismaClient,
  type Event as PrismaEvent,
  type RSVP as PrismaRSVP,
  type Comment as PrismaComment,
} from "@prisma/client";
import { Err, Ok, type Result } from "../lib/result";
import { type EventStatus, type IEvent } from "../model/Event";
import { type IRSVP, type RSVPStatus } from "../model/RSVP";
import { type IComment } from "../model/Comment";
import {
  CommentNotFound,
  EventNotFound,
  InvalidRSVPData,
  RSVPNotFound,
  RSVPUnexpectedDependencyError,
  type CommentError,
  type EventError,
  type RSVPError,
} from "../service/errors";
import type {
  CreateCommentInput,
  CreateEventInput,
  CreateRSVPInput,
  EventFilterStatus,
  ICommentRepository,
  IEventRepository,
  IRSVPRepository,
  RSVPFilterStatus,
} from "./EventRepository";

function toIEvent(row: PrismaEvent): IEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    category: row.category,
    status: row.status as EventStatus,
    capacity: row.capacity ?? 0,
    startDateTime: row.startDateTime,
    endDateTime: row.endDateTime,
    organizerId: row.organizerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toIRSVP(row: PrismaRSVP): IRSVP {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    status: row.status as RSVPStatus,
    createdAt: row.createdAt,
  };
}

function toIComment(row: PrismaComment): IComment {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    content: row.content,
    createdAt: row.createdAt,
  };
}

function toCapacity(capacity: number | undefined): number | null {
  return typeof capacity === "number" && capacity > 0 ? capacity : null;
}

function UnexpectedEventError(message: string): EventError {
  return { name: "UnexpectedDependencyError", message };
}

function UnexpectedCommentError(message: string): CommentError {
  return { name: "UnexpectedDependencyError", message };
}

class PrismaEventRepository
  implements IEventRepository, IRSVPRepository, ICommentRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async createEvent(
    data: CreateEventInput,
  ): Promise<Result<IEvent, EventError>> {
    try {
      const row = await this.prisma.event.create({
        data: {
          title: data.title,
          description: data.description,
          location: data.location,
          category: data.category,
          capacity: toCapacity(data.capacity),
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
          organizerId: data.organizerId,
        },
      });
      return Ok(toIEvent(row));
    } catch {
      return Err(UnexpectedEventError("Failed to create event."));
    }
  }

  async getEventById(id: number): Promise<Result<IEvent, EventError>> {
    try {
      const row = await this.prisma.event.findUnique({ where: { id } });
      if (!row) return Err(EventNotFound(`Event ${id} was not found.`));
      return Ok(toIEvent(row));
    } catch {
      return Err(UnexpectedEventError("Failed to load event."));
    }
  }

  async getEventsByOrganizer(
    organizerId: string,
  ): Promise<Result<IEvent[], EventError>> {
    try {
      const rows = await this.prisma.event.findMany({ where: { organizerId } });
      return Ok(rows.map(toIEvent));
    } catch {
      return Err(UnexpectedEventError("Failed to load organizer events."));
    }
  }

  async getAllEvents(): Promise<Result<IEvent[], EventError>> {
    try {
      const rows = await this.prisma.event.findMany();
      return Ok(rows.map(toIEvent));
    } catch {
      return Err(UnexpectedEventError("Failed to list events."));
    }
  }

  async getArchivedEvents(category?: string): Promise<Result<IEvent[], EventError>> {
    try {
      const normalizedCategory = String(category ?? "").trim().toLowerCase();
      const rows = await this.prisma.event.findMany({
        where: {
          status: { in: ["past", "cancelled"] },
          ...(normalizedCategory === ""
            ? {}
            : {
                category: normalizedCategory,
              }),
        },
        orderBy: { endDateTime: "desc" },
      });
      return Ok(rows.map(toIEvent));
    } catch {
      return Err(UnexpectedEventError("Failed to list archived events."));
    }
  }

  async archiveExpiredEvents(now: Date): Promise<Result<number, EventError>> {
    try {
      const result = await this.prisma.event.updateMany({
        where: {
          status: {
            notIn: ["past", "cancelled"],
          },
          endDateTime: {
            lte: now,
          },
        },
        data: {
          status: "past",
        },
      });

      return Ok(result.count);
    } catch {
      return Err(UnexpectedEventError("Failed to archive expired events."));
    }
  }

  async deleteEvent(id: number): Promise<Result<void, EventError>> {
    try {
      const existing = await this.prisma.event.findUnique({ where: { id } });
      if (!existing) return Err(EventNotFound(`Event ${id} was not found.`));
      await this.prisma.event.delete({ where: { id } });
      return Ok(undefined);
    } catch {
      return Err(UnexpectedEventError("Failed to delete event."));
    }
  }

  async updateEvent(
    id: number,
    data: CreateEventInput,
  ): Promise<Result<void, EventError>> {
    try {
      const existing = await this.prisma.event.findUnique({ where: { id } });
      if (!existing) return Err(EventNotFound(`Event ${id} was not found.`));
      await this.prisma.event.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          location: data.location,
          category: data.category,
          capacity: toCapacity(data.capacity),
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
        },
      });
      return Ok(undefined);
    } catch {
      return Err(UnexpectedEventError("Failed to update event."));
    }
  }

  async updateEventStatus(
    id: number,
    status: EventStatus,
  ): Promise<Result<void, EventError>> {
    try {
      const existing = await this.prisma.event.findUnique({ where: { id } });
      if (!existing) return Err(EventNotFound(`Event ${id} was not found.`));
      await this.prisma.event.update({ where: { id }, data: { status } });
      return Ok(undefined);
    } catch {
      return Err(UnexpectedEventError("Failed to update event status."));
    }
  }

  async searchPublishedEvents(
    query: string,
  ): Promise<Result<IEvent[], EventError>> {
    try {
      const now = new Date();
      const rows = await this.prisma.event.findMany({
        where: {
          status: "published",
          startDateTime: {
            gt: now,
          },
        },
        orderBy: {
          startDateTime: "asc",
        },
      });

      const normalizedQuery = query.toLowerCase().trim();
      const events = rows.map(toIEvent);

      if (normalizedQuery === "") {
        return Ok(events);
      }

      return Ok(
        events.filter((event) => {
          return (
            event.title.toLowerCase().includes(normalizedQuery) ||
            event.description.toLowerCase().includes(normalizedQuery) ||
            event.location.toLowerCase().includes(normalizedQuery)
          );
        }),
      );
    } catch {
      return Err(UnexpectedEventError("Failed to search events."));
    }
  }

  async listEvents(
    filterStatus: EventFilterStatus = "all",
  ): Promise<Result<IEvent[], EventError>> {
    try {
      const rows = await this.prisma.event.findMany({
        where: filterStatus === "all" ? undefined : { status: filterStatus },
      });
      return Ok(rows.map(toIEvent));
    } catch {
      return Err(UnexpectedEventError("Failed to filter events."));
    }
  }

  async createRSVP(data: CreateRSVPInput): Promise<Result<IRSVP, RSVPError>> {
    try {
      const row = await this.prisma.rSVP.create({
        data: {
          eventId: data.eventId,
          userId: data.userId,
          status: data.status ?? "going",
          createdAt: data.createdAt,
        },
      });
      return Ok(toIRSVP(row));
    } catch {
      return Err(InvalidRSVPData("Failed to create RSVP."));
    }
  }

  async getRSVPById(id: number): Promise<Result<IRSVP, RSVPError>> {
    try {
      const row = await this.prisma.rSVP.findUnique({ where: { id } });
      if (!row) return Err(RSVPNotFound(`RSVP ${id} was not found.`));
      return Ok(toIRSVP(row));
    } catch {
      return Err(RSVPUnexpectedDependencyError("Failed to load RSVP."));
    }
  }

  async getRSVPByEventAndUser(
    eventId: number,
    userId: string,
  ): Promise<Result<IRSVP, RSVPError>> {
    try {
      const row = await this.prisma.rSVP.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (!row) {
        return Err(
          RSVPNotFound(`RSVP for event ${eventId} and user ${userId} was not found.`),
        );
      }
      return Ok(toIRSVP(row));
    } catch {
      return Err(RSVPUnexpectedDependencyError("Failed to load RSVP."));
    }
  }

  async listAllRSVPs(): Promise<Result<IRSVP[], RSVPError>> {
    try {
      const rows = await this.prisma.rSVP.findMany({
        orderBy: { createdAt: "asc" },
      });
      return Ok(rows.map(toIRSVP));
    } catch {
      return Err(RSVPUnexpectedDependencyError("Failed to list RSVPs."));
    }
  }

  async listRSVPsByEvent(
    eventId: number,
    filterStatus: RSVPFilterStatus = "all",
  ): Promise<Result<IRSVP[], RSVPError>> {
    try {
      const rows = await this.prisma.rSVP.findMany({
        where:
          filterStatus === "all"
            ? { eventId }
            : { eventId, status: filterStatus },
        orderBy: { createdAt: "asc" },
      });
      return Ok(rows.map(toIRSVP));
    } catch {
      return Err(RSVPUnexpectedDependencyError("Failed to list event RSVPs."));
    }
  }

  async listRSVPsByUser(
    userId: string,
    filterStatus: RSVPFilterStatus = "all",
  ): Promise<Result<IRSVP[], RSVPError>> {
    try {
      const rows = await this.prisma.rSVP.findMany({
        where:
          filterStatus === "all"
            ? { userId }
            : { userId, status: filterStatus },
        orderBy: { createdAt: "asc" },
      });
      return Ok(rows.map(toIRSVP));
    } catch {
      return Err(RSVPUnexpectedDependencyError("Failed to list user RSVPs."));
    }
  }

  async getEventAttendanceCounts(
    eventId: number,
  ): Promise<Result<{ attendeeCount: number; waitlistCount: number }, RSVPError>> {
    try {
      const grouped = await this.prisma.rSVP.groupBy({
        by: ["status"],
        where: {
          eventId,
          status: {
            in: ["going", "waitlisted"],
          },
        },
        _count: {
          _all: true,
        },
      });

      let attendeeCount = 0;
      let waitlistCount = 0;

      for (const row of grouped) {
        if (row.status === "going") {
          attendeeCount = row._count._all;
        }
        if (row.status === "waitlisted") {
          waitlistCount = row._count._all;
        }
      }

      return Ok({ attendeeCount, waitlistCount });
    } catch {
      return Err(RSVPUnexpectedDependencyError("Failed to count event RSVPs."));
    }
  }

  async updateRSVPStatus(
    id: number,
    status: RSVPStatus,
  ): Promise<Result<IRSVP, RSVPError>> {
    try {
      const existing = await this.prisma.rSVP.findUnique({ where: { id } });
      if (!existing) return Err(RSVPNotFound(`RSVP ${id} was not found.`));
      const row = await this.prisma.rSVP.update({
        where: { id },
        data: { status },
      });
      return Ok(toIRSVP(row));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return Err(RSVPNotFound(`RSVP ${id} was not found.`));
      }
      return Err(RSVPUnexpectedDependencyError("Failed to update RSVP."));
    }
  }

  async createComment(
    data: CreateCommentInput,
  ): Promise<Result<IComment, CommentError>> {
    try {
      const row = await this.prisma.comment.create({
        data: {
          eventId: data.eventId,
          userId: data.userId,
          content: data.content,
        },
      });
      return Ok(toIComment(row));
    } catch {
      return Err(UnexpectedCommentError("Failed to create comment."));
    }
  }

  async getCommentById(id: number): Promise<Result<IComment, CommentError>> {
    try {
      const row = await this.prisma.comment.findUnique({ where: { id } });
      if (!row) return Err(CommentNotFound(`Comment ${id} was not found.`));
      return Ok(toIComment(row));
    } catch {
      return Err(UnexpectedCommentError("Failed to load comment."));
    }
  }

  async listCommentsByEvent(
    eventId: number,
  ): Promise<Result<IComment[], CommentError>> {
    try {
      const rows = await this.prisma.comment.findMany({
        where: { eventId },
        orderBy: { createdAt: "asc" },
      });
      return Ok(rows.map(toIComment));
    } catch {
      return Err(UnexpectedCommentError("Failed to list event comments."));
    }
  }

  async deleteComment(id: number): Promise<Result<IComment, CommentError>> {
    try {
      const existing = await this.prisma.comment.findUnique({ where: { id } });
      if (!existing) return Err(CommentNotFound(`Comment ${id} was not found.`));
      await this.prisma.comment.delete({ where: { id } });
      return Ok(toIComment(existing));
    } catch {
      return Err(UnexpectedCommentError("Failed to delete comment."));
    }
  }
}

export type PrismaEventRepositoryBundle = IEventRepository &
  IRSVPRepository &
  ICommentRepository;

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
): PrismaEventRepositoryBundle {
  return new PrismaEventRepository(prisma);
}
