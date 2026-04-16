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

  it("lets a signed-in member cancel an upcoming RSVP from the dashboard", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await agent.post("/login").type("form").send({
      email: "user@app.test",
      password: "password123",
    });

    const cancelResponse = await agent.post("/my-rsvps/1/cancel");
    expect(cancelResponse.status).toBe(302);
    expect(cancelResponse.headers.location).toBe("/my-rsvps");

    const dashboardResponse = await agent.get("/my-rsvps");
    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.text).toContain("Cancel RSVP");
    expect(dashboardResponse.text).toContain("Spring Hack Night");
  });
});
