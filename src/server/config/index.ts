import { z } from "zod";
import { config as loadDotenv } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Load .env from project root
loadDotenv({ path: resolve(__dirname, "../../../.env") });

// ─── Schema ──────────────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  // Server
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  // CORS
  CORS_ORIGIN: z.string().default("*"),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  // VNC defaults (used when no client-side overrides are given)
  VNC_DEFAULT_HOST: z.string().default("localhost"),
  VNC_DEFAULT_PORT: z.coerce.number().int().min(1).max(65535).default(5900),
  VNC_DEFAULT_PATH: z.string().default("/"),
  VNC_DEFAULT_ENCRYPT: z
    .string()
    .transform((v: string) => v === "true")
    .default("false"),

  // Static files
  STATIC_DIR: z.string().default("dist/client"),

  // Trust proxy (for deployments behind nginx/traefik)
  TRUST_PROXY: z
    .string()
    .transform((v: string) => v === "true")
    .default("false"),

  // Websockify — WebSocket-to-TCP proxy bridging the browser to a raw VNC port
  WEBSOCKIFY_ENABLED: z
    .string()
    .transform((v: string) => v !== "false")
    .default("true"),
  WEBSOCKIFY_LISTEN_PORT: z.coerce.number().int().min(1).max(65535).default(5900),
  WEBSOCKIFY_HOST: z.string().default("0.0.0.0"),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

// ─── Parse & export ──────────────────────────────────────────────────────────

function loadConfig(): AppConfig {
  const result = ConfigSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${formatted}`);
  }

  return result.data;
}

export const config = loadConfig();

export const isDev = config.NODE_ENV === "development";
export const isProd = config.NODE_ENV === "production";
export const isTest = config.NODE_ENV === "test";
