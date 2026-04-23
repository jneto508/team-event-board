import type { Response } from "express";
import type {
  IAppBrowserSession,
  IAuthenticatedUserSession,
} from "../session/AppSession";
import type { IEventService } from "../service/EventService";
import type { IRSVPService } from "../service/RSVPService";
import type { EventError } from "../service/errors";
import type { ILoggingService } from "../service/LoggingService";
import type { SavedEventService } from "../service/SavedEventService";
import type { UserRole } from "../auth/User";
import type { IAttendeeListService } from "../service/AttendeeListService";
import type {
  EventCommentView,
  IEventCommentsService,
} from "../service/EventCommentsService";

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

export interface IEventController {
  showNewEventForm(res: Response, session: IAppBrowserSession): Promise<void>;
  createEventFromForm(
    res: Response,
    input: {
      title: string;
      description: string;
      location: string;
      category: string;
      capacity: string;
      startDateTime: string;
      endDateTime: string;
    },
    organizerId: string,
    session: IAppBrowserSession,
  ): Promise<void>;
  toggleSave(res: Response, eventId: number, userId: string, userRole: string): Promise<void>;
  toggleRSVP(
    res: Response,
    eventId: number,
    currentUser: IAuthenticatedUserSession
  ): Promise<void>;
    toggleRSVPInline(
    res: Response,
    eventId: number,
    currentUser: IAuthenticatedUserSession
  ): Promise<void>;
  showArchivePage(
    res: Response,
    session: IAppBrowserSession,
    category?: string,
    htmx?: boolean,
  ): Promise<void>;
  showSavedEvents(
    res: Response,
    userId: string,
    session: IAppBrowserSession
  ): Promise<void>;
  searchEvents(
    res: Response,
    query: string,
    session: IAppBrowserSession
  ): Promise<void>;
  showEventDetail(
    res: Response,
    eventId: number,
    actor: { userId: string; role: UserRole },
    session: IAppBrowserSession,
  ): Promise<void>;

  showAttendeeList(
    res: Response,
    eventId: number,
    actor: { userId: string; role: UserRole },
    session: IAppBrowserSession,
  ): Promise<void>;
  showEditEventForm(
    res: Response,
    eventId: number,
    actingUserId: string,
    actingUserRole: UserRole,
    session: IAppBrowserSession,
  ): Promise<void>;
  updateEventFromForm(
    res: Response,
    eventId: number,
    input: {
      title: string;
      description: string;
      location: string;
      category: string;
      capacity: string;
      startDateTime: string;
      endDateTime: string;
    },
    actingUserId: string,
    actingUserRole: UserRole,
    session: IAppBrowserSession,
  ): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
    private readonly savedEventService: SavedEventService,
    private readonly rsvpService: IRSVPService,
    private readonly attendeeListService: IAttendeeListService,
    private readonly eventCommentsService: IEventCommentsService,
    private readonly logger: ILoggingService,
  ) {}

  private isEventError(value: unknown): value is EventError {
    return (
      typeof value === "object" &&
      value !== null &&
      "name" in value &&
      "message" in value
    );
  }

  private mapErrorStatus(error: EventError): number {
    if (error.name === "EventNotFound") return 404;
    if (error.name === "Forbidden") return 403;
    if (error.name === "InvalidEventData" || error.name === "ValidationError" || error.name === "InvalidEventState")
      return 400;
    return 500;
  }

  private async renderRsvpTogglePartial(
    res: Response,
    eventId: number,
    viewerUserId: string,
    pageError: string | null = null,
  ): Promise<void> {
    const eventResult = await this.eventCommentsService.getEventViewModel(
      eventId,
      viewerUserId,
    );

    if (eventResult.ok === false) {
      res.status(500).render("partials/error", {
        message: eventResult.value.message,
        layout: false,
      });
      return;
    }

    res.render("events/partials/rsvp-toggle", {
      layout: false,
      event: eventResult.value,
      pageError,
    });
  }

  async toggleSave(
    res: Response,
    eventId: number,
    userId: string,
    userRole: string
  ): Promise<void> {
    this.logger.info("Toggling saved event");

    
    const result = await this.savedEventService.toggleSave(
      userId,
      eventId,
      userRole
    );

    if (!result.ok) {
      res.status(400).render("partials/error", {
        message: "Unable to toggle saved event.",
        layout: false,
      });
      return;
    }
  
    res.render("partials/saveButton", {
      eventId,
      status: result.value,
      layout: false,
    });
  }

  async showSavedEvents(
    res: Response,
    userId: string,
    session: IAppBrowserSession
  ): Promise<void> {
    this.logger.info("Showing saved events");
  
    const userRole = session.authenticatedUser?.role ?? "guest";
    const result = await this.savedEventService.getSavedEvents(userId, userRole);
  
    if (!result.ok) {
      res.status(500).render("partials/error", {
        message: "Unable to load saved events.",
        layout: false,
      });
      return;
    }
  
    res.render("events/saved", {
      session,
      events: result.value,
    });
  }
  async searchEvents(
    res: Response,
    query: string,
    session: IAppBrowserSession,
  ): Promise<void> {
    this.logger.info("Searching events");
  
    const result = await this.eventService.searchEvents(query);
  
    if (!result.ok) {
      const error = result.value;
  
      if (this.isEventError(error) && error.name === "InvalidSearchInput") {
        res.render("partials/error", {
          message: error.message,
          layout: false,
        });
        return;
      }
  
      res.status(500).render("partials/error", {
        message: "Unable to search events.",
        layout: false,
      });
      return;
    }
  
    const user = session.authenticatedUser;
  
    let savedEventIds: number[] = [];
  
    if (user) {
      const savedResult = await this.savedEventService.getSavedEvents(
        user.userId,
        user.role
      );
  
      if (savedResult.ok) {
        savedEventIds = savedResult.value.map((e: { id: number }) => e.id);
      }
    }

    const enrichedResult = await this.eventCommentsService.enrichEventsForViewer(
      result.value,
      session.authenticatedUser?.userId,
    );

    if (enrichedResult.ok === false) {
      res.status(500).render("partials/error", {
        message: enrichedResult.value.message,
        layout: false,
      });
      return;
    }
  
    res.render("partials/eventList", {
      events: enrichedResult.value,
      savedEventIds, 
      layout: false,
    });
  }
  async showEventDetail(
    res: Response,
    eventId: number,
    actor: { userId: string; role: UserRole },
    session: IAppBrowserSession,
  ): Promise<void> {
    this.logger.info(`Showing event detail for event ${eventId}`);

    const result = await this.eventService.getEventById(eventId, actor);

    if (!result.ok && this.isEventError(result.value)) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      res.status(status).render("partials/error", {
        message: error.message,
        layout: false,
      });
      return;
    }

    if (!result.ok) {
      res.status(500).render("partials/error", {
        message: "Unable to load event.",
        layout: false,
      });
      return;
    }

    let comments: EventCommentView[] = [];
    let pageError: string | null = null;

    if (result.value.status === "published") {
      const commentsResult = await this.eventCommentsService.getEventCommentsPage(
        String(eventId),
        actor.userId,
      );

      if (commentsResult.ok === false) {
        pageError = commentsResult.value.message;
        this.logger.warn(`Unable to load event comments: ${commentsResult.value.message}`);
      } else {
        comments = commentsResult.value.comments;
      }
    }

    const eventViewResult = await this.eventCommentsService.getEventViewModel(
      eventId,
      actor.userId,
    );

    const eventForView = eventViewResult.ok
      ? { ...result.value, ...eventViewResult.value }
      : result.value;

    res.render("events/show", {
      session,
      event: eventForView,
      comments,
      currentUserId: actor.userId,
      commentValue: "",
      pageError,
      formatRelativeTime,
    });
  }

  async showAttendeeList(
    res: Response,
    eventId: number,
    actor: { userId: string; role: UserRole },
    session: IAppBrowserSession,
  ): Promise<void> {
    this.logger.info(`Showing attendee list for event ${eventId}`);

    const result = await this.attendeeListService.getAttendeeList(eventId, actor);

    if (!result.ok && this.isEventError(result.value)) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      res.status(status).render("partials/error", {
        message: error.message,
        layout: false,
      });
      return;
    }

    if (!result.ok) {
      res.status(500).render("partials/error", {
        message: "Unable to load attendee list.",
        layout: false,
      });
      return;
    }

    res.render("events/attendees", {
      session,
      attendeeList: result.value,
      eventId,
      pageError: null,
    });
  }

  async showNewEventForm(
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void> {
    this.logger.info("Showing new event form");
    res.render("events/new", {
      session,
      pageError: null,
      formValues: {
        title: "",
        description: "",
        location: "",
        category: "",
        capacity: "",
        startDateTime: "",
        endDateTime: "",
      },
    });
  }

  async createEventFromForm(
    res: Response,
    input: {
      title: string;
      description: string;
      location: string;
      category: string;
      capacity: string;
      startDateTime: string;
      endDateTime: string;
    },
    organizerId: string,
    session: IAppBrowserSession,
  ): Promise<void> {
    this.logger.info("Creating event from form");
    const result = await this.eventService.createEvent({
      title: input.title,
      description: input.description,
      location: input.location,
      category: input.category,
      capacity:
        input.capacity !== "" ? parseInt(input.capacity, 10) : undefined,
      startDateTime: new Date(input.startDateTime),
      endDateTime: new Date(input.endDateTime),
      organizerId,
    });

    if (!result.ok && this.isEventError(result.value)) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      res.status(status).render("partials/error", {
        message: error.message,
        layout: false,
      });
      return;
    }

    if(!result.ok) {
      res.status(500).render("partials/error", { message: "Unable to create event.", layout: false});
      return;
    }
    
    res.redirect("/home");
  }

  async showEditEventForm(
    res: Response,
    eventId: number,
    actingUserId: string,
    actingUserRole: UserRole,
    session: IAppBrowserSession,
  ): Promise<void> {
    this.logger.info(`Showing edit form for event ${eventId}`);

    if (actingUserRole === "user") {
      res.status(403).render("partials/error", {
        message: "Members are not allowed to edit events.",
        layout: false,
      });
      return;
    }

    const result = await this.eventService.getEventById(eventId, {
      userId: actingUserId,
      role: actingUserRole,
    });
    if (!result.ok) {
      res.status(404).render("partials/error", {
        message: `Event ${eventId} not found.`,
        layout: false,
      });
      return;
    }

    const event = result.value;

    if (event.status === "cancelled" || event.status === "past") {
      res.status(403).render("partials/error", {
        message: "Cannot edit a cancelled or past event.",
        layout: false,
      });
      return;
    }

    if (actingUserRole === "staff" && event.organizerId !== actingUserId) {
      res.status(403).render("partials/error", {
        message: "You can only edit events you organized.",
        layout: false,
      });
      return;
    }

    const pad = (d: Date) => d.toISOString().slice(0, 16);

    res.render("events/edit", {
      session,
      pageError: null,
      eventId,
      formValues: {
        title: event.title,
        description: event.description,
        location: event.location,
        category: event.category,
        capacity: event.capacity > 0 ? String(event.capacity) : "",
        startDateTime: pad(event.startDateTime),
        endDateTime: pad(event.endDateTime),
      },
    });
  }

  async updateEventFromForm(
    res: Response,
    eventId: number,
    input: {
      title: string;
      description: string;
      location: string;
      category: string;
      capacity: string;
      startDateTime: string;
      endDateTime: string;
    },
    actingUserId: string,
    actingUserRole: UserRole,
    _session: IAppBrowserSession,
  ): Promise<void> {
    this.logger.info(`Updating event ${eventId} from form`);

    const result = await this.eventService.updateEvent(
      eventId,
      {
        title: input.title,
        description: input.description,
        location: input.location,
        category: input.category,
        capacity: input.capacity !== "" ? parseInt(input.capacity, 10) : undefined,
        startDateTime: new Date(input.startDateTime),
        endDateTime: new Date(input.endDateTime),
        organizerId: actingUserId,
      },
      actingUserId,
      actingUserRole,
    );

    if (!result.ok && this.isEventError(result.value)) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      res.status(status).render("partials/error", {
        message: error.message,
        layout: false,
      });
      return;
    }

    if (!result.ok) {
      res.status(500).render("partials/error", {
        message: "Unable to update event.",
        layout: false,
      });
      return;
    }

    res.redirect("/home");
  }

  async showArchivePage(
    res: Response,
    session: IAppBrowserSession,
    category?: string,
    htmx: boolean = false,
  ): Promise<void> {
    this.logger.info("Showing archived events page");

    const result = await this.eventService.getArchivedEvents(category);

    if (!result.ok && this.isEventError(result.value)) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      res.status(status).render("partials/error", {
        message: error.message,
        layout: false,
      });
      return;
    }

    if (!result.ok) {
      res.status(500).render("partials/error", {
        message: "Unable to load archived events.",
        layout: false,
      });
      return;
    }

    const categories = Array.from(
      new Set(result.value.map((event) => event.category)),
    ).sort();

    const viewModel = {
      session,
      pageError: null,
      events: result.value,
      categories,
      selectedCategory: String(category ?? "").trim().toLowerCase(),
    };

    if (htmx) {
      res.render("events/partials/archive-list", {
        layout: false,
        events: viewModel.events,
      });
      return;
    }

    res.render("events/archive", viewModel);
  }

  async toggleRSVP(
    res: Response,
    eventId: number,
    currentUser: IAuthenticatedUserSession,
  ): Promise<void> {
    this.logger.info(`Toggling RSVP for event ${eventId}`);

    const result = await this.rsvpService.toggleRSVP(eventId, currentUser);
    if (result.ok === false) {
      const error = result.value;
      const status =
        error.name === "EventNotFound"
          ? 404
          : error.name === "UnexpectedDependencyError"
            ? 500
            : 400;

      res.status(status).json({
        error: error.message,
      });
      return;
    }

    res.json(result.value);
  }

  async toggleRSVPInline(
    res: Response,
    eventId: number,
    currentUser: IAuthenticatedUserSession,
  ): Promise<void> {
    const result = await this.rsvpService.toggleRSVP(eventId, currentUser);

    if (result.ok === false) {
      const error = result.value;
      const status =
        error.name === "EventNotFound"
          ? 404
          : error.name === "UnexpectedDependencyError"
            ? 500
            : 400;

      res.status(status);
      await this.renderRsvpTogglePartial(
        res,
        eventId,
        currentUser.userId,
        error.message,
      );
      return;
    }

    await this.renderRsvpTogglePartial(
      res,
      eventId,
      currentUser.userId,
      null,
    );
  }
}

export function CreateEventController(
  eventService: IEventService,
  savedEventService: SavedEventService,
  rsvpService: IRSVPService,
  attendeeListService: IAttendeeListService,
  eventCommentsService: IEventCommentsService,
  logger: ILoggingService,
): IEventController {
  return new EventController(
    eventService,
    savedEventService,
    rsvpService,
    attendeeListService,
    eventCommentsService,
    logger,
  );
}
