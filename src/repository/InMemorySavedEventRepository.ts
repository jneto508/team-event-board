import { Ok } from "../lib/result";
import type { ISavedEventRepository } from "./SavedEventRepository";
import type { Result } from "../lib/result";
import type { EventError } from "../service/errors";

export class InMemorySavedEventRepository implements ISavedEventRepository {
  private saved: { userId: string; eventId: number }[] = [];

  async toggleSave(
    userId: string,
    eventId: number
  ): Promise<Result<"saved" | "unsaved", EventError>> {

    const index = this.saved.findIndex(
      s => s.userId === userId && s.eventId === eventId
    );

    
    if (index !== -1) {
      this.saved.splice(index, 1);
      return Ok("unsaved" as const );
    }

    
    this.saved.push({ userId, eventId });
    return Ok("saved" as const);
  }

  async getSavedEventsByUser(
    userId: string
  ): Promise<Result<number[], EventError>> {

    const eventIds = this.saved
      .filter(s => s.userId === userId)
      .map(s => s.eventId);

    return Ok(eventIds);
  }
}

export function CreateInMemorySavedEventRepository(): ISavedEventRepository {
    return new InMemorySavedEventRepository();
  }