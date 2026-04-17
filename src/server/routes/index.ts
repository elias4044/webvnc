import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./api/health.js";
import { vncRoutes } from "./api/vnc.js";

export async function registerRoutes(app: FastifyInstance) {
  // API routes
  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(vncRoutes);
    },
    { prefix: "/api" },
  );

  // SPA fallback — serve index.html for any unmatched route
  app.setNotFoundHandler((_req, reply) => {
    void reply.sendFile("index.html");
  });
}
