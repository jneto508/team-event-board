import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
import { CreateRSVPService } from "../../src/service/RSVPService";
import type { IAuthenticatedUserSession } from "../../src/session/AppSession";

function buildUser(
  overrides: Partial<IAuthenticatedUserSession> = {},
): IAuthenticatedUserSession {
  return {
    userId: "user-guest",
    email: "guest@app.test",
    displayName: "Guest User",
    role: "user",
    signedInAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("RSVPService.toggleRSVP", () => {
  it("creates a going RSVP when capacity is available", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateRSVPService(repository, repository);

    const createEventResult = await repository.createEvent({
      title: "Open Lab",
      description: "Hands-on lab session",
      location: "Lab 1",
      category: "technology",
      capacity: 2,
      startDateTime: new Date(Date.now() + 60 * 60 * 1000),
      endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      organizerId: "user-staff",
    });

    expect(createEventResult.ok).toBe(true);
    if (!createEventResult.ok) {
      return;
    }
    createEventResult.value.status = "published";

    const result = await service.toggleRSVP(
      createEventResult.value.id,
      buildUser(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rsvpStatus).toBe("going");
      expect(result.value.attendeeCount).toBe(1);
      expect(result.value.waitlistCount).toBe(0);
    }
  });

  it("waitlists a new RSVP when the event is at capacity", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateRSVPService(repository, repository);

    const createEventResult = await repository.createEvent({
      title: "Tiny Workshop",
      description: "Single-seat workshop",
      location: "Room 9",
      category: "technology",
      capacity: 1,
      startDateTime: new Date(Date.now() + 60 * 60 * 1000),
      endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      organizerId: "user-staff",
    });
    expect(createEventResult.ok).toBe(true);
    if (!createEventResult.ok) {
      return;
    }
    createEventResult.value.status = "published";

    await service.toggleRSVP(
      createEventResult.value.id,
      buildUser({
        userId: "user-a",
        email: "a@app.test",
      }),
    );

    const secondResult = await service.toggleRSVP(
      createEventResult.value.id,
      buildUser({
        userId: "user-b",
        email: "b@app.test",
      }),
    );

    expect(secondResult.ok).toBe(true);
    if (secondResult.ok) {
      expect(secondResult.value.rsvpStatus).toBe("waitlisted");
      expect(secondResult.value.attendeeCount).toBe(1);
      expect(secondResult.value.waitlistCount).toBe(1);
    }
  });

  it("toggles an active RSVP to cancelled and frees capacity", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateRSVPService(repository, repository);

    const firstToggle = await service.toggleRSVP(
      1,
      buildUser({
        userId: "user-reader",
        email: "user@app.test",
      }),
    );

    expect(firstToggle.ok).toBe(true);
    if (firstToggle.ok) {
      expect(firstToggle.value.rsvpStatus).toBe("cancelled");
      expect(firstToggle.value.attendeeCount).toBe(0);
      expect(firstToggle.value.waitlistCount).toBe(0);
    }
  });

  it("reactivates a cancelled RSVP as going when capacity becomes available", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateRSVPService(repository, repository);

    const createEventResult = await repository.createEvent({
      title: "Cap Reset Session",
      description: "Capacity should reopen after a cancellation",
      location: "Room 11",
      category: "technology",
      capacity: 1,
      startDateTime: new Date(Date.now() + 60 * 60 * 1000),
      endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      organizerId: "user-staff",
    });
    expect(createEventResult.ok).toBe(true);
    if (!createEventResult.ok) {
      return;
    }
    createEventResult.value.status = "published";

    const eventId = createEventResult.value.id;
    const firstUser = buildUser({ userId: "user-a", email: "a@app.test" });
    const secondUser = buildUser({ userId: "user-b", email: "b@app.test" });

    await service.toggleRSVP(eventId, firstUser);
    await service.toggleRSVP(eventId, secondUser);
    await service.toggleRSVP(eventId, firstUser);
    const reactivateResult = await service.toggleRSVP(eventId, firstUser);

    expect(reactivateResult.ok).toBe(true);
    if (reactivateResult.ok) {
      expect(reactivateResult.value.rsvpStatus).toBe("going");
      expect(reactivateResult.value.attendeeCount).toBe(1);
      expect(reactivateResult.value.waitlistCount).toBe(1);
    }
  });

  it("keeps capacity enforcement when a cancelled RSVP is reactivated while the event is still full", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateRSVPService(repository, repository);

    const createEventResult = await repository.createEvent({
      title: "Full Again Session",
      description: "Reactivated RSVPs should respect capacity",
      location: "Room 12",
      category: "technology",
      capacity: 1,
      startDateTime: new Date(Date.now() + 60 * 60 * 1000),
      endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      organizerId: "user-staff",
    });
    expect(createEventResult.ok).toBe(true);
    if (!createEventResult.ok) {
      return;
    }
    createEventResult.value.status = "published";

    const eventId = createEventResult.value.id;
    const firstUser = buildUser({ userId: "user-a", email: "a@app.test" });
    const secondUser = buildUser({ userId: "user-b", email: "b@app.test" });

    await service.toggleRSVP(eventId, firstUser);
    await service.toggleRSVP(eventId, secondUser);
    await service.toggleRSVP(eventId, secondUser);
    const reactivateResult = await service.toggleRSVP(eventId, secondUser);

    expect(reactivateResult.ok).toBe(true);
    if (reactivateResult.ok) {
      expect(reactivateResult.value.rsvpStatus).toBe("waitlisted");
      expect(reactivateResult.value.attendeeCount).toBe(1);
      expect(reactivateResult.value.waitlistCount).toBe(1);
    }
  });

  it("returns specific error types for invalid RSVP attempts", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateRSVPService(repository, repository);

    const futureEventResult = await repository.createEvent({
      title: "Organizer-Owned Event",
      description: "Organizer should not RSVP",
      location: "Hall A",
      category: "community",
      capacity: 10,
      startDateTime: new Date(Date.now() + 60 * 60 * 1000),
      endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      organizerId: "organizer-1",
    });
    const cancelledEventResult = await repository.createEvent({
      title: "Cancelled Meetup",
      description: "Cancelled events are closed",
      location: "Hall B",
      category: "community",
      capacity: 10,
      startDateTime: new Date(Date.now() + 60 * 60 * 1000),
      endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      organizerId: "user-staff",
    });
    const pastEventResult = await repository.createEvent({
      title: "Past Meetup",
      description: "Past events are closed",
      location: "Hall C",
      category: "community",
      capacity: 10,
      startDateTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endDateTime: new Date(Date.now() - 60 * 60 * 1000),
      organizerId: "user-staff",
    });

    expect(futureEventResult.ok && cancelledEventResult.ok && pastEventResult.ok).toBe(true);
    if (!futureEventResult.ok || !cancelledEventResult.ok || !pastEventResult.ok) {
      return;
    }
    futureEventResult.value.status = "published";
    cancelledEventResult.value.status = "cancelled";
    pastEventResult.value.status = "published";

    const nonMemberResult = await service.toggleRSVP(
      futureEventResult.value.id,
      buildUser({
        userId: "staff-user",
        email: "staff@app.test",
        role: "staff",
      }),
    );
    const organizerResult = await service.toggleRSVP(
      futureEventResult.value.id,
      buildUser({
        userId: "organizer-1",
        email: "organizer@app.test",
      }),
    );
    const cancelledResult = await service.toggleRSVP(
      cancelledEventResult.value.id,
      buildUser({
        userId: "user-c",
        email: "c@app.test",
      }),
    );
    const pastResult = await service.toggleRSVP(
      pastEventResult.value.id,
      buildUser({
        userId: "user-d",
        email: "d@app.test",
      }),
    );

    expect(nonMemberResult.ok).toBe(false);
    expect(organizerResult.ok).toBe(false);
    expect(cancelledResult.ok).toBe(false);
    expect(pastResult.ok).toBe(false);

    if (!nonMemberResult.ok) {
      expect(nonMemberResult.value.name).toBe("RSVPForbidden");
    }
    if (!organizerResult.ok) {
      expect(organizerResult.value.name).toBe("OrganizerCannotRSVP");
    }
    if (!cancelledResult.ok) {
      expect(cancelledResult.value.name).toBe("RSVPClosed");
    }
    if (!pastResult.ok) {
      expect(pastResult.value.name).toBe("RSVPClosed");
    }
  });

  it("allows an existing waitlisted RSVP to be cancelled", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateRSVPService(repository, repository);

    const result = await service.toggleRSVP(
      2,
      buildUser({
        userId: "user-reader",
        email: "user@app.test",
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rsvpStatus).toBe("cancelled");
      expect(result.value.attendeeCount).toBe(0);
      expect(result.value.waitlistCount).toBe(0);
    }
  });
});
