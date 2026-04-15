import { Ok, Err, Result } from "../lib/result";
import { IEvent } from "../model/Event";
import { EventError, InvalidEventData, EventNotFound } from "../service/errors";
import {
    CreateEventInput,
    IEventRepository,
} from "../repository/EventRepository";

export interface IEventService {
    createEvent(data: CreateEventInput): Promise<Result<IEvent, EventError>>;
    getEventById(id: number): Promise<Result<IEvent, EventError>>;
    deleteEvent(id: number): Promise<Result<void, EventError>>;
    updateEvent(
        id: number,
        data: CreateEventInput,
    ): Promise<Result<void, EventError>>;
}

function validateEventInput(data: CreateEventInput): EventError | null {
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
    if (!data.organizerId || data.organizerId.trim() === "") {
        return InvalidEventData("Organizer ID is required.");
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

export class EventService implements IEventService {
    constructor(private readonly repository: IEventRepository) {}

    async createEvent(
        data: CreateEventInput,
    ): Promise<Result<IEvent, EventError>> {
        const error = validateEventInput(data);
        if (error) return Err(error);
        return this.repository.createEvent(data);
    }

    async getEventById(id: number): Promise<Result<IEvent, EventError>> {
        const result = await this.repository.getEventById(id);
        if (!result.ok) {
            return Err(EventNotFound(`Event with id ${id} not found.`));
        }
        return Ok(result.value);
    }

    async deleteEvent(id: number): Promise<Result<void, EventError>> {
        const found = await this.repository.getEventById(id);
        if (!found.ok) {
            return Err(EventNotFound(`Event with id ${id} not found.`));
        }
        return this.repository.deleteEvent(id);
    }

    async updateEvent(
        id: number,
        data: CreateEventInput,
    ): Promise<Result<void, EventError>> {
        const error = validateEventInput(data);
        if (error) return Err(error);
        const found = await this.repository.getEventById(id);
        if (!found.ok) {
            return Err(EventNotFound(`Event with id ${id} not found.`));
        }
        return this.repository.updateEvent(id, data);
    }
}

export function CreateEventService(eventRepository: IEventRepository) {
    return new EventService(eventRepository);
}
