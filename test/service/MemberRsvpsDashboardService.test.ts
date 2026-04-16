import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
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
});
