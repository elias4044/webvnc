import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { registerPlugins } from "../../src/server/plugins/index.js";
import { registerRoutes } from "../../src/server/routes/index.js";

describe("GET /api/health", () => {
  const app = Fastify({ logger: false });

  beforeAll(async () => {
    await registerPlugins(app);
    await registerRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with status ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; uptime: number }>();
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });

  it("includes timestamp and environment", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    const body = res.json<{ timestamp: string; environment: string }>();
    expect(body.timestamp).toBeTruthy();
    expect(["development", "production", "test"]).toContain(body.environment);
  });
});
