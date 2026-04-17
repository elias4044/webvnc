import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "../../types.js";
import { config } from "../../config/index.js";

const startTime = Date.now();

export async function healthRoutes(app: FastifyInstance) {
  app.get<{ Reply: HealthResponse }>(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok", "degraded"] },
              timestamp: { type: "string" },
              uptime: { type: "number" },
              version: { type: "string" },
              environment: { type: "string" },
            },
          },
        },
      },
    },
    (_req, reply) => {
      const body: HealthResponse = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: "1.0.0",
        environment: config.NODE_ENV,
      };
      void reply.code(200).send(body);
    },
  );
}
