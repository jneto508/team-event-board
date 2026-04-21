import { CreateInMemoryEventRepository } from "../../src/repository/InMemoryEventRepository";
import { CreateEventService } from "../../src/service/EventService";

describe("EventService.updateEvent", () => {
    it("returns not found when the event does not exist", async () => {});

    it("returns not authorized when a member attempts to edit", async () => {});

    it("returns not authorized when staff attempts to edit an event they did not organize", async () => {});

    it("returns invalid state when the event is cancelled", async () => {});

    it("returns invalid state when the event is past", async () => {});

    it("returns invalid input when required fields are missing or empty", async () => {});

    it("returns invalid input when start date is after end date", async () => {});
});
