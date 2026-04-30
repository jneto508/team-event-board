import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../src/generated/prisma/client";
import { CreatePrismaEventRepository } from "../../src/repository/PrismaEventRepository";

describe("PrismaEventRepository comments", () => {
  const adapter = new PrismaBetterSQLite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  const prisma = new PrismaClient({ adapter });
  const repository = CreatePrismaEventRepository(prisma);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists event comments in chronological order from Prisma", async () => {
    const result = await repository.listCommentsByEvent(1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.map((comment) => ({
          userId: comment.userId,
          content: comment.content,
        })),
      ).toEqual([
        {
          userId: "user-reader",
          content: "Excited for this event!",
        },
        {
          userId: "user-staff",
          content: "Looking forward to seeing everyone there.",
        },
      ]);
    }
  });

  it("creates and deletes comments in Prisma", async () => {
    const created = await repository.createComment({
      eventId: 1,
      userId: "user-admin",
      content: "Can I help with setup before the event starts?",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const removed = await repository.deleteComment(created.value.id);
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.value.content).toBe(
        "Can I help with setup before the event starts?",
      );
    }
  });
});
