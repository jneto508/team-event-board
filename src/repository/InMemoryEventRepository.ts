import { Err, Ok, Result } from "../lib/result";
import { createEvent, updateEvent } from "../model/Event";
import type { IEvent } from "../model/Event";
import {
    EventNotFound,
    UnexpectedDependencyError,
    EventError,
} from "../service/errors";
import type { EventInput, IEventRepository } from "./EventRepository";

class InMemoryEventRepository implements IEventRepository {
    private events: IEvent[] = [];
    private nextId = 1;

    async createEvent(data: EventInput): Promise<Result<IEvent, EventError>> {
        try {
            const event = createEvent(this.nextId++, {
                title: data.title,
                description: data.description,
                location: data.location,
                category: data.category,
                capacity: data.capacity,
                startDateTime: data.startDateTime,
                endDateTime: data.endDateTime,
                organizerId: parseInt(data.organizerId, 10) || 0,
            });
            this.events.push(event);
            return Ok(event);
        } catch {
            return Err(UnexpectedDependencyError("Unable to create event."));
        }
    }

    async getEventById(id: number): Promise<Result<IEvent, EventError>> {
        try {
            const event = this.events.find((e) => e.id === id) ?? null;
            if (!event) return Err(EventNotFound("Event not found."));
            return Ok(event);
        } catch {
            return Err(UnexpectedDependencyError("Unable to read event."));
        }
    }

    async updateEvent(id: number, data: EventInput): Promise<Result<void, EventError>> {
        try {
            const event = this.events.find((e) => e.id === id) ?? null;
            if (!event) return Err(EventNotFound("Event not found."));
            updateEvent(event, data);  // mutates event in-place, sets updatedAt
            return Ok(undefined);
        } catch {
            return Err(UnexpectedDependencyError("Unable to update event."));
        }
    }
  }