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

  async getEventById(id: number): Promise<Result<IEvent, EventError>> {}

  async getEventsByOrganizer(
    organizerId: string,
  ): Promise<Result<IEvent[], EventError>> {}

  async getAllEvents(): Promise<Result<IEvent[], EventError>> {}

  async getAllArchived(): Promise<Result<IEvent[], EventError>> {}

  async deleteEvent(id: number): Promise<Result<void, EventError>> {}

  async updateEvent(
    id: number,
    data: CreateEventInput,
  ): Promise<Result<void, EventError>> {}

  async updateEventStatus(
    id: number,
    status: EventStatus,
  ): Promise<Result<void, EventError>> {}

  async listEvents(
    filterStatus: EventFilterStatus = "all",
  ): Promise<Result<IEvent[], EventError>> {}

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
): IEventRepository {
  return new PrismaEventRepository(prisma);
}
