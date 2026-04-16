import type { Result } from "../lib/result";
import type { IEvent, EventStatus } from "../model/Event";
import type { IRSVP, RSVPStatus } from "../model/RSVP";
import type { IComment } from "../model/Comment";
import type { CommentError, EventError, RSVPError } from "../service/errors";

export type CreateEventInput = {
    title: string;
    description: string;
    location: string;
    category: string;
    capacity?: number;
    startDateTime: Date;
    endDateTime: Date;
    organizerId: string;
};

export type CreateRSVPInput = {
    eventId: number;
    userId: string;
    status?: RSVPStatus;
    createdAt?: Date;
};

export type CreateCommentInput = {
    eventId: number;
    userId: string;
    content: string;
};

export type EventFilterStatus = "all" | EventStatus;
export type RSVPFilterStatus = "all" | RSVPStatus;

export interface IEventRepository {
    createEvent(data: CreateEventInput): Promise<Result<IEvent, EventError>>;
    getEventById(id: number): Promise<Result<IEvent, EventError>>;
    getEventsByOrganizer(
        organizerId: string,
    ): Promise<Result<IEvent[], EventError>>;
    getAllEvents(): Promise<Result<IEvent[], EventError>>;
    getAllArchived(): Promise<Result<IEvent[], EventError>>;
    deleteEvent(id: number): Promise<Result<void, EventError>>;
    updateEvent(
        id: number,
        data: CreateEventInput,
    ): Promise<Result<void, EventError>>;
    updateEventStatus(
        id: number,
        status: EventStatus,
    ): Promise<Result<void, EventError>>;
    listEvents(
        filterStatus?: EventFilterStatus,
    ): Promise<Result<IEvent[], EventError>>;
}

export interface IRSVPRepository {
    createRSVP(data: CreateRSVPInput): Promise<Result<IRSVP, RSVPError>>;
    getRSVPById(id: number): Promise<Result<IRSVP, RSVPError>>;
    getRSVPByEventAndUser(eventId: number, userId: string): Promise<Result<IRSVP, RSVPError>>;
    updateRSVPStatus(id: number, status: RSVPStatus): Promise<Result<IRSVP, RSVPError>>;
    getRSVPByEventAndUser(
        eventId: number,
        userId: string,
    ): Promise<Result<IRSVP, RSVPError>>;
    listAllRSVPs(): Promise<Result<IRSVP[], RSVPError>>;
    listRSVPsByEvent(
        eventId: number,
        filterStatus?: RSVPFilterStatus,
    ): Promise<Result<IRSVP[], RSVPError>>;
    listRSVPsByUser(
        userId: string,
        filterStatus?: RSVPFilterStatus,
    ): Promise<Result<IRSVP[], RSVPError>>;
    updateRSVPStatus(
        id: number,
        status: RSVPStatus,
    ): Promise<Result<IRSVP, RSVPError>>;
}

export interface ICommentRepository {
    createComment(data: CreateCommentInput): Promise<Result<IComment, CommentError>>;
    getCommentById(id: number): Promise<Result<IComment, CommentError>>;
    listCommentsByEvent(eventId: number): Promise<Result<IComment[], CommentError>>;
    deleteComment(id: number): Promise<Result<IComment, CommentError>>;
}
