export type EventStatus = "draft" | "published" | "cancelled" | "past";

export interface IEvent {
  id: number;
  title: string;
  description: string;
  location: string;
  category: string;
  status: EventStatus;
  capacity: number;
  startDateTime: Date;
  endDateTime: Date;
  organizerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEventData {
  title: string;
  description: string;
  location: string;
  category: string;
  status?: EventStatus;
  capacity?: number;
  startDateTime: Date;
  endDateTime: Date;
  organizerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

function normalizeTitle(title: string): string {
    return String(title ?? "").trim();
}

function normalizeDescription(description: string): string {
    return String(description ?? "").trim();
}

function normalizeLocation(location: string): string {
    return String(location ?? "").trim();
}

function normalizeCategory(category: string): string {
    const normalized = String(category ?? "general").trim().toLowerCase();
    return normalized || "general";
}

function normalizeEventStatus(status: EventStatus | undefined): EventStatus {
    const validStatuses: EventStatus[] = ["draft", "published", "cancelled", "past"];
    if (status && validStatuses.includes(status)) {
        return status;
    }
    return "draft";
}

export class Event implements IEvent {
    id: number;
    title: string;
    description: string;
    location: string;
    category: string;
    status: EventStatus;
    capacity: number;
    startDateTime: Date;
    endDateTime: Date;
    organizerId: string;
    createdAt: Date;
    updatedAt: Date;

    constructor(id: number, data: CreateEventData) {
        const title = normalizeTitle(data.title);
        const description = normalizeDescription(data.description);
        const location = normalizeLocation(data.location);

        this.id = id;
        this.title = title;
        this.description = description;
        this.location = location;
        this.category = normalizeCategory(data.category);
        this.status = normalizeEventStatus(data.status);
        this.capacity = data.capacity ?? 0;
        this.startDateTime = data.startDateTime;
        this.endDateTime = data.endDateTime;
        this.organizerId = data.organizerId;
        this.createdAt = data.createdAt ?? new Date();
        this.updatedAt = data.updatedAt ?? new Date();
    }
}

export function createEvent(id: number, data: CreateEventData): IEvent {
    return new Event(id, data);
}

export function updateEvent(event: IEvent, changes: Partial<Pick<IEvent, "title" | "description" | "location" | "category" | "status" | "capacity" | "startDateTime" | "endDateTime">>): IEvent {
    if (typeof changes.title !== "undefined") {
        event.title = normalizeTitle(changes.title);
    }
    if (typeof changes.description !== "undefined") {
        event.description = normalizeDescription(changes.description);
    }
    if (typeof changes.location !== "undefined") {
        event.location = normalizeLocation(changes.location);
    }
    if (typeof changes.category !== "undefined") {
        event.category = normalizeCategory(changes.category);
    }
    if (typeof changes.status !== "undefined") {
        event.status = normalizeEventStatus(changes.status);
    }
    if (typeof changes.capacity !== "undefined") {
        event.capacity = changes.capacity;
    }
    if (typeof changes.startDateTime !== "undefined") {
        event.startDateTime = changes.startDateTime;
    }
    if (typeof changes.endDateTime !== "undefined") {
        event.endDateTime = changes.endDateTime;
    }
    event.updatedAt = new Date();
    return event;
}

export function toEvent(model: {
    id: number;
    title: string;
    description: string;
    location: string;
    category: string;
    status: EventStatus;
    capacity: number;
    startDateTime: Date;
    endDateTime: Date;
    organizerId: string;
    createdAt: Date;
    updatedAt: Date;
}): IEvent {
    return {
        id: model.id,
        title: model.title,
        description: model.description,
        location: model.location,
        category: normalizeCategory(model.category),
        status: normalizeEventStatus(model.status),
        capacity: model.capacity,
        startDateTime: model.startDateTime,
        endDateTime: model.endDateTime,
        organizerId: model.organizerId,
        createdAt: model.createdAt,
        updatedAt: model.updatedAt
    }
}
