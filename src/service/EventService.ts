import { Ok, Err, Result } from "../lib/result";
import { IEvent } from "../model/Event";
import {
    EventError,
    InvalidEventData,
    InvalidEventState,
    EventNotFound,
    Forbidden,
    InvalidSearchInput,
} from "../service/errors";
import {
    CreateEventInput,
    IEventRepository,
} from "../repository/EventRepository";
import { UserRole } from "../auth/User";

export interface IEventService {
    createEvent(data: CreateEventInput): Promise<Result<IEvent, EventError>>;
    getEventById(
        id: number,
        actor: { userId: string; role: UserRole },
    ): Promise<Result<IEvent, EventError>>;
    searchEvents(query: string): Promise<Result<IEvent[], EventError>>;
    getArchivedEvents(category?: string): Promise<Result<IEvent[], EventError>>;
    archiveExpiredEvents(now?: Date): Promise<Result<number, EventError>>;
    deleteEvent(id: number): Promise<Result<void, EventError>>;
    updateEvent(
        id: number,
        data: CreateEventInput,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<void, EventError>>;
    getEditableEvent(
        id: number,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<IEvent, EventError>>;
}

function validateEventFields(data: CreateEventInput): EventError | null {
    if (!data.title || data.title.trim() === "") {
        return InvalidEventData("Title is required.");
    }
    if (!data.description || data.description.trim() === "") {
        return InvalidEventData("Description is required.");
    }
    if (!data.location || data.location.trim() === "") {
        return InvalidEventData("Location is required.");
    }
    if (!data.category || data.category.trim() === "") {
        return InvalidEventData("Category is required.");
    }
    if (
        !(data.startDateTime instanceof Date) ||
        isNaN(data.startDateTime.getTime())
    ) {
        return InvalidEventData(
            "Start date/time is required and must be a valid date.",
        );
    }
    if (
        !(data.endDateTime instanceof Date) ||
        isNaN(data.endDateTime.getTime())
    ) {
        return InvalidEventData(
            "End date/time is required and must be a valid date.",
        );
    }
    if (data.startDateTime >= data.endDateTime) {
        return InvalidEventData("Start date/time must be before end date/time.");
    }
    if (data.capacity !== undefined && data.capacity < 0) {
        return InvalidEventData("Capacity must be a non-negative number.");
    }
    return null;
}

function validateEventInput(data: CreateEventInput): EventError | null {
    if (!data.organizerId || data.organizerId.trim() === "") {
        return InvalidEventData("Organizer ID is required.");
    }
    return validateEventFields(data);
}

export class EventService implements IEventService {
    constructor(private readonly repository: IEventRepository) {}

    async archiveExpiredEvents(
        now: Date = new Date(),
    ): Promise<Result<number, EventError>> {
        const eventsResult = await this.repository.getAllEvents();
        if (eventsResult.ok === false) {
            return Err(eventsResult.value);
        }

        let archivedCount = 0;
        for (const event of eventsResult.value) {
            if (event.status === "past" || event.status === "cancelled") {
                continue;
            }

            if (event.endDateTime <= now) {
                const updated = await this.repository.updateEventStatus(
                    event.id,
                    "past",
                );
                if (updated.ok === false) {
                    return Err(updated.value);
                }
                archivedCount += 1;
            }
        }

        return Ok(archivedCount);
    }

    async createEvent(
        data: CreateEventInput,
    ): Promise<Result<IEvent, EventError>> {
        const archiveResult = await this.archiveExpiredEvents();
        if (archiveResult.ok === false) {
            return Err(archiveResult.value);
        }

        const error = validateEventInput(data);
        if (error) return Err(error);
        return this.repository.createEvent(data);
    }

    async getEventById(
        id: number,
        actor: { userId: string; role: UserRole },
    ): Promise<Result<IEvent, EventError>> {
        const archiveResult = await this.archiveExpiredEvents();
        if (archiveResult.ok === false) {
            return Err(archiveResult.value);
        }

        const result = await this.repository.getEventById(id);
        if (!result.ok) {
            return Err(EventNotFound(`Event with id ${id} not found.`));
        }

        const event = result.value;
        if (event.status === "draft") {
            const isOrganizer = actor.userId === event.organizerId;
            const isAdmin = actor.role === "admin";
            if (!isOrganizer && !isAdmin) {
                return Err(EventNotFound(`Event with id ${id} not found.`));
            }
        }

        return Ok(event);
    }

    async deleteEvent(id: number): Promise<Result<void, EventError>> {
        const archiveResult = await this.archiveExpiredEvents();
        if (archiveResult.ok === false) {
            return Err(archiveResult.value);
        }

        const found = await this.repository.getEventById(id);
        if (!found.ok) {
            return Err(EventNotFound(`Event with id ${id} not found.`));
        }
        return this.repository.deleteEvent(id);
    }

    async updateEvent(
        id: number,
        data: CreateEventInput,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<void, EventError>> {
        const error = validateEventFields(data);
        if (error) return Err(error);

        const found = await this.repository.getEventById(id);
        if (!found.ok) {
            return Err(EventNotFound(`Event with id ${id} not found.`));
        }
        const event = found.value;

        if (event.status === "cancelled" || event.status === "past") {
            return Err(InvalidEventState("Cannot edit a cancelled or past event."));
        }

        if (actingUserRole === "user") {
            return Err(Forbidden("Members are not allowed to edit events."));
        }
        if (actingUserRole === "staff" && event.organizerId !== actingUserId) {
            return Err(Forbidden("You can only edit events you organized."));
        }

        return this.repository.updateEvent(id, data);
    }

    async getEditableEvent(
        id: number,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<IEvent, EventError>> {
        const found = await this.repository.getEventById(id);
        if (!found.ok) return Err(EventNotFound(`Event with id ${id} not found.`));

        const event = found.value;

        if (actingUserRole === "user") {
            return Err(Forbidden("Members are not allowed to edit events."));
        }
        if (event.status === "cancelled" || event.status === "past") {
            return Err(InvalidEventState("Cannot edit a cancelled or past event."));
        }
        if (actingUserRole === "staff" && event.organizerId !== actingUserId) {
            return Err(Forbidden("You can only edit events you organized."));
        }

        return Ok(event);
    }

    async searchEvents(query: string): Promise<Result<IEvent[], EventError>> {
        const archiveResult = await this.archiveExpiredEvents();
        if (archiveResult.ok === false) {
            return Err(archiveResult.value);
        }

        if (query === null || query === undefined) {
            return Err(InvalidSearchInput("Search query is required."));
        }

        if (typeof query !== "string") {
            return Err(InvalidSearchInput("Search query must be a string."));
        }

        const q = query.trim();
        if (q.length > 100) {
            return Err(InvalidSearchInput("Search query too long."));
        }

        if (/[^a-zA-Z0-9\s]/.test(q)) {
            return Err(InvalidSearchInput("Invalid characters in search."));
        }

        return this.repository.searchPublishedEvents(q);
    }

    async getArchivedEvents(
        category?: string,
    ): Promise<Result<IEvent[], EventError>> {
        const archiveResult = await this.archiveExpiredEvents();
        if (archiveResult.ok === false) {
            return Err(archiveResult.value);
        }

        const result = await this.repository.getAllArchived();
        if (result.ok === false) {
            return Err(result.value);
        }

        const normalizedCategory = String(category ?? "")
            .trim()
            .toLowerCase();

        const filtered = normalizedCategory
            ? result.value.filter(
                  (event) => event.category === normalizedCategory,
              )
            : result.value;

        const sorted = [...filtered].sort(
            (left, right) =>
                right.endDateTime.getTime() - left.endDateTime.getTime(),
        );

        return Ok(sorted);
    }
}

export function CreateEventService(eventRepository: IEventRepository) {
    return new EventService(eventRepository);
}
