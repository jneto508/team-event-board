import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
import { CreateEventService } from "../../src/service/EventService";

const VALID_UPDATE: Parameters<ReturnType<typeof CreateEventService>["updateEvent"]>[1] = {
    title: "testing",
    description: "testing description",
    location: "amherst, ma",
    category: "cics 326",
    capacity: 50,
    startDateTime: new Date("2025-05-01T18:00:00.000Z"),
    endDateTime: new Date("2025-05-02T21:00:00.000Z"),
    organizerId: "user-staff",
};

describe("EventService.updateEvent", () => {
    it("returns not found when the event does not exist", async () => {
        const service = CreateEventService(CreateInMemoryEventRepository());

        const result = await service.updateEvent(9999, VALID_UPDATE, "user-staff", "staff");

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("EventNotFound");
        }
    });

    it("returns not authorized when a member attempts to edit", async () => {
        const service = CreateEventService(CreateInMemoryEventRepository());

        const result = await service.updateEvent(1, VALID_UPDATE, "user-reader", "user");

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("Forbidden");
        }
    });

    it("returns not authorized when staff attempts to edit an event they did not organize", async () => {
        const service = CreateEventService(CreateInMemoryEventRepository());

        const result = await service.updateEvent(1, VALID_UPDATE, "other-staff", "staff");

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("Forbidden");
        }
    });

    it("returns invalid state when the event is cancelled", async () => {
        const service = CreateEventService(CreateInMemoryEventRepository());

        const result = await service.updateEvent(4, VALID_UPDATE, "user-admin", "admin");

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidEventState");
        }
    });

    it("returns invalid state when the event is past", async () => {});

    it("returns invalid input when required fields are missing or empty", async () => {});

    it("returns invalid input when start date is after end date", async () => {});
});
