import type { Response } from "express";
import type {
  IAppBrowserSession,
  IAuthenticatedUserSession,
} from "../session/AppSession";
import type { IEventService } from "../service/EventService";
import type { IRSVPService } from "../service/RSVPService";
import type { EventError } from "../service/errors";
import { ILoggingService } from "../service/LoggingService";

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
  showArchivePage(
    res: Response,
    session: IAppBrowserSession,
    category?: string,
  ): Promise<void>;
  toggleRSVP(
    res: Response,
    eventId: number,
    currentUser: IAuthenticatedUserSession,
  ): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
    private readonly rsvpService: IRSVPService,
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
 
  async showArchivePage(
    res: Response,
    session: IAppBrowserSession,
    category?: string,
  ): Promise<void> {
    this.logger.info("Showing archived events page");

    const result = await this.eventService.getArchivedEvents(category);

    if (!result.ok) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      res.status(status).render("partials/error", {
        message: error.message,
        layout: false,
      });
      return;
    }

    const categories = Array.from(
      new Set(result.value.map((event) => event.category)),
    ).sort();

    res.render("events/archive", {
      session,
      pageError: null,
      events: result.value,
      categories,
      selectedCategory: String(category ?? "").trim().toLowerCase(),
    });
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
}

export function CreateEventController(
  eventService: IEventService,
  rsvpService: IRSVPService,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, rsvpService, logger);
}
