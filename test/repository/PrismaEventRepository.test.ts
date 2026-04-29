import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../src/generated/prisma/client";
import { CreatePrismaEventRepository } from "../../src/repository/PrismaEventRepository";

describe("PrismaEventRepository", () => {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  const prisma = new PrismaClient({ adapter });
  const repository = CreatePrismaEventRepository(prisma);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("loads a user's RSVPs with event details", async () => {
    const result = await repository.listRSVPsWithEventsByUser("user-reader");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.map(({ rsvp, event }) => ({
          rsvpStatus: rsvp.status,
          title: event.title,
        })),
      ).toEqual([
        { rsvpStatus: "going", title: "JavaScript Lightning Talks" },
        { rsvpStatus: "going", title: "Community Picnic" },
        { rsvpStatus: "going", title: "Spring Hack Night" },
        { rsvpStatus: "waitlisted", title: "Design Critique Circle" },
      ]);
    }
  });
});
