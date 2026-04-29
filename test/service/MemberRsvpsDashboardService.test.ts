import { Ok } from "../../src/lib/result";
import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
import type {
  IEventRepository,
  IRSVPRepository,
  RSVPWithEvent,
} from "../../src/repository/EventRepository";
import { CreateMemberRsvpsDashboardService } from "../../src/service/MemberRsvpsDashboardService";

describe("MemberRsvpsDashboardService", () => {
  it("groups member RSVPs into upcoming and history with the expected sort order", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateMemberRsvpsDashboardService(repository, repository);

    const result = await service.getMemberRsvpsDashboard("user-reader");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming.map((entry) => entry.event.title)).toEqual([
        "Design Critique Circle",
        "Spring Hack Night",
      ]);
      expect(result.value.history.map((entry) => entry.event.title)).toEqual([
        "Community Picnic",
        "JavaScript Lightning Talks",
      ]);
    }
  });

  it("cancels an upcoming RSVP and moves it into dashboard history", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateMemberRsvpsDashboardService(repository, repository);

    const cancelResult = await service.cancelUpcomingRsvp("user-reader", 1);

    expect(cancelResult.ok).toBe(true);
    if (cancelResult.ok) {
      expect(cancelResult.value.rsvpStatus).toBe("cancelled");
    }

    const dashboardResult = await service.getMemberRsvpsDashboard("user-reader");
    expect(dashboardResult.ok).toBe(true);
    if (dashboardResult.ok) {
      expect(dashboardResult.value.upcoming.map((entry) => entry.event.title)).toEqual([
        "Design Critique Circle",
      ]);
      expect(dashboardResult.value.history.map((entry) => entry.event.title)).toEqual([
        "Spring Hack Night",
        "Community Picnic",
        "JavaScript Lightning Talks",
      ]);
      expect(dashboardResult.value.history[0].rsvpStatus).toBe("cancelled");
    }
  });

  it("rejects cancellation for past or cancelled events", async () => {
    const repository = CreateInMemoryEventRepository();
    const service = CreateMemberRsvpsDashboardService(repository, repository);

    const result = await service.cancelUpcomingRsvp("user-reader", 3);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("InvalidRSVPState");
    }
  });

  it("builds the dashboard from joined RSVP rows without reloading events", async () => {
    const joinedRows: RSVPWithEvent[] = [
      {
        rsvp: {
          id: 10,
          eventId: 2,
          userId: "user-reader",
          status: "waitlisted",
          createdAt: new Date("2026-03-21T10:00:00.000Z"),
        },
        event: {
          id: 2,
          title: "Design Critique Circle",
          description: "Peer review session for in-progress mockups.",
          location: "Studio B",
          category: "design",
          status: "published",
          capacity: 18,
          startDateTime: new Date("2026-05-01T22:00:00.000Z"),
          endDateTime: new Date("2026-05-02T00:00:00.000Z"),
          organizerId: "user-staff",
          createdAt: new Date("2026-03-12T16:00:00.000Z"),
          updatedAt: new Date("2026-03-12T16:00:00.000Z"),
        },
      },
      {
        rsvp: {
          id: 11,
          eventId: 3,
          userId: "user-reader",
          status: "going",
          createdAt: new Date("2026-03-01T10:00:00.000Z"),
        },
        event: {
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
      },
    ];

    const events = {
      getEventById: jest.fn(),
    } as unknown as IEventRepository;
    const rsvps = {
      listRSVPsWithEventsByUser: jest.fn().mockResolvedValue(Ok(joinedRows)),
    } as unknown as IRSVPRepository;

    const service = CreateMemberRsvpsDashboardService(events, rsvps);
    const result = await service.getMemberRsvpsDashboard("user-reader");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming.map((entry) => entry.event.title)).toEqual([
        "Design Critique Circle",
      ]);
      expect(result.value.history.map((entry) => entry.event.title)).toEqual([
        "JavaScript Lightning Talks",
      ]);
    }

    expect(rsvps.listRSVPsWithEventsByUser).toHaveBeenCalledWith("user-reader");
    expect((events as { getEventById: jest.Mock }).getEventById).not.toHaveBeenCalled();
  });
});
