import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { IEventService } from "../service/EventService";
import type { EventError } from "../service/errors";
import { ILoggingService } from "../service/LoggingService";
import type { UserRole } from "../auth/User";

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
    if (error.name === "InvalidEventData" || error.name === "ValidationError")
      return 400;
    return 500;
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

    const result = await this.eventService.getEventById(eventId);
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
}

export function CreateEventController(
  eventService: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, logger);
}
