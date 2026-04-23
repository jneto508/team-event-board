import request from "supertest";
import { createComposedApp } from "../../src/composition";

describe("GET /my-rsvps", () => {
  it("redirects unauthenticated visitors to login", async () => {
    const app = createComposedApp().getExpressApp();

    const response = await request(app).get("/my-rsvps");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
  });

  it("renders the dashboard for signed-in members", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await agent.post("/login").type("form").send({
      email: "user@app.test",
      password: "password123",
    });

    const response = await agent.get("/my-rsvps");

    expect(response.status).toBe(200);
    expect(response.text).toContain("My RSVPs");
    expect(response.text).toContain("Upcoming");
    expect(response.text).toContain("Past And Cancelled");
    expect(response.text).toContain("Spring Hack Night");
    expect(response.text).toContain("Design Critique Circle");
  });

  it("blocks staff users from opening the member dashboard", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await agent.post("/login").type("form").send({
      email: "staff@app.test",
      password: "password123",
    });

    const response = await agent.get("/my-rsvps");

    expect(response.status).toBe(403);
    expect(response.text).toContain("Only members can view My RSVPs.");
  });

  it("blocks organizers from the inline dashboard cancel action", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await agent.post("/login").type("form").send({
      email: "staff@app.test",
      password: "password123",
    });

    const response = await agent
      .post("/events/1/rsvp-toggle")
      .set("HX-Request", "true")
      .set("HX-Target", "rsvp-dashboard-sections");

    expect(response.status).toBe(403);
    expect(response.text).toContain("Only members can manage My RSVPs.");
  });

  it("updates the dashboard inline when a member cancels an upcoming RSVP", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await agent.post("/login").type("form").send({
      email: "user@app.test",
      password: "password123",
    });

    const cancelResponse = await agent
      .post("/events/1/rsvp-toggle")
      .set("HX-Request", "true")
      .set("HX-Target", "rsvp-dashboard-sections");

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.text).toContain('id="rsvp-dashboard-sections"');
    expect(cancelResponse.text).toContain("Spring Hack Night");
    expect(cancelResponse.text).toContain("cancelled");
    expect(cancelResponse.text).toContain("Design Critique Circle");
    expect(cancelResponse.text).toContain("Leave Waitlist");
  });

  it("lets a waitlisted member leave the waitlist from the dashboard inline", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await agent.post("/login").type("form").send({
      email: "user@app.test",
      password: "password123",
    });

    const dashboardResponse = await agent.get("/my-rsvps");
    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.text).toContain("Design Critique Circle");
    expect(dashboardResponse.text).toContain("Leave Waitlist");

    const cancelResponse = await agent
      .post("/events/2/rsvp-toggle")
      .set("HX-Request", "true")
      .set("HX-Target", "rsvp-dashboard-sections");

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.text).toContain('id="rsvp-dashboard-sections"');
    expect(cancelResponse.text).toContain("Design Critique Circle");
    expect(cancelResponse.text).toContain("cancelled");
    expect(cancelResponse.text).not.toContain("Leave Waitlist");
  });
});
