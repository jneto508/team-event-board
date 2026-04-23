import request from "supertest";
import { createComposedApp } from "../../src/composition";

async function loginAs(
  agent: ReturnType<typeof request.agent>,
  email: string,
  password = "password123",
) {
  return agent.post("/login").type("form").send({
    email,
    password,
  });
}

describe("Feature 2 - Event Detail Route", () => {
  it("shows a published event to an authenticated member", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await loginAs(agent, "user@app.test");

    const response = await agent.get("/events/1");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Spring Hack Night");
    expect(response.text).toContain("Innovation Lab");
  });

  it("returns 404 for a missing event", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await loginAs(agent, "user@app.test");

    const response = await agent.get("/events/9999");

    expect(response.status).toBe(404);
    expect(response.text).toMatch(/not found/i);
  });

  it("allows the organizer to view their own draft event", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await loginAs(agent, "staff@app.test");

    const response = await agent.get("/events/5");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Organizer Planning Session");
    expect(response.text).toMatch(/draft/i);
  });

  it("allows an admin to view another user's draft event", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await loginAs(agent, "admin@app.test");

    const response = await agent.get("/events/5");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Organizer Planning Session");
    expect(response.text).toMatch(/draft/i);
  });

  it("hides a draft event from an unauthorized member", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await loginAs(agent, "user@app.test");

    const response = await agent.get("/events/5");

    expect(response.status).toBe(404);
    expect(response.text).toMatch(/not found/i);
  });
});