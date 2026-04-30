import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";

describe("InMemoryEventRepository", () => {
  it("lists seeded published events from memory", async () => {
    const repository = CreateInMemoryEventRepository();

    const result = await repository.listEvents("published");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((event) => event.title)).toEqual([
        "Spring Hack Night",
        "Design Critique Circle",
      ]);
    }
  });

  it("lists comments in chronological order for an event", async () => {
    const repository = CreateInMemoryEventRepository();

    const result = await repository.listCommentsByEvent(1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((comment) => comment.userId)).toEqual([
        "user-reader",
        "user-staff",
      ]);
    }
  });

  it("creates and deletes comments in memory", async () => {
    const repository = CreateInMemoryEventRepository();

    const created = await repository.createComment({
      eventId: 1,
      userId: "user-admin",
      content: "Looking forward to this.",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const removed = await repository.deleteComment(created.value.id);
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.value.content).toBe("Looking forward to this.");
    }
  });

  it("lists joined user RSVPs with their events from memory", async () => {
    const repository = CreateInMemoryEventRepository();

    const result = await repository.listRSVPsWithEventsByUser("user-reader");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.map(({ rsvp, event }) => ({
          rsvpId: rsvp.id,
          title: event.title,
        })),
      ).toEqual([
        { rsvpId: 3, title: "JavaScript Lightning Talks" },
        { rsvpId: 4, title: "Community Picnic" },
        { rsvpId: 1, title: "Spring Hack Night" },
        { rsvpId: 2, title: "Design Critique Circle" },
      ]);
    }
  });
});
