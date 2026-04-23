import { CreateInMemoryUserRepository } from "../../src/auth/InMemoryUserRepository";
import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
import { CreateEventCommentsService } from "../../src/service/EventCommentsService";

describe("EventCommentsService", () => {
  it("creates a comment on a published event", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateEventCommentsService(
      repository,
      repository,
      repository,
      CreateInMemoryUserRepository(),
    );

    const result = await service.createComment(
      "user-reader",
      "1",
      "Can I bring a partner to this event?",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.eventId).toBe(1);
      expect(result.value.userId).toBe("user-reader");
    }
  });

  it("rejects comments on unpublished events", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateEventCommentsService(
      repository,
      repository,
      repository,
      CreateInMemoryUserRepository(),
    );

    const result = await service.createComment("user-reader", "3", "Is this recorded?");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("EventNotFound");
    }
  });

  it("rejects empty comments", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateEventCommentsService(
      repository,
      repository,
      repository,
      CreateInMemoryUserRepository(),
    );

    const result = await service.createComment("user-reader", "1", "   ");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("InvalidCommentData");
    }
  });

  it("allows a user to delete their own comment", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateEventCommentsService(
      repository,
      repository,
      repository,
      CreateInMemoryUserRepository(),
    );

    const result = await service.deleteComment("user-reader", "1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe(1);
    }
  });

  it("allows an organizer to delete any comment on their event", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateEventCommentsService(
      repository,
      repository,
      repository,
      CreateInMemoryUserRepository(),
    );

    const result = await service.deleteComment("user-staff", "1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.eventId).toBe(1);
    }
  });

  it("allows an admin to delete any comment", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateEventCommentsService(
      repository,
      repository,
      repository,
      CreateInMemoryUserRepository(),
    );

    const result = await service.deleteComment("user-admin", "2");

    expect(result.ok).toBe(true);
  });

  it("blocks unrelated users from deleting comments", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateEventCommentsService(
      repository,
      repository,
      repository,
      CreateInMemoryUserRepository(),
    );

    const result = await service.deleteComment("user-staff", "3");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("UnauthorizedCommentDeletion");
    }
  });
});
