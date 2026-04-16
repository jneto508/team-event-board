import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { IEventService } from "../service/EventService";
import type { EventError } from "../service/errors";
import type { ILoggingService } from "../service/LoggingService";
import type { SavedEventService } from "../service/SavedEventService";

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
  toggleSave(res: Response, eventId: number, userId: string): Promise<void>;

  showSavedEvents(
    res: Response,
    userId: string,
    session: IAppBrowserSession
  ): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
    private readonly savedEventService: SavedEventService,
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

  async toggleSave(
    res: Response,
    eventId: number,
    userId: string
  ): Promise<void> {
    this.logger.info("Toggling saved event");
  
    const result = await this.savedEventService.toggleSave(userId, eventId);
  
    if (!result.ok) {
      res.status(400).render("partials/error", {
        message: "Unable to toggle saved event.",
        layout: false,
      });
      return;
    }
  
    res.json({
      status: result.value,
    });
  }

  async showSavedEvents(
    res: Response,
    userId: string,
    session: IAppBrowserSession
  ): Promise<void> {
    this.logger.info("Showing saved events");
  
    const result = await this.savedEventService.getSavedEvents(userId);
  
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
}

export function CreateEventController(
  eventService: IEventService,
  savedEventService: SavedEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, savedEventService, logger);
}