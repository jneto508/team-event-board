import { PrismaClient } from "../src/generated/prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });