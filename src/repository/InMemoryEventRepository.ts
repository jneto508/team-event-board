import { Err, Ok, Result } from "../lib/result";
import { EventStatus, IEvent } from "../model/Event";
import {
    EventNotFound,
    type EventError,
    UnexpectedDependencyError,
} from "../service/errors";
import { EventFilterStatus, type IEventRepository } from "./EventRepository";
import { type CreateEventInput } from "./EventRepository";

class InMemoryEventRepository implements IEventRepository {
    private events: IEvent[] = [];
    private nextEventId = 1;

    private findEvent(id: number): IEvent | undefined {
        return this.events.find((candidate) => candidate.id === id);
    }

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
        try {
            const event = this.findEvent(id);
            if (!event) {
                return Err(EventNotFound(`Event with id ${id} not found.`));
            }
            return Ok(event);
        } catch {
            return Err(UnexpectedDependencyError("Failed to retrieve event."));
        }
    }

    async getEventsByOrganizer(
        organizerId: string,
    ): Promise<Result<IEvent[], EventError>> {
        try {
            return Ok(
                this.events.filter((event) => event.organizerId === organizerId),
            );
        } catch {
            return Err(
                UnexpectedDependencyError(
                    "Failed to retrieve organizer events.",
                ),
            );
        }
    }

    async updateEvent(
        id: number,
        data: CreateEventInput,
    ): Promise<Result<void, EventError>> {
        try {
            const event = this.findEvent(id);
            if (!event) {
                return Err(EventNotFound(`Event with id ${id} not found.`));
            }

            event.title = data.title.trim();
            event.description = data.description.trim();
            event.location = data.location.trim();
            event.category =
                (data.category || "general").trim().toLowerCase() || "general";
            event.capacity = data.capacity ?? 0;
            event.startDateTime = data.startDateTime;
            event.endDateTime = data.endDateTime;
            event.organizerId = data.organizerId;
            event.updatedAt = new Date();

            return Ok(undefined);
        } catch {
            return Err(UnexpectedDependencyError("Failed to update event."));
        }
    }

    async updateEventStatus(
        id: number,
        status: EventStatus,
    ): Promise<Result<void, EventError>> {
        try {
            const event = this.findEvent(id);
            if (!event) {
                return Err(EventNotFound(`Event with id ${id} not found.`));
            }

            event.status = status;
            event.updatedAt = new Date();
            return Ok(undefined);
        } catch {
            return Err(
                UnexpectedDependencyError("Failed to update event status."),
            );
        }
    }

    async getAllEvents(): Promise<Result<IEvent[], EventError>> {
        try {
            return Ok([...this.events]);
        } catch {
            return Err(UnexpectedDependencyError("Failed to retrieve events."));
        }
    }

    async getAllArchived(): Promise<Result<IEvent[], EventError>> {
        try {
            return Ok(
                this.events.filter((event) => event.status === "past"),
            );
        } catch {
            return Err(
                UnexpectedDependencyError("Failed to retrieve archived events."),
            );
        }
    }

    async deleteEvent(id: number): Promise<Result<void, EventError>> {
        try {
            const initialLength = this.events.length;
            this.events = this.events.filter((event) => event.id !== id);

            if (this.events.length === initialLength) {
                return Err(EventNotFound(`Event with id ${id} not found.`));
            }

            return Ok(undefined);
        } catch {
            return Err(UnexpectedDependencyError("Failed to delete event."));
        }
    }

    async listEvents(
        filterStatus: EventFilterStatus = "all",
    ): Promise<Result<IEvent[], EventError>> {
        try {
            if (filterStatus === "all") {
                return Ok([...this.events]);
            }

            return Ok(
                this.events.filter((event) => event.status === filterStatus),
            );
        } catch {
            return Err(UnexpectedDependencyError("Failed to list events."));
        }
    }
}


export function CreateInMemoryEventRepository(): IEventRepository {
  // We keep users in memory in this lecture so students can focus on auth, authorization,
  // and hashing before adding a persistent user store.
  return new InMemoryEventRepository();
}
