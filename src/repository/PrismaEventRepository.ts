import { PrismaClient } from "@prisma/client";
import { Err, Ok, type Result } from "../lib/result";
import { toEvent, type EventStatus, type IEvent } from "../model/Event";
import { toRSVP, type IRSVP, type RSVPStatus } from "../model/RSVP";
import { createComment, type IComment } from "../model/Comment";
import {
  CommentNotFound,
  EventNotFound,
  RSVPNotFound,
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
import {
  DEMO_COMMENTS,
  DEMO_EVENTS,
  DEMO_RSVPS,
} from "./InMemoryEventRepository";
import type { ISavedEventRepository } from "./SavedEventRepository";


function UnexpectedEventDependencyError(message: string): EventError {
  return { name: "UnexpectedDependencyError", message };
}

function UnexpectedRsvpDependencyError(message: string): RSVPError {
  return { name: "UnexpectedDependencyError", message };
}

function UnexpectedCommentDependencyError(message: string): CommentError {
  return { name: "UnexpectedDependencyError", message };
}

function normalizeCategory(category: string): string {
  const normalized = String(category ?? "").trim().toLowerCase();
  return normalized || "general";
}

function toOptionalCapacity(capacity: number | undefined): number | null {
  if (capacity === undefined || capacity <= 0) {
    return null;
  }
  return capacity;
}

function mapEvent(model: {
  id: number;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  capacity: number | null;
  startDateTime: Date;
  endDateTime: Date;
  organizerId: string;
  createdAt: Date;
  updatedAt: Date;
}): IEvent {
  return toEvent({
    ...model,
    status: model.status as EventStatus,
    capacity: model.capacity ?? 0,
  });
}

function mapComment(model: {
  id: number;
  eventId: number;
  userId: string;
  content: string;
  createdAt: Date;
}): IComment {
  return createComment(model.id, model);
}

function mapRSVP(model: {
  id: number;
  eventId: number;
  userId: string;
  status: string;
  createdAt: Date;
}): IRSVP {
  return toRSVP({
    ...model,
    status: model.status as RSVPStatus,
  });
}

class PrismaEventRepository
  implements IEventRepository, IRSVPRepository, ICommentRepository, ISavedEventRepository
{
  private seedPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaClient) {}

  // This seeding logic is only intended for development and testing purposes to provide some initial data.
  private async ensureSeeded(): Promise<void> {
    if (!this.seedPromise) {
      this.seedPromise = (async () => {
        const existingCount = await this.prisma.event.count();
        if (existingCount > 0) {
          return;
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.event.createMany({
            data: DEMO_EVENTS.map((event) => ({
              id: event.id,
              title: event.title,
              description: event.description,
              location: event.location,
              category: event.category,
              capacity: toOptionalCapacity(event.capacity),
              status: event.status,
              startDateTime: event.startDateTime,
              endDateTime: event.endDateTime,
              organizerId: event.organizerId,
              createdAt: event.createdAt,
              updatedAt: event.updatedAt,
            })),
          });

          await tx.rSVP.createMany({
            data: DEMO_RSVPS.map((rsvp) => ({
              id: rsvp.id,
              eventId: rsvp.eventId,
              userId: rsvp.userId,
              status: rsvp.status,
              createdAt: rsvp.createdAt,
            })),
          });

          await tx.comment.createMany({
            data: DEMO_COMMENTS.map((comment) => ({
              id: comment.id,
              eventId: comment.eventId,
              userId: comment.userId,
              content: comment.content,
              createdAt: comment.createdAt,
            })),
          });
        });
      })();
    }

    await this.seedPromise;
  }

  async createEvent(data: CreateEventInput): Promise<Result<IEvent, EventError>> {
    await this.ensureSeeded();

    try {
      const event = await this.prisma.event.create({
        data: {
          title: data.title.trim(),
          description: data.description.trim(),
          location: data.location.trim(),
          category: normalizeCategory(data.category),
          capacity: toOptionalCapacity(data.capacity),
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
          organizerId: data.organizerId,
        },
      });

      return Ok(mapEvent(event));
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to create event."));
    }
  }

  async getEventById(id: number): Promise<Result<IEvent, EventError>> {
    await this.ensureSeeded();

    try {
      const event = await this.prisma.event.findUnique({ where: { id } });
      if (!event) {
        return Err(EventNotFound(`Event ${id} was not found.`));
      }

      return Ok(mapEvent(event));
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to load event."));
    }
  }

  async getEventsByOrganizer(
    organizerId: string,
  ): Promise<Result<IEvent[], EventError>> {
    await this.ensureSeeded();

    try {
      const events = await this.prisma.event.findMany({
        where: { organizerId },
        orderBy: { startDateTime: "asc" },
      });
      return Ok(events.map(mapEvent));
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to load organizer events."));
    }
  }

  async getAllEvents(): Promise<Result<IEvent[], EventError>> {
    await this.ensureSeeded();

    try {
      const events = await this.prisma.event.findMany({
        orderBy: { startDateTime: "asc" },
      });
      return Ok(events.map(mapEvent));
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to list events."));
    }
  }

  async getAllArchived(): Promise<Result<IEvent[], EventError>> {
    await this.ensureSeeded();

    try {
      const events = await this.prisma.event.findMany({
        where: {
          status: { in: ["past", "cancelled"] },
        },
        orderBy: { endDateTime: "desc" },
      });
      return Ok(events.map(mapEvent));
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to list archived events."));
    }
  }

  async deleteEvent(id: number): Promise<Result<void, EventError>> {
    await this.ensureSeeded();

    try {
      await this.prisma.event.delete({ where: { id } });
      return Ok(undefined);
    } catch {
      return Err(EventNotFound(`Event ${id} was not found.`));
    }
  }

  async updateEvent(
    id: number,
    data: CreateEventInput,
  ): Promise<Result<void, EventError>> {
    await this.ensureSeeded();

    try {
      await this.prisma.event.update({
        where: { id },
        data: {
          title: data.title.trim(),
          description: data.description.trim(),
          location: data.location.trim(),
          category: normalizeCategory(data.category),
          capacity: toOptionalCapacity(data.capacity),
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
          organizerId: data.organizerId,
        },
      });
      return Ok(undefined);
    } catch {
      return Err(EventNotFound(`Event ${id} was not found.`));
    }
  }

  async updateEventStatus(
    id: number,
    status: EventStatus,
  ): Promise<Result<void, EventError>> {
    await this.ensureSeeded();

    try {
      await this.prisma.event.update({
        where: { id },
        data: { status },
      });
      return Ok(undefined);
    } catch {
      return Err(EventNotFound(`Event ${id} was not found.`));
    }
  }

  async listEvents(
    filterStatus: EventFilterStatus = "all",
  ): Promise<Result<IEvent[], EventError>> {
    await this.ensureSeeded();

    try {
      const events = await this.prisma.event.findMany({
        where: filterStatus === "all" ? undefined : { status: filterStatus },
        orderBy: { startDateTime: "asc" },
      });
      return Ok(events.map(mapEvent));
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to filter events."));
    }
  }

  async createRSVP(data: CreateRSVPInput): Promise<Result<IRSVP, RSVPError>> {
    await this.ensureSeeded();

    try {
      const rsvp = await this.prisma.rSVP.create({
        data: {
          eventId: data.eventId,
          userId: data.userId,
          status: data.status,
          createdAt: data.createdAt,
        },
      });

      return Ok(mapRSVP(rsvp));
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to create RSVP."));
    }
  }

  async getRSVPById(id: number): Promise<Result<IRSVP, RSVPError>> {
    await this.ensureSeeded();

    try {
      const rsvp = await this.prisma.rSVP.findUnique({ where: { id } });
      if (!rsvp) {
        return Err(RSVPNotFound(`RSVP ${id} was not found.`));
      }

      return Ok(mapRSVP(rsvp));
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to load RSVP."));
    }
  }

  async getRSVPByEventAndUser(
    eventId: number,
    userId: string,
  ): Promise<Result<IRSVP, RSVPError>> {
    await this.ensureSeeded();

    try {
      const rsvp = await this.prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      });

      if (!rsvp) {
        return Err(RSVPNotFound(`No RSVP found for event ${eventId}.`));
      }

      return Ok(mapRSVP(rsvp));
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to load RSVP."));
    }
  }

  async listAllRSVPs(): Promise<Result<IRSVP[], RSVPError>> {
    await this.ensureSeeded();

    try {
      const rsvps = await this.prisma.rSVP.findMany({
        orderBy: { createdAt: "asc" },
      });
      return Ok(rsvps.map(mapRSVP));
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to list RSVPs."));
    }
  }

  async listRSVPsByEvent(
    eventId: number,
    filterStatus: RSVPFilterStatus = "all",
  ): Promise<Result<IRSVP[], RSVPError>> {
    await this.ensureSeeded();

    try {
      const rsvps = await this.prisma.rSVP.findMany({
        where: {
          eventId,
          ...(filterStatus === "all" ? {} : { status: filterStatus }),
        },
        orderBy: { createdAt: "asc" },
      });

      return Ok(rsvps.map(mapRSVP));
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to list event RSVPs."));
    }
  }

  async listRSVPsByUser(
    userId: string,
    filterStatus: RSVPFilterStatus = "all",
  ): Promise<Result<IRSVP[], RSVPError>> {
    await this.ensureSeeded();

    try {
      const rsvps = await this.prisma.rSVP.findMany({
        where: {
          userId,
          ...(filterStatus === "all" ? {} : { status: filterStatus }),
        },
        orderBy: { createdAt: "asc" },
      });

      return Ok(rsvps.map(mapRSVP));
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to list user RSVPs."));
    }
  }

  async updateRSVPStatus(
    id: number,
    status: RSVPStatus,
  ): Promise<Result<IRSVP, RSVPError>> {
    await this.ensureSeeded();

    try {
      const rsvp = await this.prisma.rSVP.update({
        where: { id },
        data: { status },
      });
      return Ok(mapRSVP(rsvp));
    } catch {
      return Err(RSVPNotFound(`RSVP ${id} was not found.`));
    }
  }

  async createComment(data: CreateCommentInput): Promise<Result<IComment, CommentError>> {
    await this.ensureSeeded();

    try {
      const comment = await this.prisma.comment.create({
        data: {
          eventId: data.eventId,
          userId: data.userId,
          content: data.content.trim(),
        },
      });
      return Ok(mapComment(comment));
    } catch {
      return Err(UnexpectedCommentDependencyError("Unable to create comment."));
    }
  }

  async getCommentById(id: number): Promise<Result<IComment, CommentError>> {
    await this.ensureSeeded();

    try {
      const comment = await this.prisma.comment.findUnique({ where: { id } });
      if (!comment) {
        return Err(CommentNotFound(`Comment ${id} was not found.`));
      }

      return Ok(mapComment(comment));
    } catch {
      return Err(UnexpectedCommentDependencyError("Unable to load comment."));
    }
  }

  async listCommentsByEvent(eventId: number): Promise<Result<IComment[], CommentError>> {
    await this.ensureSeeded();

    try {
      const comments = await this.prisma.comment.findMany({
        where: { eventId },
        orderBy: { createdAt: "asc" },
      });
      return Ok(comments.map(mapComment));
    } catch {
      return Err(UnexpectedCommentDependencyError("Unable to list comments."));
    }
  }

  async toggleSave(
    userId: string,
    eventId: number,
  ): Promise<Result<"saved" | "unsaved", EventError>> {
    try {
      const existing = await this.prisma.savedEvent.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
      });

      if (existing) {
        await this.prisma.savedEvent.delete({
          where: {
            userId_eventId: {
              userId,
              eventId,
            },
          },
        });
        return Ok("unsaved" as const);
      }

      await this.prisma.savedEvent.create({
        data: {
          userId,
          eventId,
        },
      });

      return Ok("saved" as const);
    } catch {
      return Err(UnexpectedEventDependencyError("Unable to toggle saved event."));
    }
  }

  async getSavedEventsByUser(
    userId: string,
  ): Promise<Result<number[], EventError>> {
    try {
      const saved = await this.prisma.savedEvent.findMany({
        where: { userId },
        select: { eventId: true },
      });

      return Ok(saved.map((entry) => entry.eventId));
    } catch {
      return Err(UnexpectedEventDependencyError("Unable to load saved events."));
    }
  }

  async deleteComment(id: number): Promise<Result<IComment, CommentError>> {
    await this.ensureSeeded();

    try {
      const comment = await this.prisma.comment.delete({
        where: { id },
      });
      return Ok(mapComment(comment));
    } catch {
      return Err(CommentNotFound(`Comment ${id} was not found.`));
    }
  }
}

export function CreatePrismaEventRepository(prismaClient: PrismaClient):
  IEventRepository & IRSVPRepository & ICommentRepository & ISavedEventRepository {
  return new PrismaEventRepository(prismaClient);
}
