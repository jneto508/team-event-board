import { Ok, Err, type Result } from "../lib/result";
import type { EventError } from "../service/errors";
import type { ISavedEventRepository } from "./SavedEventRepository";
import { PrismaClient } from "../generated/prisma/client";

function UnexpectedSaveError(message: string): EventError {
  return {
    name: "UnexpectedDependencyError",
    message,
  } as EventError;
}

export class PrismaSavedEventRepository
  implements ISavedEventRepository
{
  constructor(
    private readonly prisma: PrismaClient
  ) {}

  async toggleSave(
    userId: string,
    eventId: number
  ): Promise<Result<"saved" | "unsaved", EventError>> {
    try {
      const existing =
        await this.prisma.savedEvent.findUnique({
          where: {
            userId_eventId: {
              userId,
              eventId,
            },
          },
        });

      if (existing) {
        await this.prisma.savedEvent.delete({
          where: {
            userId_eventId: {
              userId,
              eventId,
            },
          },
        });

        return Ok("unsaved" as const);
      }

      await this.prisma.savedEvent.create({
        data: {
          userId,
          eventId,
        },
      });

      return Ok("saved" as const);
    } catch {
      return Err(
        UnexpectedSaveError(
          "Failed to toggle saved event."
        )
      );
    }
  }

  async getSavedEventsByUser(
    userId: string
  ): Promise<Result<number[], EventError>> {
    try {
      const rows =
        await this.prisma.savedEvent.findMany({
          where: { userId },
        });

      return Ok(
        rows.map((row) => row.eventId)
      );
    } catch {
      return Err(
        UnexpectedSaveError(
          "Failed to load saved events."
        )
      );
    }
  }
}

export function CreatePrismaSavedEventRepository(
  prisma: PrismaClient
): ISavedEventRepository {
  return new PrismaSavedEventRepository(prisma);
}