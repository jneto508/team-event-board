import { Ok, Err, type Result } from "../lib/result";
import { createEvent, type IEvent, type EventStatus } from "../model/Event";
import { createRSVP, type IRSVP, type RSVPStatus } from "../model/RSVP";
import type {
  CreateEventInput,
  CreateRSVPInput,
  EventFilterStatus,
  IEventRepository,
  IRSVPRepository,
  RSVPFilterStatus,
} from "./EventRepository";
import {
  EventNotFound,
  RSVPNotFound,
  UnexpectedDependencyError,
  type EventError,
  type RSVPError,
} from "../service/errors";

function UnexpectedRsvpDependencyError(message: string): RSVPError {
  return { name: "UnexpectedDependencyError", message };
}

const DEMO_EVENTS: IEvent[] = [
  createEvent(1, {
    title: "Spring Hack Night",
    description: "A collaborative build night for new project ideas.",
    location: "Innovation Lab",
    category: "technology",
    status: "published",
    capacity: 40,
    startDateTime: new Date("2026-05-01T18:00:00.000Z"),
    endDateTime: new Date("2026-05-01T21:00:00.000Z"),
    organizerId: "user-staff",
    createdAt: new Date("2026-03-10T15:00:00.000Z"),
    updatedAt: new Date("2026-03-10T15:00:00.000Z"),
  }),
  createEvent(2, {
    title: "Design Critique Circle",
    description: "Peer review session for in-progress mockups.",
    location: "Studio B",
    category: "design",
    status: "published",
    capacity: 18,
    startDateTime: new Date("2026-04-20T22:00:00.000Z"),
    endDateTime: new Date("2026-04-21T00:00:00.000Z"),
    organizerId: "user-staff",
    createdAt: new Date("2026-03-12T16:00:00.000Z"),
    updatedAt: new Date("2026-03-12T16:00:00.000Z"),
  }),
  createEvent(3, {
    title: "JavaScript Lightning Talks",
    description: "Short talks on frontend and backend patterns.",
    location: "Room 204",
    category: "technology",
    status: "past",
    capacity: 60,
    startDateTime: new Date("2026-03-15T23:00:00.000Z"),
    endDateTime: new Date("2026-03-16T01:00:00.000Z"),
    organizerId: "user-staff",
    createdAt: new Date("2026-02-20T14:00:00.000Z"),
    updatedAt: new Date("2026-03-16T01:30:00.000Z"),
  }),
  createEvent(4, {
    title: "Community Picnic",
    description: "Outdoor social gathering with games and food.",
    location: "Riverfront Park",
    category: "social",
    status: "cancelled",
    capacity: 80,
    startDateTime: new Date("2026-04-10T16:00:00.000Z"),
    endDateTime: new Date("2026-04-10T19:00:00.000Z"),
    organizerId: "user-staff",
    createdAt: new Date("2026-03-01T12:00:00.000Z"),
    updatedAt: new Date("2026-04-08T17:00:00.000Z"),
  }),
];

const DEMO_RSVPS: IRSVP[] = [
  createRSVP(1, {
    eventId: 1,
    userId: "user-reader",
    status: "going",
    createdAt: new Date("2026-03-20T10:00:00.000Z"),
  }),
  createRSVP(2, {
    eventId: 2,
    userId: "user-reader",
    status: "waitlisted",
    createdAt: new Date("2026-03-21T10:00:00.000Z"),
  }),
  createRSVP(3, {
    eventId: 3,
    userId: "user-reader",
    status: "going",
    createdAt: new Date("2026-02-25T10:00:00.000Z"),
  }),
  createRSVP(4, {
    eventId: 4,
    userId: "user-reader",
    status: "going",
    createdAt: new Date("2026-03-05T10:00:00.000Z"),
  }),
  createRSVP(5, {
    eventId: 1,
    userId: "user-staff",
    status: "going",
    createdAt: new Date("2026-03-22T10:00:00.000Z"),
  }),
];

function matchesEventStatusFilter(event: IEvent, filterStatus: EventFilterStatus = "all"): boolean {
  return filterStatus === "all" ? true : event.status === filterStatus;
}

function matchesRsvpStatusFilter(rsvp: IRSVP, filterStatus: RSVPFilterStatus = "all"): boolean {
  return filterStatus === "all" ? true : rsvp.status === filterStatus;
}

class InMemoryEventRepository implements IEventRepository, IRSVPRepository {
  private nextEventId: number;
  private nextRsvpId: number;

  constructor(
    private readonly events: IEvent[],
    private readonly rsvps: IRSVP[],
  ) {
    this.nextEventId = events.reduce((max, event) => Math.max(max, event.id), 0) + 1;
    this.nextRsvpId = rsvps.reduce((max, rsvp) => Math.max(max, rsvp.id), 0) + 1;
  }

  async createEvent(data: CreateEventInput): Promise<Result<IEvent, EventError>> {
    try {
      const event = createEvent(this.nextEventId++, {
        ...data,
        organizerId: data.organizerId,
      });
      this.events.push(event);
      return Ok(event);
    } catch {
      return Err(UnexpectedDependencyError("Unable to create the event."));
    }
  }

  async getEventById(id: number): Promise<Result<IEvent, EventError>> {
    try {
      const event = this.events.find((candidate) => candidate.id === id);
      if (!event) {
        return Err(EventNotFound(`Event ${id} was not found.`));
      }
      return Ok(event);
    } catch {
      return Err(UnexpectedDependencyError("Unable to load the event."));
    }
  }

  async getEventsByOrganizer(organizerId: string): Promise<Result<IEvent[], EventError>> {
    try {
      return Ok(this.events.filter((event) => event.organizerId === organizerId));
    } catch {
      return Err(UnexpectedDependencyError("Unable to load organizer events."));
    }
  }

  async getAllEvents(): Promise<Result<IEvent[], EventError>> {
    try {
      return Ok([...this.events]);
    } catch {
      return Err(UnexpectedDependencyError("Unable to load events."));
    }
  }

  async getAllArchived(): Promise<Result<IEvent[], EventError>> {
    try {
      return Ok(this.events.filter((event) => event.status === "past" || event.status === "cancelled"));
    } catch {
      return Err(UnexpectedDependencyError("Unable to load archived events."));
    }
  }

  async deleteEvent(id: number): Promise<Result<void, EventError>> {
    try {
      const index = this.events.findIndex((event) => event.id === id);
      if (index === -1) {
        return Err(EventNotFound(`Event ${id} was not found.`));
      }

      this.events.splice(index, 1);
      return Ok(undefined);
    } catch {
      return Err(UnexpectedDependencyError("Unable to delete the event."));
    }
  }

  async listEvents(filterStatus: EventFilterStatus = "all"): Promise<Result<IEvent[], EventError>> {
    try {
      return Ok(this.events.filter((event) => matchesEventStatusFilter(event, filterStatus)));
    } catch {
      return Err(UnexpectedDependencyError("Unable to list events."));
    }
  }

  async createRSVP(data: CreateRSVPInput): Promise<Result<IRSVP, RSVPError>> {
    try {
      const rsvp = createRSVP(this.nextRsvpId++, {
        eventId: data.eventId,
        userId: data.userId,
      });
      this.rsvps.push(rsvp);
      return Ok(rsvp);
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to create the RSVP."));
    }
  }

  async getRSVPById(id: number): Promise<Result<IRSVP, RSVPError>> {
    try {
      const rsvp = this.rsvps.find((candidate) => candidate.id === id);
      if (!rsvp) {
        return Err(RSVPNotFound(`RSVP ${id} was not found.`));
      }
      return Ok(rsvp);
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to load the RSVP."));
    }
  }

  async getRSVPByEventAndUser(eventId: number, userId: string): Promise<Result<IRSVP, RSVPError>> {
    try {
      const rsvp = this.rsvps.find(
        (candidate) => candidate.eventId === eventId && candidate.userId === userId,
      );
      if (!rsvp) {
        return Err(RSVPNotFound(`No RSVP found for event ${eventId}.`));
      }
      return Ok(rsvp);
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to load the RSVP."));
    }
  }

  async updateRSVPStatus(id: number, status: RSVPStatus): Promise<Result<IRSVP, RSVPError>> {
    try {
      const rsvp = this.rsvps.find((candidate) => candidate.id === id);
      if (!rsvp) {
        return Err(RSVPNotFound(`RSVP ${id} was not found.`));
      }
      rsvp.status = status;
      return Ok(rsvp);
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to update the RSVP."));
    }
  }

  async listAllRSVPs(): Promise<Result<IRSVP[], RSVPError>> {
    try {
      return Ok([...this.rsvps]);
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to list RSVPs."));
    }
  }

  async listRSVPsByEvent(
    eventId: number,
    filterStatus: RSVPFilterStatus = "all",
  ): Promise<Result<IRSVP[], RSVPError>> {
    try {
      return Ok(
        this.rsvps.filter(
          (rsvp) => rsvp.eventId === eventId && matchesRsvpStatusFilter(rsvp, filterStatus),
        ),
      );
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to list event RSVPs."));
    }
  }

  async listRSVPsByUser(
    userId: string,
    filterStatus: RSVPFilterStatus = "all",
  ): Promise<Result<IRSVP[], RSVPError>> {
    try {
      return Ok(
        this.rsvps.filter(
          (rsvp) => rsvp.userId === userId && matchesRsvpStatusFilter(rsvp, filterStatus),
        ),
      );
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to list user RSVPs."));
    }
  }
}

export function CreateInMemoryEventRepository(): IEventRepository & IRSVPRepository {
  return new InMemoryEventRepository([...DEMO_EVENTS], [...DEMO_RSVPS]);
}

export { DEMO_EVENTS, DEMO_RSVPS };
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
        const event = this.events.find(e => e.id === id);
        if (!event) {
            return Err(UnexpectedDependencyError(`Event with id ${id} not found.`));
        }
        return Ok(event);
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
