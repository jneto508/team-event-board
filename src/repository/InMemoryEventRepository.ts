import { Err, Ok, Result } from "../lib/result";
import { UnexpectedDependencyError } from "../service/errors";
import { EventFilterStatus, type IEventRepository } from "./EventRepository";
import { IEvent } from "../model/Event";
import { type CreateEventInput } from "./EventRepository";
import { type EventError } from "../service/errors";

class InMemoryEventRepository implements IEventRepository {
    private events: IEvent[] = [];
    private nextEventId = 1;

    async createEvent(
        data: CreateEventInput,
    ): Promise<Result<IEvent, EventError>> {
        try {
            const now = new Date();
            const event: IEvent = {
                id: this.nextEventId++,
                title: data.title.trim(),
                description: data.description.trim(),
                location: data.location.trim(),
                category:
                    (data.category || "general").trim().toLowerCase() ||
                    "general",
                status: "draft",
                capacity: data.capacity ?? 0,
                startDateTime: data.startDateTime,
                endDateTime: data.endDateTime,
                organizerId: data.organizerId,
                createdAt: now,
                updatedAt: now,
            };
            this.events.push(event);
            return Ok(event);
        } catch {
            return Err(UnexpectedDependencyError("Failed to create event."));
        }
    }

    async getEventById(id: number): Promise<Result<IEvent, EventError>> {
        const event = this.events.find(e => e.id === id);
        if (!event) {
            return Err(UnexpectedDependencyError(`Event with id ${id} not found.`));
        }
        return Ok(event);
    }
    async getEventsByOrganizer(
        _organizerId: string,
    ): Promise<Result<IEvent[], EventError>> {
        throw new Error("Not implemented");
    }
    async updateEvent(
        id: number,
        data: CreateEventInput,
    ): Promise<Result<void, EventError>> {
        const event = this.events.find(e => e.id === id);
        if (!event) {
            return Err(UnexpectedDependencyError(`Event with id ${id} not found.`));
        }
        event.title = data.title.trim();
        event.description = data.description.trim();
        event.location = data.location.trim();
        event.category = (data.category || "general").trim().toLowerCase() || "general";
        event.capacity = data.capacity ?? 0;
        event.startDateTime = data.startDateTime;
        event.endDateTime = data.endDateTime;
        event.updatedAt = new Date();
        return Ok(undefined);
    }
    async getAllEvents(): Promise<Result<IEvent[], EventError>> {
        throw new Error("Not implemented");
    }
    async getAllArchived(): Promise<Result<IEvent[], EventError>> {
        throw new Error("Not implemented");
    }
    async deleteEvent(_id: number): Promise<Result<void, EventError>> {
        throw new Error("Not implemented");
    }
    async listEvents(
        _filterStatus?: EventFilterStatus,
    ): Promise<Result<IEvent[], EventError>> {
        throw new Error("Not implemented");
    }
}


export function CreateInMemoryEventRepository(): IEventRepository {
  // We keep users in memory in this lecture so students can focus on auth, authorization,
  // and hashing before adding a persistent user store.
  return new InMemoryEventRepository();
}
