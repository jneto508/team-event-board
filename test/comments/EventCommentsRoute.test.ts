import request from "supertest";
import { createComposedApp } from "../../src/composition";

describe("Event comments routes", () => {
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

  it("shows a published event detail page to an authenticated user", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await login(agent, "user@app.test");

    const response = await agent.get("/events/1");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Spring Hack Night");
    expect(response.text).toContain("Comments");
  });

  it("creates a comment via HTMX without a full page reload", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await login(agent, "user@app.test");

    const response = await agent
      .post("/events/1/comments")
      .set("HX-Request", "true")
      .type("form")
      .send({ content: "Can beginners join, or is prior experience expected?" });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Can beginners join, or is prior experience expected?");
    expect(response.text).toContain("Comments");
  });

  it("lets an author delete their own comment through HTMX", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await login(agent, "user@app.test");

    const response = await agent
      .post("/events/1/comments/1/delete")
      .set("HX-Request", "true");

    expect(response.status).toBe(200);
    expect(response.text).not.toContain("Will there be time for team matching before we start coding?");
  });

  it("lets an organizer delete a comment from their event through HTMX", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await login(agent, "staff@app.test");

    const response = await agent
      .post("/events/1/comments/1/delete")
      .set("HX-Request", "true");

    expect(response.status).toBe(200);
    expect(response.text).not.toContain("Will there be time for team matching before we start coding?");
  });

  it("rejects unauthorized comment deletion through HTMX", async () => {
    const app = createComposedApp().getExpressApp();
    const agent = request.agent(app);

    await login(agent, "staff@app.test");

    const response = await agent
      .post("/events/2/comments/3/delete")
      .set("HX-Request", "true");

    expect(response.status).toBe(403);
    expect(response.text).toContain(
      "You can only delete your own comments unless you organize this event or are an admin.",
    );
    expect(response.text).toContain("Please bring one mockup or flow you want feedback on.");
  });
});
