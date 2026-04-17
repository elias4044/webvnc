import Fastify from "fastify";
import { config, isDev } from "./config/index.js";
import { registerPlugins } from "./plugins/index.js";
import { registerRoutes } from "./routes/index.js";
import { WebsockifyService } from "./services/websockify.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(isDev && {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }),
    },
    trustProxy: config.TRUST_PROXY,
    disableRequestLogging: false,
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "reqId",
    genReqId: () => crypto.randomUUID(),
  });

  await registerPlugins(app);
  await registerRoutes(app);

  // Start built-in WebSocket→TCP proxy
  const websockify = new WebsockifyService(config, app.log);
  websockify.start();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutdown signal received");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  return app;
}
