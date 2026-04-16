import type { ISavedEventRepository } from "../repository/SavedEventRepository";
import type { IEventRepository } from "../repository/EventRepository";
import type { Result } from "../lib/result";
import { Ok, Err } from "../lib/result";
import type { EventError } from "./errors";
import { EventNotFound } from "./errors";
import type { IEvent } from "../model/Event";

export class SavedEventService {
  constructor(
    private readonly savedRepo: ISavedEventRepository,
    private readonly eventRepo: IEventRepository
  ) {}

  async toggleSave(
    userId: string,
    eventId: number
  ): Promise<Result<"saved" | "unsaved", EventError>> {

    // Check event exists
    const eventResult = await this.eventRepo.getEventById(eventId);
    if (!eventResult.ok) {
      return Err(EventNotFound(`Event with id ${eventId} not found.`));
    }

    return this.savedRepo.toggleSave(userId, eventId);
  }

  async getSavedEvents(
    userId: string
  ): Promise<Result<IEvent[], EventError>> {

    const savedIdsResult = await this.savedRepo.getSavedEventsByUser(userId);
    if (savedIdsResult.ok === false) {
      return Err(savedIdsResult.value);
    }

    const allEventsResult = await this.eventRepo.getAllEvents();
    if (allEventsResult.ok === false) {
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
