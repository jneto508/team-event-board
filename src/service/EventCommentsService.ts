import { Err, Ok, type Result } from "../lib/result";
import type { IUserRepository } from "../auth/UserRepository";
import type { IComment } from "../model/Comment";
import type { ICommentRepository, IEventRepository } from "../repository/EventRepository";
import {
  CommentAuthorizationRequired,
  CommentNotFound,
  EventNotFound,
  InvalidCommentData,
  type CommentError,
} from "./errors";

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
};

export type EventCommentsPage = {
  event: PublishedEventSummary;
  comments: EventCommentView[];
};

export interface IEventCommentsService {
  listPublishedEvents(): Promise<Result<PublishedEventSummary[], CommentError>>;
  getEventCommentsPage(
    eventId: string,
    viewerUserId?: string,
  ): Promise<Result<EventCommentsPage, CommentError>>;
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

class EventCommentsService implements IEventCommentsService {
  constructor(
    private readonly events: IEventRepository,
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
    if (!authorResult.ok) {
      return Err(UnexpectedCommentDependencyError(authorResult.value.message));
    }

    const eventResult = await this.events.getEventById(comment.eventId);
    if (!eventResult.ok) {
      return Err(EventNotFound(eventResult.value.message));
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

  async listPublishedEvents(): Promise<Result<PublishedEventSummary[], CommentError>> {
    const result = await this.events.listEvents("published");
    if (!result.ok) {
      return Err(UnexpectedCommentDependencyError(result.value.message));
    }

    return Ok(
      result.value
        .slice()
        .sort((left, right) => left.startDateTime.getTime() - right.startDateTime.getTime())
        .map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          category: event.category,
          startDateTime: event.startDateTime,
          endDateTime: event.endDateTime,
          organizerId: event.organizerId,
        })),
    );
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
    if (!eventResult.ok || eventResult.value.status !== "published") {
      return Err(EventNotFound("Published event not found."));
    }

    const commentsResult = await this.comments.listCommentsByEvent(parsedEventId);
    if (!commentsResult.ok) {
      return Err(UnexpectedCommentDependencyError(commentsResult.value.message));
    }

    const views: EventCommentView[] = [];
    for (const comment of commentsResult.value) {
      const viewResult = await this.toCommentView(comment, viewerUserId);
      if (!viewResult.ok) {
        return viewResult;
      }
      views.push(viewResult.value);
    }

    return Ok({
      event: {
        id: eventResult.value.id,
        title: eventResult.value.title,
        description: eventResult.value.description,
        location: eventResult.value.location,
        category: eventResult.value.category,
        startDateTime: eventResult.value.startDateTime,
        endDateTime: eventResult.value.endDateTime,
        organizerId: eventResult.value.organizerId,
      },
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
    if (!eventResult.ok || eventResult.value.status !== "published") {
      return Err(EventNotFound("Published event not found."));
    }

    const userResult = await this.users.findById(normalizedUserId);
    if (!userResult.ok) {
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
    if (!actorResult.ok) {
      return Err(UnexpectedCommentDependencyError(actorResult.value.message));
    }
    if (!actorResult.value) {
      return Err(CommentAuthorizationRequired("Only authenticated users can delete comments."));
    }

    const commentResult = await this.comments.getCommentById(parsedCommentId);
    if (!commentResult.ok) {
      return Err(CommentNotFound(commentResult.value.message));
    }

    const eventResult = await this.events.getEventById(commentResult.value.eventId);
    if (!eventResult.ok) {
      return Err(EventNotFound(eventResult.value.message));
    }

    const canDelete =
      actorResult.value.role === "admin" ||
      commentResult.value.userId === normalizedActorUserId ||
      eventResult.value.organizerId === normalizedActorUserId;

    if (!canDelete) {
      return Err(
        CommentAuthorizationRequired(
          "You can only delete your own comments unless you organize this event or are an admin.",
        ),
      );
    }

    return this.comments.deleteComment(parsedCommentId);
  }
}

export function CreateEventCommentsService(
  events: IEventRepository,
  comments: ICommentRepository,
  users: IUserRepository,
): IEventCommentsService {
  return new EventCommentsService(events, comments, users);
}
