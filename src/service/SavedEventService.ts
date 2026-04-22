import type { ISavedEventRepository } from "../repository/SavedEventRepository";
import type { IEventRepository } from "../repository/EventRepository";
import type { Result } from "../lib/result";
import { Ok, Err } from "../lib/result";
import type { EventError } from "./errors";
import { EventNotFound, InvalidSaveOperation } from "./errors";
import type { IEvent } from "../model/Event";

export class SavedEventService {
  constructor(
    private readonly savedRepo: ISavedEventRepository,
    private readonly eventRepo: IEventRepository
  ) {}

  async toggleSave(
    userId: string,
    eventId: number,
    userRole: string
  ): Promise<Result<"saved" | "unsaved", EventError>> {

    if (userRole !== "user") {
      return Err(
        InvalidSaveOperation("Only regular users can save events.")
      );
    }

    const eventResult = await this.eventRepo.getEventById(eventId);
    if (!eventResult.ok) {
      return Err(EventNotFound(`Event with id ${eventId} not found.`));
    }

    const event = eventResult.value;

    if (event.status === "cancelled") {
      return Err(
        InvalidSaveOperation("Cannot save a cancelled event.")
      );
    }

    return this.savedRepo.toggleSave(userId, eventId);
  }

  async getSavedEvents(
    userId: string,
    userRole: string
  ): Promise<Result<IEvent[], EventError>> {

    if (userRole !== "user") {
      return Err(
        InvalidSaveOperation("Only regular users have saved events.")
      );
    }

    const savedIdsResult = await this.savedRepo.getSavedEventsByUser(userId);
    if (!savedIdsResult.ok) {
      return Err(savedIdsResult.value);
    }

    const allEventsResult = await this.eventRepo.getAllEvents();
    if (!allEventsResult.ok) {
      return Err(allEventsResult.value);
    }

    const savedIds = savedIdsResult.value;
    const events = allEventsResult.value;

    const savedEvents = events.filter(event =>
      savedIds.includes(event.id)
    );

    return Ok(savedEvents);
  }
}