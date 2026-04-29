

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

beforeEach(async () => {
  await prisma.comment.deleteMany();
  await prisma.rSVP.deleteMany();
  await prisma.event.deleteMany();

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