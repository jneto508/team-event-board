import type { Result } from "../lib/result";
import type { EventError } from "../service/errors";

export interface ISavedEventRepository {
  toggleSave(userId: string, eventId: number): Promise<Result<"saved" | "unsaved", EventError>>;
  getSavedEventsByUser(userId: string): Promise<Result<number[], EventError>>;
}