import { buildApp } from "./app.js";
import { config } from "./config/index.js";

const app = await buildApp();

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info(`WebVNC server running on http://${config.HOST}:${config.PORT}`);
  app.log.info(`Environment: ${config.NODE_ENV}`);
} catch (err) {
  app.log.error(err, "Fatal error during startup");
  process.exit(1);
}
