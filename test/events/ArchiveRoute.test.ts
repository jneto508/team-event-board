import request from "supertest";
import { createComposedApp } from "../../src/composition";
import {
  disconnectPrismaTestDb,
  resetPrismaEventData,
} from "../prismaTestUtils";

describe("GET /events/archive", () => {
  const mode = "prisma";
  type TestAgent = ReturnType<typeof request.agent>;

  beforeEach(async () => {
    await resetPrismaEventData();
  });

  afterAll(async () => {
    await disconnectPrismaTestDb();
  });

  async function login(
    agent: TestAgent,
    email: string,
  ): Promise<void> {
    await agent.post("/login").type("form").send({
      email,
      password: "password123",
    });
  }

  it("renders archived events for an authenticated user", async () => {
    const app = createComposedApp(mode).getExpressApp();
    const agent = request.agent(app);

    await login(agent, "user@app.test");

    const response = await agent.get("/events/archive");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Archived Events");
    expect(response.text).toContain("JavaScript Lightning Talks");
    expect(response.text).toContain("Community Picnic");
  });

  it("filters archive results inline through HTMX", async () => {
    const app = createComposedApp(mode).getExpressApp();
    const agent = request.agent(app);

    await login(agent, "user@app.test");

    const response = await agent
      .get("/events/archive")
      .query({ category: "technology" })
      .set("HX-Request", "true");

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="archive-results"');
    expect(response.text).toContain("JavaScript Lightning Talks");
    expect(response.text).not.toContain("Community Picnic");
    expect(response.text).not.toContain("<!doctype html>");
    expect(response.text).not.toContain("Archived Events");
  });

  it("returns an empty-state partial when no archived events match the HTMX filter", async () => {
    const app = createComposedApp(mode).getExpressApp();
    const agent = request.agent(app);

    await login(agent, "user@app.test");

    const response = await agent
      .get("/events/archive")
      .query({ category: "sports" })
      .set("HX-Request", "true");

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="archive-results"');
    expect(response.text).toContain("No archived events match this filter.");
    expect(response.text).not.toContain("<!doctype html>");
  });
});
