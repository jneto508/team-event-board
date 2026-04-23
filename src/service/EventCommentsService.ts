import { Err, Ok, type Result } from "../lib/result";
import type { IUserRepository } from "../auth/UserRepository";
import type { IComment } from "../model/Comment";
import type { ICommentRepository, IEventRepository, IRSVPRepository } from "../repository/EventRepository";
import {
  CommentAuthorizationRequired,
  CommentNotFound,
  InvalidCommentData,
  UnauthorizedCommentDeletion,
  type CommentError,
} from "./errors";
import type { IEvent, EventStatus } from "../model/Event";
import type { IRSVP, RSVPStatus } from "../model/RSVP";
import type { RSVPError } from "./errors";


export type EventCommentView = {
  id: number;
  eventId: number;
  userId: string;
  authorDisplayName: string;
  content: string;
  createdAt: Date;
  canDelete: boolean;
};

export type PublishedEventSummary = {
  id: number;
  title: string;
  description: string;
  location: string;
  category: string;
  startDateTime: Date;
  endDateTime: Date;
  organizerId: string;
  status: EventStatus;
  capacity: number;
  attendeeCount: number;
  waitlistCount: number;
  viewerRsvpStatus: RSVPStatus | null;
  canToggleRsvp: boolean;
};

export type EventCommentsPage = {
  event: PublishedEventSummary;
  comments: EventCommentView[];
};

export interface IEventCommentsService {
  listPublishedEvents(
    viewerUserId?: string,
  ): Promise<Result<PublishedEventSummary[], CommentError>>;
  getEventCommentsPage(
    eventId: string,
    viewerUserId?: string,
  ): Promise<Result<EventCommentsPage, CommentError>>;
  enrichEventsForViewer(
    events: IEvent[],
    viewerUserId?: string,
  ): Promise<Result<PublishedEventSummary[], CommentError>>;
  getEventViewModel(
    eventId: number,
    viewerUserId?: string,
  ): Promise<Result<PublishedEventSummary, CommentError>>;
  createComment(
    userId: string,
    eventId: string,
    content: string,
  ): Promise<Result<IComment, CommentError>>;
  deleteComment(
    actorUserId: string,
    commentId: string,
  ): Promise<Result<IComment, CommentError>>;
}

function UnexpectedCommentDependencyError(message: string): CommentError {
  return { name: "UnexpectedDependencyError", message };
}

function CommentEventNotFound(message: string): CommentError {
  return { name: "EventNotFound", message };
}

class EventCommentsService implements IEventCommentsService {
  constructor(
    private readonly events: IEventRepository,
    private readonly rsvps: IRSVPRepository,
    private readonly comments: ICommentRepository,
    private readonly users: IUserRepository,
  ) {}

  private async isAdmin(userId: string): Promise<boolean> {
    const userResult = await this.users.findById(userId);
    return userResult.ok && !!userResult.value && userResult.value.role === "admin";
  }

  private async toCommentView(
    comment: IComment,
    viewerUserId?: string,
  ): Promise<Result<EventCommentView, CommentError>> {
    const authorResult = await this.users.findById(comment.userId);
    if (authorResult.ok === false) {
      return Err(UnexpectedCommentDependencyError(authorResult.value.message));
    }

    const eventResult = await this.events.getEventById(comment.eventId);
    if (eventResult.ok === false) {
      return Err(CommentEventNotFound(`Event ${comment.eventId} was not found.`));
    }

    const viewerIsAdmin = viewerUserId ? await this.isAdmin(viewerUserId) : false;
    const canDelete =
      !!viewerUserId &&
      (viewerUserId === comment.userId ||
        viewerUserId === eventResult.value.organizerId ||
        viewerIsAdmin);

    return Ok({
      id: comment.id,
      eventId: comment.eventId,
      userId: comment.userId,
      authorDisplayName: authorResult.value?.displayName ?? "Unknown User",
      content: comment.content,
      createdAt: comment.createdAt,
      canDelete,
    });
  }

  private async canToggleRsvp(
    event: IEvent,
    viewerUserId?: string,
  ): Promise<boolean> {
    if (!viewerUserId) return false;

    const viewerResult = await this.users.findById(viewerUserId);
    if (viewerResult.ok === false || !viewerResult.value) return false;

    if (viewerResult.value.role !== "user") return false;
    if (event.organizerId === viewerUserId) return false;
    if (event.status === "cancelled" || event.status === "past") return false;
    if (event.endDateTime <= new Date()) return false;

    return true;
  }

  private async toPublishedEventSummary(
    event: IEvent,
    viewerUserId?: string,
  ): Promise<Result<PublishedEventSummary, CommentError>> {
  
    const rsvpsResult = await this.rsvps.listRSVPsByEvent(event.id);
    if (!rsvpsResult.ok) {
      const error = rsvpsResult.value as RSVPError;
      return Err(
        UnexpectedCommentDependencyError(error.message)
      );
    }
  
    const attendeeCount = rsvpsResult.value.filter(
      (rsvp) => rsvp.status === "going"
    ).length;
  
    const waitlistCount = rsvpsResult.value.filter(
      (rsvp) => rsvp.status === "waitlisted"
    ).length;
  
    let viewerRsvpStatus: RSVPStatus | null = null;
  
    if (viewerUserId) {
      const viewerRsvpResult = await this.rsvps.getRSVPByEventAndUser(
        event.id,
        viewerUserId
      );
  
      if (viewerRsvpResult.ok) {
        viewerRsvpStatus = viewerRsvpResult.value.status;
      } else {
        const error = viewerRsvpResult.value as RSVPError;
      
        if (error.name !== "RSVPNotFound") {
          return Err(
            UnexpectedCommentDependencyError(error.message)
          );
        }
      }
      
    }
  
    return Ok({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      category: event.category,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      organizerId: event.organizerId,
      status: event.status,
      capacity: event.capacity,
      attendeeCount,
      waitlistCount,
      viewerRsvpStatus,
      canToggleRsvp: await this.canToggleRsvp(event, viewerUserId),
    });
  }

  async enrichEventsForViewer(
    events: IEvent[],
    viewerUserId?: string,
  ): Promise<Result<PublishedEventSummary[], CommentError>> {
    const summaries: PublishedEventSummary[] = [];

    for (const event of events) {
      const summaryResult = await this.toPublishedEventSummary(event, viewerUserId);
      if (summaryResult.ok === false) {
        return Err(summaryResult.value);
      }
      summaries.push(summaryResult.value);
    }

    return Ok(summaries);
  }

  async getEventViewModel(
    eventId: number,
    viewerUserId?: string,
  ): Promise<Result<PublishedEventSummary, CommentError>> {
    const eventResult = await this.events.getEventById(eventId);
    if (eventResult.ok === false) {
      return Err(CommentEventNotFound(eventResult.value.message));
    }

    return this.toPublishedEventSummary(eventResult.value, viewerUserId);
  }

  async listPublishedEvents(viewerUserId?: string): Promise<Result<PublishedEventSummary[], CommentError>> {
    const result = await this.events.listEvents("published");
    if (result.ok === false) {
      return Err(UnexpectedCommentDependencyError(result.value.message));
    }

    const sorted = result.value
      .slice()
      .sort((left, right) => left.startDateTime.getTime() - right.startDateTime.getTime());

    return this.enrichEventsForViewer(sorted, viewerUserId);
  }


  async getEventCommentsPage(
    eventId: string,
    viewerUserId?: string,
  ): Promise<Result<EventCommentsPage, CommentError>> {
    const parsedEventId = Number.parseInt(eventId, 10);
    if (!Number.isInteger(parsedEventId) || parsedEventId <= 0) {
      return Err(InvalidCommentData("A valid event id is required."));
    }

    const eventResult = await this.events.getEventById(parsedEventId);
    if (eventResult.ok === false || eventResult.value.status !== "published") {
      return Err(CommentEventNotFound("Published event not found."));
    }

    const commentsResult = await this.comments.listCommentsByEvent(parsedEventId);
    if (commentsResult.ok === false) {
      return Err(UnexpectedCommentDependencyError(commentsResult.value.message));
    }

    const views: EventCommentView[] = [];
    for (const comment of commentsResult.value) {
      const viewResult = await this.toCommentView(comment, viewerUserId);
      if (viewResult.ok === false) {
        return Err(viewResult.value);
      }
      views.push(viewResult.value);
    }

    const eventViewResult = await this.toPublishedEventSummary(
      eventResult.value,
      viewerUserId,
    );
    if (eventViewResult.ok === false) {
      return Err(eventViewResult.value);
    }

    return Ok({
      event: eventViewResult.value,
      comments: views,
    });

  }

  async createComment(
    userId: string,
    eventId: string,
    content: string,
  ): Promise<Result<IComment, CommentError>> {
    const normalizedUserId = userId.trim();
    const normalizedContent = content.trim();
    const parsedEventId = Number.parseInt(eventId, 10);

    if (!normalizedUserId) {
      return Err(InvalidCommentData("User id is required."));
    }
    if (!Number.isInteger(parsedEventId) || parsedEventId <= 0) {
      return Err(InvalidCommentData("A valid event id is required."));
    }
    if (!normalizedContent) {
      return Err(InvalidCommentData("Comment text is required."));
    }
    if (normalizedContent.length > 280) {
      return Err(InvalidCommentData("Comments must be 280 characters or fewer."));
    }

    const eventResult = await this.events.getEventById(parsedEventId);
    if (eventResult.ok === false || eventResult.value.status !== "published") {
      return Err(CommentEventNotFound("Published event not found."));
    }

    const userResult = await this.users.findById(normalizedUserId);
    if (userResult.ok === false) {
      return Err(UnexpectedCommentDependencyError(userResult.value.message));
    }
    if (!userResult.value) {
      return Err(CommentAuthorizationRequired("Only authenticated users can comment."));
    }

    return this.comments.createComment({
      eventId: parsedEventId,
      userId: normalizedUserId,
      content: normalizedContent,
    });
  }

  async deleteComment(
    actorUserId: string,
    commentId: string,
  ): Promise<Result<IComment, CommentError>> {
    const normalizedActorUserId = actorUserId.trim();
    const parsedCommentId = Number.parseInt(commentId, 10);

    if (!normalizedActorUserId) {
      return Err(InvalidCommentData("Actor user id is required."));
    }
    if (!Number.isInteger(parsedCommentId) || parsedCommentId <= 0) {
      return Err(InvalidCommentData("A valid comment id is required."));
    }

    const actorResult = await this.users.findById(normalizedActorUserId);
    if (actorResult.ok === false) {
      return Err(UnexpectedCommentDependencyError(actorResult.value.message));
    }
    if (!actorResult.value) {
      return Err(CommentAuthorizationRequired("Only authenticated users can delete comments."));
    }

    const commentResult = await this.comments.getCommentById(parsedCommentId);
    if (commentResult.ok === false) {
      return Err(CommentNotFound(`Comment ${parsedCommentId} was not found.`));
    }

    const eventResult = await this.events.getEventById(commentResult.value.eventId);
    if (eventResult.ok === false) {
      return Err(CommentEventNotFound(`Event ${commentResult.value.eventId} was not found.`));
    }

    const canDelete =
      actorResult.value.role === "admin" ||
      commentResult.value.userId === normalizedActorUserId ||
      eventResult.value.organizerId === normalizedActorUserId;

    if (!canDelete) {
      return Err(
        UnauthorizedCommentDeletion(
          "You can only delete your own comments unless you organize this event or are an admin.",
        ),
      );
    }

    return this.comments.deleteComment(parsedCommentId);
  }
}

export function CreateEventCommentsService(
  events: IEventRepository,
  rsvps: IRSVPRepository,
  comments: ICommentRepository,
  users: IUserRepository,
): IEventCommentsService {
  return new EventCommentsService(events, rsvps, comments, users);
}
