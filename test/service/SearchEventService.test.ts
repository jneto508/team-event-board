import { EventService } from "../../src/service/EventService";
import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
describe("EventService.searchEvents", () => {
  let service: EventService;
  let repo: ReturnType<typeof CreateInMemoryEventRepository>;

  beforeEach(async () => {
    repo = CreateInMemoryEventRepository();
    service = new EventService(repo);

    await repo.createEvent({
      title: "Basketball Game",
      description: "Fun sports event",
      location: "Gym",
      category: "sports",
      startDateTime: new Date(Date.now() + 1000000),
      endDateTime: new Date(Date.now() + 2000000),
      organizerId: "1",
    });

    await repo.createEvent({
      title: "Music Concert",
      description: "Live band",
      location: "Hall",
      category: "music",
      startDateTime: new Date(Date.now() + 1000000),
      endDateTime: new Date(Date.now() + 2000000),
      organizerId: "1",
    });

    const all = await repo.getAllEvents();
    if (all.ok) {
      all.value.forEach(e => (e.status = "published"));
    }
  });

  test("returns matching results", async () => {
    const result = await service.searchEvents("basketball");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(1);
      expect(result.value[0].title).toContain("Basketball");
    }
  });

  test("returns empty array when no results", async () => {
    const result = await service.searchEvents("zzz");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(0);
    }
  });

  test("returns all events for empty query", async () => {
    const result = await service.searchEvents("");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("returns error for invalid input", async () => {
    const result = await service.searchEvents((null as unknown) as string);

    expect(result.ok).toBe(false);
  });
});