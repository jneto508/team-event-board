import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
import { EventService } from "../../src/service/EventService";

describe("EventService archive behavior", () => {
  it("transitions expired events to past and leaves non-expired events unchanged", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = new EventService(repository);

    const expiredResult = await repository.createEvent({
      title: "Expired Planning Session",
      description: "Should move to archive",
      location: "Room A",
      category: "planning",
      startDateTime: new Date("2026-04-20T15:00:00.000Z"),
      endDateTime: new Date("2026-04-20T16:00:00.000Z"),
      organizerId: "user-staff",
    });
    const upcomingResult = await repository.createEvent({
      title: "Future Planning Session",
      description: "Should remain active",
      location: "Room B",
      category: "planning",
      startDateTime: new Date("2026-04-24T15:00:00.000Z"),
      endDateTime: new Date("2026-04-24T16:00:00.000Z"),
      organizerId: "user-staff",
    });

    expect(expiredResult.ok && upcomingResult.ok).toBe(true);
    if (!expiredResult.ok || !upcomingResult.ok) {
      return;
    }
    expiredResult.value.status = "published";
    upcomingResult.value.status = "published";

    const archiveResult = await service.archiveExpiredEvents(
      new Date("2026-04-22T12:00:00.000Z"),
    );

    expect(archiveResult.ok).toBe(true);
    if (archiveResult.ok) {
      expect(archiveResult.value).toBe(1);
    }

    const expiredEvent = await repository.getEventById(expiredResult.value.id);
    const upcomingEvent = await repository.getEventById(upcomingResult.value.id);

    expect(expiredEvent.ok).toBe(true);
    expect(upcomingEvent.ok).toBe(true);

    if (expiredEvent.ok) {
      expect(expiredEvent.value.status).toBe("past");
    }
    if (upcomingEvent.ok) {
      expect(upcomingEvent.value.status).toBe("published");
    }
  });

  it("returns archived results sorted by end time and filtered by category", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = new EventService(repository);

    const oldestTech = await repository.createEvent({
      title: "Old Tech Talk",
      description: "Archived tech event",
      location: "Room 1",
      category: "technology",
      startDateTime: new Date("2026-03-10T16:00:00.000Z"),
      endDateTime: new Date("2026-03-10T17:00:00.000Z"),
      organizerId: "user-staff",
    });
    const newestTech = await repository.createEvent({
      title: "Recent Tech Meetup",
      description: "Most recent archived tech event",
      location: "Room 2",
      category: "technology",
      startDateTime: new Date("2026-04-18T16:00:00.000Z"),
      endDateTime: new Date("2026-04-18T17:00:00.000Z"),
      organizerId: "user-staff",
    });
    const designArchive = await repository.createEvent({
      title: "Design Retrospective",
      description: "Archived design event",
      location: "Studio",
      category: "design",
      startDateTime: new Date("2026-04-12T16:00:00.000Z"),
      endDateTime: new Date("2026-04-12T17:00:00.000Z"),
      organizerId: "user-staff",
    });

    expect(oldestTech.ok && newestTech.ok && designArchive.ok).toBe(true);
    if (!oldestTech.ok || !newestTech.ok || !designArchive.ok) {
      return;
    }
    oldestTech.value.status = "past";
    newestTech.value.status = "cancelled";
    designArchive.value.status = "past";

    const filtered = await service.getArchivedEvents("technology");

    expect(filtered.ok).toBe(true);
    if (filtered.ok) {
      expect(filtered.value.map((event) => event.title)).toEqual([
        "Recent Tech Meetup",
        "JavaScript Lightning Talks",
        "Old Tech Talk",
      ]);
    }

    const allArchived = await service.getArchivedEvents();
    expect(allArchived.ok).toBe(true);
    if (allArchived.ok) {
      expect(allArchived.value.some((event) => event.title === "Design Retrospective")).toBe(true);
      expect(allArchived.value.some((event) => event.title === "Recent Tech Meetup")).toBe(true);
    }
  });
});
