import request from "supertest";
import { createComposedApp } from "../../src/composition";

describe("POST /events/:id/rsvp-toggle", () => {
  type TestAgent = ReturnType<typeof request.agent>;

  async function login(
    agent: TestAgent,
    email: string,
  ): Promise<void> {
    await agent.post("/login").type("form").send({
      email,
      password: "password123",
    });
  }

  it("updates the RSVP button inline for event detail HTMX requests", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await login(agent, "user@app.test");

    const response = await agent
      .post("/events/1/rsvp-toggle")
      .set("HX-Request", "true")
      .set("HX-Target", "rsvp-toggle-1");

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="rsvp-toggle-1"');
    expect(response.text).toContain("Cancelled");
    expect(response.text).toContain("RSVP Again");
    expect(response.text).not.toContain("<!doctype html>");
    expect(response.text).not.toContain("Comments");
  });
});
