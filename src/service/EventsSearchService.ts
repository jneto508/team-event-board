import type { IEventRepository } from "../repository/EventRepository";
import type { IEvent } from "../model/Event";
import type { Result } from "../lib/result";
import { Ok, Err } from "../lib/result";
import type { EventError } from "./errors";

export class EventService {
  constructor(private eventRepo: IEventRepository) {}

  async searchEvents(query: string): Promise<Result<IEvent[], EventError>> {
    const result = await this.eventRepo.getAllEvents();

    if (!result.ok) {
      return Err(result.value);
    }

    const events = result.value;
    const now = new Date();

    const q = (query || "").toLowerCase().trim();

    const publishedUpcoming = events.filter(event => {
      return (
        event.status === "published" &&
        event.startDateTime > now
      );
    });

    if (q === "") {
      return Ok(publishedUpcoming);
    }

    const filter = publishedUpcoming.filter(event => {
      return (
        event.title.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q)
      );
    });

    return Ok(filter);
  }
}