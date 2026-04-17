import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { config } from "../../config/index.js";


const VncParamsSchema = z.object({
  host: z.string().min(1).max(253).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  path: z.string().optional(),
  encrypt: z
    .string()
    .transform((v) => v === "true")
    .optional(),
});

export async function vncRoutes(app: FastifyInstance) {
  /**
   * GET /api/vnc/defaults
   * Returns the server-configured VNC defaults so the frontend
   * can pre-populate connection fields without exposing secrets.
   */
  app.get(
    "/vnc/defaults",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              host: { type: "string" },
              port: { type: "number" },
              path: { type: "string" },
              encrypt: { type: "boolean" },
            },
          },
        },
      },
    },
    (_req: FastifyRequest, reply: FastifyReply) => {
      void reply.send({
        host: config.VNC_DEFAULT_HOST,
        port: config.VNC_DEFAULT_PORT,
        path: config.VNC_DEFAULT_PATH,
        encrypt: config.VNC_DEFAULT_ENCRYPT,
      });
    },
  );

  /**
   * POST /api/vnc/validate
   * Validates connection parameters without initiating a connection.
   * Useful for client-side pre-flight checks.
   */
  app.post(
    "/vnc/validate",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            host: { type: "string" },
            port: { type: "number" },
            path: { type: "string" },
            encrypt: { type: "boolean" },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const result = VncParamsSchema.safeParse(req.body);
      if (!result.success) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: result.error.issues.map((i) => i.message).join("; "),
        });
      }
      return reply.send({ valid: true, params: result.data });
    },
  );

  /**
   * GET /api/vnc/websockify
   * Returns the built-in websockify proxy configuration so the client
   * can connect to the correct WebSocket port automatically.
   */
  app.get(
    "/vnc/websockify",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              host: { type: "string" },
              port: { type: "number" },
            },
          },
        },
      },
    },
    (_req: FastifyRequest, reply: FastifyReply) => {
      void reply.send({
        enabled: config.WEBSOCKIFY_ENABLED,
        host: config.VNC_DEFAULT_HOST,
        port: config.VNC_DEFAULT_PORT,
      });
    },
  );
}
