import { type PrismaClient, type Event as PrismaEvent } from "@prisma/client";
import { Err, Ok, type Result } from "../lib/result";
import { type EventStatus, type IEvent } from "../model/Event";
import { EventNotFound, type EventError } from "../service/errors";
import type {
  CreateEventInput,
  EventFilterStatus,
  IEventRepository,
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

function toCapacity(capacity: number | undefined): number | null {
  return capacity ? capacity : null;
}

function UnexpectedError(message: string): EventError {
  return { name: "UnexpectedDependencyError", message };
}

class PrismaEventRepository implements IEventRepository {
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
      return Err(UnexpectedError("Failed to create event."));
    }
  }

  async getEventById(id: number): Promise<Result<IEvent, EventError>> {
    try {
      const row = await this.prisma.event.findUnique({ where: { id } });
      if (!row) return Err(EventNotFound(`Event ${id} was not found.`));
      return Ok(toIEvent(row));
    } catch {
      return Err(UnexpectedError("Failed to load event."));
    }
  }

  async getEventsByOrganizer(
    organizerId: string,
  ): Promise<Result<IEvent[], EventError>> {
    try {
      const rows = await this.prisma.event.findMany({ where: { organizerId } });
      return Ok(rows.map(toIEvent));
    } catch {
      return Err(UnexpectedError("Failed to load organizer events."));
    }
  }

  async getAllEvents(): Promise<Result<IEvent[], EventError>> {
    try {
      const rows = await this.prisma.event.findMany();
      return Ok(rows.map(toIEvent));
    } catch {
      return Err(UnexpectedError("Failed to list events."));
    }
  }

  async getAllArchived(): Promise<Result<IEvent[], EventError>> {
    try {
      const rows = await this.prisma.event.findMany({
        where: { status: { in: ["past", "cancelled"] } },
      });
      return Ok(rows.map(toIEvent));
    } catch {
      return Err(UnexpectedError("Failed to list archived events."));
    }
  }

  async deleteEvent(id: number): Promise<Result<void, EventError>> {
    try {
      const existing = await this.prisma.event.findUnique({ where: { id } });
      if (!existing) return Err(EventNotFound(`Event ${id} was not found.`));
      await this.prisma.event.delete({ where: { id } });
      return Ok(undefined);
    } catch {
      return Err(UnexpectedError("Failed to delete event."));
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
      return Err(UnexpectedError("Failed to update event."));
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
      return Err(UnexpectedError("Failed to update event status."));
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
      return Err(UnexpectedError("Failed to filter events."));
    }
  }
}

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
): IEventRepository {
  return new PrismaEventRepository(prisma);
}
