import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import staticFiles from "@fastify/static";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { config, isDev } from "../config/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export async function registerPlugins(app: FastifyInstance) {
  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isDev ? null : [],
      },
    },
  });

  // CORS
  await app.register(cors, {
    origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Retry after ${String(context.after)}`,
    }),
  });

  // Sensible defaults (httpErrors, etc.)
  await app.register(sensible);

  // Serve frontend static files (only if dist/client exists — skipped in dev)
  const staticDir = resolve(__dirname, "../../../", config.STATIC_DIR);
  const { existsSync } = await import("fs");
  if (existsSync(staticDir)) {
    await app.register(staticFiles, {
      root: staticDir,
      prefix: "/",
      decorateReply: true,
      wildcard: false,
    });
    app.log.debug({ staticDir }, "Serving static files");
  } else {
    app.log.warn(
      { staticDir },
      "Static directory not found — run `npm run build:client` or use Vite dev server",
    );
    // Register a stub so reply.sendFile doesn't throw
    await app.register(staticFiles, {
      root: resolve(__dirname, "../../../public"),
      prefix: "/",
      decorateReply: true,
    });
  }
}
