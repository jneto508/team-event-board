

import request from "supertest";
import { createComposedApp } from "../../src/composition";

async function loginAs(agent: request.Agent, email: string) {
  await agent.post("/login").type("form").send({
    email,
    password: "password123",
  });
}

describe("Feature 12 - Attendee List Route", () => {
  it("allows the organizer to view the attendee list", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await loginAs(agent, "staff@app.test");

    const response = await agent.get("/events/1/attendees");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Attendee List");
    expect(response.text).toContain("Attending");
    expect(response.text).toContain("Waitlisted");
    expect(response.text).toContain("Cancelled");
  });

  it("allows an admin to view the attendee list", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await loginAs(agent, "admin@app.test");

    const response = await agent.get("/events/1/attendees");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Attendee List");
    expect(response.text).toContain("Una User");
    expect(response.text).toContain("Mia Member");
    expect(response.text).toContain("Avery Admin");
  });

  it("rejects an unauthorized member", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await loginAs(agent, "user@app.test");

    const response = await agent.get("/events/1/attendees");

    expect(response.status).toBe(403);
    expect(response.text).toContain(
      "You are not allowed to view this attendee list.",
    );
  });

  it("renders the grouped attendee sections correctly", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await loginAs(agent, "staff@app.test");

    const response = await agent.get("/events/1/attendees");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Attending");
    expect(response.text).toContain("Waitlisted");
    expect(response.text).toContain("Cancelled");
    expect(response.text).toContain("Una User");
    expect(response.text).toContain("Mia Member");
    expect(response.text).toContain("Avery Admin");
    expect(response.text).toContain("No cancelled RSVPs for this event.");
  });

  it("sorts attendees by RSVP creation time within a group", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await loginAs(agent, "staff@app.test");

    const response = await agent.get("/events/1/attendees");

    expect(response.status).toBe(200);

    const unaIndex = response.text.indexOf("Una User");
    const miaIndex = response.text.indexOf("Mia Member");

    expect(unaIndex).toBeGreaterThan(-1);
    expect(miaIndex).toBeGreaterThan(-1);
    expect(unaIndex).toBeLessThan(miaIndex);
  });
});