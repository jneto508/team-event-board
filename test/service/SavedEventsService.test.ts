import { SavedEventService } from "../../src/service/SavedEventService";
import { InMemorySavedEventRepository } from "../../src/repository/InMemorySavedEventRepository";
import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";

describe("SavedEventService", () => {
  let service: SavedEventService;
  let eventRepo: ReturnType<typeof CreateInMemoryEventRepository>;
  let publishedEventId: number;
  let cancelledEventId: number;

  beforeEach(async () => {
    eventRepo = CreateInMemoryEventRepository();
    const savedRepo = new InMemorySavedEventRepository();

    service = new SavedEventService(savedRepo, eventRepo);

    const created1 = await eventRepo.createEvent({
      title: "Event 1",
      description: "Test",
      location: "Test",
      category: "Test",
      capacity: 10,
      startDateTime: new Date(Date.now() + 10000),
      endDateTime: new Date(Date.now() + 20000),
      organizerId: "org1",
    });

    if (created1.ok) {
      created1.value.status = "published";
      publishedEventId = created1.value.id;
    }

    const created2 = await eventRepo.createEvent({
      title: "Cancelled Event",
      description: "Test",
      location: "Test",
      category: "Test",
      capacity: 10,
      startDateTime: new Date(),
      endDateTime: new Date(),
      organizerId: "org1",
    });

    if (created2.ok) {
      created2.value.status = "cancelled";
      cancelledEventId = created2.value.id;
    }
  });

  test("toggles save and unsave", async () => {
    const res1 = await service.toggleSave("user1", publishedEventId, "user");
    expect(res1.ok).toBe(true);
    if (res1.ok) expect(res1.value).toBe("saved");

    const res2 = await service.toggleSave("user1", publishedEventId, "user");
    expect(res2.ok).toBe(true);
    if (res2.ok) expect(res2.value).toBe("unsaved");
  });

  test("returns saved events list", async () => {
    await service.toggleSave("user1", publishedEventId, "user");

    const result = await service.getSavedEvents("user1", "user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(1);
      expect(result.value[0].id).toBe(publishedEventId);
    }
  });

  test("rejects cancelled event", async () => {
    const result = await service.toggleSave("user1", cancelledEventId, "user");

    expect(result.ok).toBe(false);
  });

  test("rejects non-user roles", async () => {
    const result = await service.toggleSave("admin1", publishedEventId, "admin");

    expect(result.ok).toBe(false);
  });
});