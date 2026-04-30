import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

beforeAll(async () => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "displayName" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Event" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "location" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "capacity" INTEGER,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "startDateTime" DATETIME NOT NULL,
      "endDateTime" DATETIME NOT NULL,
      "organizerId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "RSVP" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "eventId" INTEGER NOT NULL,
      "userId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'going',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Comment" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "eventId" INTEGER NOT NULL,
      "userId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Comment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "SavedEvent" (
      "userId" TEXT NOT NULL,
      "eventId" INTEGER NOT NULL,
      PRIMARY KEY ("userId", "eventId"),
      CONSTRAINT "SavedEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "Event_organizerId_idx" ON "Event"("organizerId")`,
    `CREATE INDEX IF NOT EXISTS "Event_status_endDateTime_idx" ON "Event"("status", "endDateTime")`,
    `CREATE INDEX IF NOT EXISTS "Event_category_status_idx" ON "Event"("category", "status")`,
    `CREATE INDEX IF NOT EXISTS "RSVP_userId_status_idx" ON "RSVP"("userId", "status")`,
    `CREATE INDEX IF NOT EXISTS "RSVP_eventId_status_createdAt_idx" ON "RSVP"("eventId", "status", "createdAt")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "RSVP_eventId_userId_key" ON "RSVP"("eventId", "userId")`,
    `CREATE INDEX IF NOT EXISTS "Comment_eventId_createdAt_idx" ON "Comment"("eventId", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Comment_userId_idx" ON "Comment"("userId")`,
    `CREATE INDEX IF NOT EXISTS "SavedEvent_eventId_idx" ON "SavedEvent"("eventId")`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
});

beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.savedEvent.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.rSVP.deleteMany();
  await prisma.event.deleteMany();

  await prisma.user.createMany({
    data: [
      {
        id: "user-admin",
        email: "admin@app.test",
        displayName: "Avery Admin",
        role: "admin",
        passwordHash:
          "2b3bbad4e6798f50a57dba85090dcf6b:9ff6bd0f903e8df9fec42b869554f2bdcfa373690da56432623b82b0173aaf9371716d7fee6734e7080bd3021ed18af49ce723081e20180abdd2d0835f44d301",
      },
      {
        id: "user-staff",
        email: "staff@app.test",
        displayName: "Sam Staff",
        role: "staff",
        passwordHash:
          "2b3bbad4e6798f50a57dba85090dcf6b:9ff6bd0f903e8df9fec42b869554f2bdcfa373690da56432623b82b0173aaf9371716d7fee6734e7080bd3021ed18af49ce723081e20180abdd2d0835f44d301",
      },
      {
        id: "user-reader",
        email: "user@app.test",
        displayName: "Una User",
        role: "user",
        passwordHash:
          "2b3bbad4e6798f50a57dba85090dcf6b:9ff6bd0f903e8df9fec42b869554f2bdcfa373690da56432623b82b0173aaf9371716d7fee6734e7080bd3021ed18af49ce723081e20180abdd2d0835f44d301",
      },
      {
        id: "user-member2",
        email: "member2@app.test",
        displayName: "Mia Member",
        role: "user",
        passwordHash:
          "2b3bbad4e6798f50a57dba85090dcf6b:9ff6bd0f903e8df9fec42b869554f2bdcfa373690da56432623b82b0173aaf9371716d7fee6734e7080bd3021ed18af49ce723081e20180abdd2d0835f44d301",
      },
    ],
  });

  await prisma.event.createMany({
    data: [
      {
        id: 1,
        title: "Spring Hack Night",
        description: "A collaborative build night for new project ideas.",
        location: "Innovation Lab",
        category: "technology",
        status: "published",
        capacity: 40,
        startDateTime: new Date("2026-05-15T18:00:00.000Z"),
        endDateTime: new Date("2026-05-15T21:00:00.000Z"),
        organizerId: "user-staff",
        createdAt: new Date("2026-03-10T15:00:00.000Z"),
        updatedAt: new Date("2026-03-10T15:00:00.000Z"),
      },
      {
        id: 2,
        title: "Design Critique Circle",
        description: "Peer review session for in-progress mockups.",
        location: "Studio B",
        category: "design",
        status: "published",
        capacity: 18,
        startDateTime: new Date("2026-05-01T22:00:00.000Z"),
        endDateTime: new Date("2026-05-02T00:00:00.000Z"),
        organizerId: "user-reader",
        createdAt: new Date("2026-03-12T16:00:00.000Z"),
        updatedAt: new Date("2026-03-12T16:00:00.000Z"),
      },
      {
        id: 3,
        title: "JavaScript Lightning Talks",
        description: "Short talks on frontend and backend patterns.",
        location: "Room 204",
        category: "technology",
        status: "past",
        capacity: 60,
        startDateTime: new Date("2026-03-15T23:00:00.000Z"),
        endDateTime: new Date("2026-03-16T01:00:00.000Z"),
        organizerId: "user-staff",
        createdAt: new Date("2026-02-20T14:00:00.000Z"),
        updatedAt: new Date("2026-03-16T01:30:00.000Z"),
      },
      {
        id: 4,
        title: "Community Picnic",
        description: "Outdoor meetup for members and guests.",
        location: "Riverside Park",
        category: "community",
        status: "cancelled",
        capacity: 80,
        startDateTime: new Date("2026-04-05T16:00:00.000Z"),
        endDateTime: new Date("2026-04-05T19:00:00.000Z"),
        organizerId: "user-staff",
        createdAt: new Date("2026-02-25T14:00:00.000Z"),
        updatedAt: new Date("2026-04-01T13:00:00.000Z"),
      },
      {
        id: 5,
        title: "Organizer Planning Session",
        description: "Draft planning session for organizers before publication.",
        location: "Conference Room A",
        category: "planning",
        status: "draft",
        capacity: 12,
        startDateTime: new Date("2026-05-20T17:00:00.000Z"),
        endDateTime: new Date("2026-05-20T18:30:00.000Z"),
        organizerId: "user-staff",
        createdAt: new Date("2026-04-10T12:00:00.000Z"),
        updatedAt: new Date("2026-04-10T12:00:00.000Z"),
      },
    ],
  });

  await prisma.rSVP.createMany({
    data: [
      {
        id: 1,
        eventId: 1,
        userId: "user-reader",
        status: "going",
        createdAt: new Date("2026-03-20T10:00:00.000Z"),
      },
      {
        id: 2,
        eventId: 2,
        userId: "user-reader",
        status: "waitlisted",
        createdAt: new Date("2026-03-21T10:00:00.000Z"),
      },
      {
        id: 3,
        eventId: 3,
        userId: "user-reader",
        status: "going",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
      {
        id: 4,
        eventId: 4,
        userId: "user-reader",
        status: "going",
        createdAt: new Date("2026-03-05T10:00:00.000Z"),
      },
      {
        id: 5,
        eventId: 1,
        userId: "user-member2",
        status: "going",
        createdAt: new Date("2026-03-20T11:00:00.000Z"),
      },
      {
        id: 6,
        eventId: 1,
        userId: "user-admin",
        status: "waitlisted",
        createdAt: new Date("2026-03-20T12:00:00.000Z"),
      },
    ],
  });

  await prisma.comment.createMany({
    data: [
      {
        id: 1,
        eventId: 1,
        userId: "user-reader",
        content: "Excited for this event!",
        createdAt: new Date("2026-03-22T10:00:00.000Z"),
      },
      {
        id: 2,
        eventId: 1,
        userId: "user-staff",
        content: "Looking forward to seeing everyone there.",
        createdAt: new Date("2026-03-22T11:00:00.000Z"),
      },
      {
        id: 3,
        eventId: 2,
        userId: "user-reader",
        content: "Please bring one mockup or flow you want feedback on.",
        createdAt: new Date("2026-03-23T10:00:00.000Z"),
      },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
