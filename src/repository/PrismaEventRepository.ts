import { PrismaClient } from "@prisma/client";
import { Ok, Err, type Result } from "../lib/result";
import type {
  IEventRepository,
  CreateEventInput,
  EventFilterStatus,
} from "./EventRepository";
import type { IEvent } from "../model/Event";
import type { EventError } from "../service/errors";
import { EventNotFound } from "../service/errors";

const prisma = new PrismaClient();

function UnexpectedEventDependencyError(message: string): EventError {
  return {
    name: "UnexpectedDependencyError",
    message,
  };
}

export class PrismaEventRepository implements IEventRepository {
  async createEvent(
    data: CreateEventInput
  ): Promise<Result<IEvent, EventError>> {
    try {
      const event = await prisma.event.create({
        data: {
          title: data.title,
          description: data.description,
          location: data.location,
          category: data.category,
          capacity: data.capacity ?? null,
          organizerId: data.organizerId,
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
          status: "draft",
        },
      });

      return Ok(event as IEvent);
    } catch {
      return Err(
        UnexpectedEventDependencyError("Failed to create event.")
      );
    }
  }

  async getEventById(
    id: number
  ): Promise<Result<IEvent, EventError>> {
    try {
      const event = await prisma.event.findUnique({
        where: { id },
      });

      if (!event) {
        return Err(
          EventNotFound(`Event ${id} was not found.`)
        );
      }

      return Ok(event as IEvent);
    } catch {
      return Err(
        UnexpectedEventDependencyError("Failed to load event.")
      );
    }
  }

  async getAllEvents(): Promise<Result<IEvent[], EventError>> {
    try {
      const events = await prisma.event.findMany({
        orderBy: {
          startDateTime: "asc",
        },
      });

      return Ok(events as IEvent[]);
    } catch {
      return Err(
        UnexpectedEventDependencyError("Failed to list events.")
      );
    }
  }

  async searchPublishedEvents(
    query: string
  ): Promise<Result<IEvent[], EventError>> {
    try {
      const now = new Date();

      const events = await prisma.event.findMany({
        where: {
          status: "published",
          startDateTime: {
            gt: now,
          },
          OR: [
            {
              title: {
                contains: query,
              },
            },
            {
              description: {
                contains: query,
              },
            },
            {
              location: {
                contains: query,
              },
            },
          ],
        },
        orderBy: {
          startDateTime: "asc",
        },
      });

      return Ok(events as IEvent[]);
    } catch {
      return Err(
        UnexpectedEventDependencyError("Failed to search events.")
      );
    }
  }

  async getEventsByOrganizer(
    organizerId: string
  ): Promise<Result<IEvent[], EventError>> {
    try {
      const events = await prisma.event.findMany({
        where: { organizerId },
        orderBy: {
          startDateTime: "asc",
        },
      });

      return Ok(events as IEvent[]);
    } catch {
      return Err(
        UnexpectedEventDependencyError(
          "Failed to load organizer events."
        )
      );
    }
  }

  async listEvents(
    filterStatus: EventFilterStatus = "all"
  ): Promise<Result<IEvent[], EventError>> {
    try {
      const events = await prisma.event.findMany({
        where:
          filterStatus === "all"
            ? {}
            : { status: filterStatus },
        orderBy: {
          startDateTime: "asc",
        },
      });

      return Ok(events as IEvent[]);
    } catch {
      return Err(
        UnexpectedEventDependencyError(
          "Failed to filter events."
        )
      );
    }
  }

  async updateEvent(): Promise<Result<void, EventError>> {
    return Ok(undefined);
  }

  async updateEventStatus(): Promise<Result<void, EventError>> {
    return Ok(undefined);
  }

  async getAllArchived(): Promise<Result<IEvent[], EventError>> {
    try {
      const events = await prisma.event.findMany({
        where: {
          OR: [
            { status: "past" },
            { status: "cancelled" },
          ],
        },
      });

      return Ok(events as IEvent[]);
    } catch {
      return Err(
        UnexpectedEventDependencyError(
          "Failed to list archived events."
        )
      );
    }
  }

  async deleteEvent(): Promise<Result<void, EventError>> {
    return Ok(undefined);
  }
}

export function CreatePrismaEventRepository(): IEventRepository {
  return new PrismaEventRepository();
}