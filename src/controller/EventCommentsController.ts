import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type {
  EventCommentsPage,
  EventCommentView,
  IEventCommentsService,
  PublishedEventSummary,
} from "../service/EventCommentsService";
import { ILoggingService } from "../service/LoggingService";
import type { CommentError } from "../service/errors";

function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (elapsedSeconds < 60) return "just now";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}

export interface IEventCommentsController {
  showHome(res: Response, session: IAppBrowserSession): Promise<void>;
  showEventDetail(
    res: Response,
    eventId: string,
    viewerUserId: string,
    session: IAppBrowserSession,
  ): Promise<void>;
  createCommentFromForm(
    res: Response,
    input: { eventId: string; userId: string; content: string; htmx: boolean },
    session: IAppBrowserSession,
  ): Promise<void>;
  deleteCommentFromForm(
    res: Response,
    input: { eventId: string; commentId: string; actorUserId: string; htmx: boolean },
    session: IAppBrowserSession,
  ): Promise<void>;
}

class EventCommentsController implements IEventCommentsController {
  constructor(
    private readonly service: IEventCommentsService,
    private readonly logger: ILoggingService,
  ) {}

  private mapErrorStatus(error: CommentError): number {
    if (error.name === "EventNotFound" || error.name === "CommentNotFound") return 404;
    if (error.name === "InvalidCommentData" || error.name === "ValidationError") return 400;
    if (error.name === "AuthorizationRequired") return 403;
    return 500;
  }

  private async renderHome(
    res: Response,
    session: IAppBrowserSession,
    events: PublishedEventSummary[],
    pageError: string | null = null,
  ): Promise<void> {
    res.render("home", {
      session,
      pageError,
      publishedEvents: events,
    });
  }

  private async renderCommentsPanel(
    res: Response,
    page: EventCommentsPage,
    viewerUserId: string,
    options?: {
      pageError?: string | null;
      commentValue?: string;
      layout?: boolean;
    },
  ): Promise<void> {
    const comments = page.comments;
    res.render("events/partials/comments_panel", {
      layout: options?.layout ?? false,
      event: page.event,
      comments,
      currentUserId: viewerUserId,
      commentValue: options?.commentValue ?? "",
      pageError: options?.pageError ?? null,
      formatRelativeTime,
    });
  }

  private async renderEventDetail(
    res: Response,
    page: EventCommentsPage,
    viewerUserId: string,
    session: IAppBrowserSession,
    options?: {
      pageError?: string | null;
      commentValue?: string;
    },
  ): Promise<void> {
    res.render("events/show", {
      session,
      event: page.event,
      comments: page.comments,
      currentUserId: viewerUserId,
      pageError: options?.pageError ?? null,
      commentValue: options?.commentValue ?? "",
      formatRelativeTime,
    });
  }

  async showHome(res: Response, session: IAppBrowserSession): Promise<void> {
    const result = await this.service.listPublishedEvents();
    if (result.ok === false) {
      this.logger.error(`Unable to load published events: ${result.value.message}`);
      res.status(500);
      await this.renderHome(res, session, [], result.value.message);
      return;
    }

    await this.renderHome(res, session, result.value);
  }

  async showEventDetail(
    res: Response,
    eventId: string,
    viewerUserId: string,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.getEventCommentsPage(eventId, viewerUserId);
    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Unable to load event comments page: ${result.value.message}`);
      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    await this.renderEventDetail(res, result.value, viewerUserId, session);
  }

  async createCommentFromForm(
    res: Response,
    input: { eventId: string; userId: string; content: string; htmx: boolean },
    session: IAppBrowserSession,
  ): Promise<void> {
    const createResult = await this.service.createComment(
      input.userId,
      input.eventId,
      input.content,
    );

    const pageResult = await this.service.getEventCommentsPage(input.eventId, input.userId);
    if (pageResult.ok === false) {
      const status = this.mapErrorStatus(pageResult.value);
      res.status(status).render("partials/error", {
        message: pageResult.value.message,
        layout: false,
      });
      return;
    }

    if (createResult.ok === false) {
      const status = this.mapErrorStatus(createResult.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Unable to create comment: ${createResult.value.message}`);
      res.status(status);
      if (input.htmx) {
        await this.renderCommentsPanel(res, pageResult.value, input.userId, {
          pageError: createResult.value.message,
          commentValue: input.content,
        });
        return;
      }

      await this.renderEventDetail(res, pageResult.value, input.userId, session, {
        pageError: createResult.value.message,
        commentValue: input.content,
      });
      return;
    }

    if (input.htmx) {
      await this.renderCommentsPanel(res, pageResult.value, input.userId);
      return;
    }

    res.redirect(`/events/${input.eventId}`);
  }

  async deleteCommentFromForm(
    res: Response,
    input: { eventId: string; commentId: string; actorUserId: string; htmx: boolean },
    session: IAppBrowserSession,
  ): Promise<void> {
    const deleteResult = await this.service.deleteComment(input.actorUserId, input.commentId);
    const pageResult = await this.service.getEventCommentsPage(input.eventId, input.actorUserId);

    if (pageResult.ok === false) {
      const status = this.mapErrorStatus(pageResult.value);
      res.status(status).render("partials/error", {
        message: pageResult.value.message,
        layout: false,
      });
      return;
    }

    if (deleteResult.ok === false) {
      const status = this.mapErrorStatus(deleteResult.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Unable to delete comment: ${deleteResult.value.message}`);
      res.status(status);
      if (input.htmx) {
        await this.renderCommentsPanel(res, pageResult.value, input.actorUserId, {
          pageError: deleteResult.value.message,
        });
        return;
      }

      await this.renderEventDetail(res, pageResult.value, input.actorUserId, session, {
        pageError: deleteResult.value.message,
      });
      return;
    }

    if (input.htmx) {
      await this.renderCommentsPanel(res, pageResult.value, input.actorUserId);
      return;
    }

    res.redirect(`/events/${input.eventId}`);
  }
}

export function CreateEventCommentsController(
  service: IEventCommentsService,
  logger: ILoggingService,
): IEventCommentsController {
  return new EventCommentsController(service, logger);
}
