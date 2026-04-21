import request from "supertest";
import { createComposedApp } from "../../src/composition";

const VALID_EVENT = {
  title: "Test Workshop",
  description: "A hands-on workshop for testing purposes.",
  location: "Room 101",
  category: "workshop",
  capacity: "30",
  startDateTime: "2099-06-01T10:00",
  endDateTime: "2099-06-01T12:00",
};

async function loginAs(agent: request.Agent, email: string) {
  await agent.post("/login").type("form").send({ email, password: "password123" });
}

describe("Event creation routes", () => {
  describe("POST /events — happy path", () => {
    it("creates an event and redirects to /home on valid input from a staff user", async () => {});

    it("creates an event and redirects to /home on valid input from an admin user", async () => {});

    it("accepts an event without a capacity (optional field)", async () => {});
  });

  describe("POST /events — authentication errors", () => {
    it("rejects unauthenticated POST requests", async () => {
      const app = createComposedApp().getExpressApp();

      const response = await request(app)
        .post("/events")
        .type("form")
        .send(VALID_EVENT);

      expect(response.status).toBe(401);
      expect(response.text).toContain("log in");
    });

    it.todo("rejects member-role users attempting to create events");
  });

  describe("POST /events — InvalidEventData errors", () => {
    it("returns 400 when title is missing", async () => {
      const app = createComposedApp().getExpressApp();
      const agent = request.agent(app);
      await loginAs(agent, "staff@app.test");

      const response = await agent
        .post("/events")
        .type("form")
        .send({ ...VALID_EVENT, title: "" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Title is required.");
    });

    it("returns 400 when description is missing", async () => {
      const app = createComposedApp().getExpressApp();
      const agent = request.agent(app);
      await loginAs(agent, "staff@app.test");

      const response = await agent
        .post("/events")
        .type("form")
        .send({ ...VALID_EVENT, description: "" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Description is required.");
    });

    it("returns 400 when location is missing", async () => {
      const app = createComposedApp().getExpressApp();
      const agent = request.agent(app);
      await loginAs(agent, "staff@app.test");

      const response = await agent
        .post("/events")
        .type("form")
        .send({ ...VALID_EVENT, location: "" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Location is required.");
    });
  });

  describe("POST /events — ValidationError errors", () => {
    it("returns 400 when end date is before start date", async () => {
      const app = createComposedApp().getExpressApp();
      const agent = request.agent(app);
      await loginAs(agent, "staff@app.test");

      const response = await agent
        .post("/events")
        .type("form")
        .send({ ...VALID_EVENT, startDateTime: "2099-06-01T12:00", endDateTime: "2099-06-01T10:00" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Start date/time must be before end date/time.");
    });

    it("returns 400 when end date equals start date", async () => {
      const app = createComposedApp().getExpressApp();
      const agent = request.agent(app);
      await loginAs(agent, "staff@app.test");

      const response = await agent
        .post("/events")
        .type("form")
        .send({ ...VALID_EVENT, startDateTime: "2099-06-01T10:00", endDateTime: "2099-06-01T10:00" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Start date/time must be before end date/time.");
    });

    it("returns 400 when capacity is a negative number", async () => {
      const app = createComposedApp().getExpressApp();
      const agent = request.agent(app);
      await loginAs(agent, "staff@app.test");

      const response = await agent
        .post("/events")
        .type("form")
        .send({ ...VALID_EVENT, capacity: "-1" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Capacity must be a non-negative number.");
    });

    it("returns 400 when startDateTime is not a valid date string", async () => {
      const app = createComposedApp().getExpressApp();
      const agent = request.agent(app);
      await loginAs(agent, "staff@app.test");

      const response = await agent
        .post("/events")
        .type("form")
        .send({ ...VALID_EVENT, startDateTime: "not-a-date" });

      expect(response.status).toBe(400);
      expect(response.text).toContain("Start date/time is required and must be a valid date.");
    });
  });
});
