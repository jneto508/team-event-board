import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { IEventService } from "../service/EventService";

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
}

class EventController implements IEventController {
    constructor(private readonly eventService: IEventService) {}

    async showNewEventForm(
        res: Response,
        session: IAppBrowserSession,
    ): Promise<void> {
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
        const result = await this.eventService.createEvent({
            title: input.title,
            description: input.description,
            location: input.location,
            category: input.category,
            capacity:
                input.capacity !== ""
                    ? parseInt(input.capacity, 10)
                    : undefined,
            startDateTime: new Date(input.startDateTime),
            endDateTime: new Date(input.endDateTime),
            organizerId,
        });

        if (!result.ok) {
            res.status(422).render("events/new", {
                session,
                pageError: result.value.message,
                formValues: input,
            });
            return;
        }

        res.redirect("/home");
    }
}

export function CreateEventController(
    eventService: IEventService,
): IEventController {
    return new EventController(eventService);
}
