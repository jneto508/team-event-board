import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";

describe("InMemoryEventRepository", () => {
  it("lists a member's RSVPs from in-memory data", async () => {
    const repository = CreateInMemoryEventRepository();

    const result = await repository.listRSVPsByUser("user-reader");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(4);
      expect(result.value.map((rsvp) => rsvp.eventId)).toEqual([1, 2, 3, 4]);
    }
  });

  it("updates RSVP status in memory", async () => {
    const repository = CreateInMemoryEventRepository();

    const updated = await repository.updateRSVPStatus(1, "cancelled");
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.status).toBe("cancelled");
    }

    const fetched = await repository.getRSVPById(1);
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.value.status).toBe("cancelled");
    }
  });
});
