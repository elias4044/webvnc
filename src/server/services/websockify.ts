/**
 * WebsockifyService
 *
 * Wraps @maximegris/node-websockify to provide a managed WebSocket→TCP proxy
 * that bridges the browser noVNC client to a raw VNC TCP port.
 *
 * The proxy runs on its own HTTP server (WEBSOCKIFY_PORT, default 6080)
 * completely independently of the Fastify server, so no path routing is needed.
 *
 * noVNC should connect to:  ws://<host>:<WEBSOCKIFY_PORT>/
 */
import { createRequire } from "module";
import type { FastifyBaseLogger } from "fastify";
import type { AppConfig } from "../config/index.js";

// node-websockify is a plain CJS module — use createRequire for ESM compat.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const initWsServer: (
  argv: {
    source: string;
    target: string;
    web?: string;
    cert?: string;
    key?: string;
  },
  callbacks?: {
    onConnected?: (client: unknown, target: unknown) => void;
    onDisconnected?: (client: unknown, code: number, reason: string) => void;
  },
) => void = require("@maximegris/node-websockify");

export class WebsockifyService {
  private readonly config: AppConfig;
  private readonly log: FastifyBaseLogger;
  private started = false;

  constructor(config: AppConfig, log: FastifyBaseLogger) {
    this.config = config;
    this.log    = log;
  }

  start(): void {
    if (!this.config.WEBSOCKIFY_ENABLED) {
      this.log.info("Websockify disabled — skipping");
      return;
    }

    if (this.started) {
      this.log.warn("Websockify already started");
      return;
    }

    const { WEBSOCKIFY_HOST, WEBSOCKIFY_LISTEN_PORT, VNC_DEFAULT_HOST, VNC_DEFAULT_PORT } = this.config;

    const source = `${VNC_DEFAULT_HOST}:${VNC_DEFAULT_PORT}`;
    const target = `${WEBSOCKIFY_HOST}:${WEBSOCKIFY_LISTEN_PORT}`;

    this.log.info(
      { source, target },
      "Starting websockify WebSocket→TCP proxy",
    );

    try {
      initWsServer(
        { source, target },
        {
          onConnected: (_client, _target) => {
            this.log.debug({ target }, "Websockify: client connected");
          },
          onDisconnected: (_client, code, reason) => {
            this.log.debug({ code, reason }, "Websockify: client disconnected");
          },
        },
      );

      this.started = true;
      this.log.info(
        `Websockify listening on ws://${VNC_DEFAULT_HOST}:${VNC_DEFAULT_PORT}/ → ${target}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error({ err: msg }, "Websockify failed to start");
    }
  }

  get isRunning(): boolean {
    return this.started;
  }

  get wsPort(): number {
    return this.config.VNC_DEFAULT_PORT;
  }
}
