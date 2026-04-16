import { Err, Ok, type Result } from "../lib/result";
import { createComment, type IComment } from "../model/Comment";
import { createEvent, updateEvent, type IEvent } from "../model/Event";
import { createRSVP, type IRSVP, type RSVPStatus } from "../model/RSVP";
import type {
  CreateCommentInput,
  CreateEventInput,
  CreateRSVPInput,
  EventFilterStatus,
  ICommentRepository,
  IEventRepository,
  IRSVPRepository,
  RSVPFilterStatus,
} from "./EventRepository";
import {
  CommentNotFound,
  EventNotFound,
  RSVPNotFound,
  type CommentError,
  type EventError,
  type RSVPError,
} from "../service/errors";

function UnexpectedEventDependencyError(message: string): EventError {
  return { name: "UnexpectedDependencyError", message };
}

function UnexpectedRsvpDependencyError(message: string): RSVPError {
  return { name: "UnexpectedDependencyError", message };
}

function UnexpectedCommentDependencyError(message: string): CommentError {
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
    organizerId: "user-reader",
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
];

const DEMO_COMMENTS: IComment[] = [
  createComment(1, {
    eventId: 1,
    userId: "user-reader",
    content: "Will there be time for team matching before we start coding?",
    createdAt: new Date("2026-04-14T13:00:00.000Z"),
  }),
  createComment(2, {
    eventId: 1,
    userId: "user-staff",
    content: "Yes. We will start with quick intros and topic pitches at the top of the hour.",
    createdAt: new Date("2026-04-14T13:12:00.000Z"),
  }),
  createComment(3, {
    eventId: 2,
    userId: "user-admin",
    content: "Please bring one mockup or flow you want feedback on.",
    createdAt: new Date("2026-04-14T11:45:00.000Z"),
  }),
];

function matchesEventStatusFilter(
  event: IEvent,
  filterStatus: EventFilterStatus = "all",
): boolean {
  return filterStatus === "all" ? true : event.status === filterStatus;
}

function matchesRsvpStatusFilter(
  rsvp: IRSVP,
  filterStatus: RSVPFilterStatus = "all",
): boolean {
  return filterStatus === "all" ? true : rsvp.status === filterStatus;
}

class InMemoryEventRepository
  implements IEventRepository, IRSVPRepository, ICommentRepository
{
  private nextEventId: number;
  private nextRsvpId: number;
  private nextCommentId: number;

  constructor(
    private readonly events: IEvent[],
    private readonly rsvps: IRSVP[],
    private readonly comments: IComment[],
  ) {
    this.nextEventId = events.reduce((max, event) => Math.max(max, event.id), 0) + 1;
    this.nextRsvpId = rsvps.reduce((max, rsvp) => Math.max(max, rsvp.id), 0) + 1;
    this.nextCommentId =
      comments.reduce((max, comment) => Math.max(max, comment.id), 0) + 1;
  }

  async createEvent(data: CreateEventInput): Promise<Result<IEvent, EventError>> {
    try {
      const event = createEvent(this.nextEventId++, data);
      this.events.push(event);
      return Ok(event);
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to create event."));
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
      return Err(UnexpectedEventDependencyError("Failed to load event."));
    }
  }

  async getEventsByOrganizer(
    organizerId: string,
  ): Promise<Result<IEvent[], EventError>> {
    try {
      return Ok(this.events.filter((event) => event.organizerId === organizerId));
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to load organizer events."));
    }
  }

  async updateEvent(
    id: number,
    data: CreateEventInput,
  ): Promise<Result<void, EventError>> {
    try {
      const event = this.events.find((candidate) => candidate.id === id);
      if (!event) {
        return Err(EventNotFound(`Event ${id} was not found.`));
      }

      updateEvent(event, {
        title: data.title,
        description: data.description,
        location: data.location,
        category: data.category,
        capacity: data.capacity,
        startDateTime: data.startDateTime,
        endDateTime: data.endDateTime,
      });
      return Ok(undefined);
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to update event."));
    }
  }

  async getAllEvents(): Promise<Result<IEvent[], EventError>> {
    try {
      return Ok([...this.events]);
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to list events."));
    }
  }

  async getAllArchived(): Promise<Result<IEvent[], EventError>> {
    try {
      return Ok(this.events.filter((event) => event.status === "past" || event.status === "cancelled"));
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to list archived events."));
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
      return Err(UnexpectedEventDependencyError("Failed to delete event."));
    }
  }

  async listEvents(
    filterStatus: EventFilterStatus = "all",
  ): Promise<Result<IEvent[], EventError>> {
    try {
      return Ok(this.events.filter((event) => matchesEventStatusFilter(event, filterStatus)));
    } catch {
      return Err(UnexpectedEventDependencyError("Failed to filter events."));
    }
  }

  async createRSVP(data: CreateRSVPInput): Promise<Result<IRSVP, RSVPError>> {
    try {
      const rsvp = createRSVP(this.nextRsvpId++, data);
      this.rsvps.push(rsvp);
      return Ok(rsvp);
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to create RSVP."));
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
      return Err(UnexpectedRsvpDependencyError("Unable to load RSVP."));
    }
  }

  async getRSVPByEventAndUser(
    eventId: number,
    userId: string,
  ): Promise<Result<IRSVP, RSVPError>> {
    try {
      const rsvp = this.rsvps.find(
        (candidate) => candidate.eventId === eventId && candidate.userId === userId,
      );
      if (!rsvp) {
        return Err(RSVPNotFound(`No RSVP found for event ${eventId}.`));
      }
      return Ok(rsvp);
    } catch {
      return Err(UnexpectedRsvpDependencyError("Unable to load RSVP."));
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

  async createComment(data: CreateCommentInput): Promise<Result<IComment, CommentError>> {
    try {
      const comment = createComment(this.nextCommentId++, data);
      this.comments.push(comment);
      return Ok(comment);
    } catch {
      return Err(UnexpectedCommentDependencyError("Unable to create comment."));
    }
  }

  async getCommentById(id: number): Promise<Result<IComment, CommentError>> {
    try {
      const comment = this.comments.find((candidate) => candidate.id === id);
      if (!comment) {
        return Err(CommentNotFound(`Comment ${id} was not found.`));
      }
      return Ok(comment);
    } catch {
      return Err(UnexpectedCommentDependencyError("Unable to load comment."));
    }
  }

  async listCommentsByEvent(eventId: number): Promise<Result<IComment[], CommentError>> {
    try {
      return Ok(
        this.comments
          .filter((comment) => comment.eventId === eventId)
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
      );
    } catch {
      return Err(UnexpectedCommentDependencyError("Unable to list comments."));
    }
  }

  async deleteComment(id: number): Promise<Result<IComment, CommentError>> {
    try {
      const index = this.comments.findIndex((comment) => comment.id === id);
      if (index === -1) {
        return Err(CommentNotFound(`Comment ${id} was not found.`));
      }
      const [removed] = this.comments.splice(index, 1);
      return Ok(removed);
    } catch {
      return Err(UnexpectedCommentDependencyError("Unable to delete comment."));
    }
  }
}

export function CreateInMemoryEventRepository():
  IEventRepository & IRSVPRepository & ICommentRepository {
  return new InMemoryEventRepository([...DEMO_EVENTS], [...DEMO_RSVPS], [...DEMO_COMMENTS]);
}

export { DEMO_COMMENTS, DEMO_EVENTS, DEMO_RSVPS };
