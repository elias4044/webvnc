import type { FastifyBaseLogger, FastifyInstance, RawServerDefault, FastifyTypeProviderDefault } from "fastify";
import type { IncomingMessage, ServerResponse } from "http";

export type App = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse,
  FastifyBaseLogger,
  FastifyTypeProviderDefault
>;

export interface VncConnectionParams {
  host: string;
  port: number;
  path: string;
  password?: string;
  encrypt: boolean;
  shared: boolean;
  viewOnly: boolean;
  autoConnect: boolean;
  reconnect: boolean;
  reconnectDelay: number;
  repeaterId?: string;
  qualityLevel: number;
  compressionLevel: number;
  showDotCursor: boolean;
  clipboardUp: boolean;
  clipboardDown: boolean;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}
