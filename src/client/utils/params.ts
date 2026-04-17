import type { VncParams, ScaleMode } from "../types.js";

const STORAGE_KEY = "webvnc:params";

export const DEFAULT_PARAMS: VncParams = {
  host: "localhost",
  port: 5900,
  path: "/",
  password: "",
  encrypt: location.protocol === "https:",
  shared: true,
  viewOnly: false,
  autoConnect: false,
  reconnect: false,
  reconnectDelay: 3000,
  repeaterId: "",
  qualityLevel: 6,
  compressionLevel: 2,
  showDotCursor: false,
  clipboardUp: true,
  clipboardDown: true,
  scaleMode: "fit" as ScaleMode,
  zoomLevel: 1.0,
};

/**
 * Parse VNC params from URL search params (highest priority),
 * then local storage, then defaults.
 */
export function loadParams(): VncParams {
  const stored = loadFromStorage();
  const base: VncParams = { ...DEFAULT_PARAMS, ...stored };
  return mergeUrlParams(base);
}

export function saveParams(params: VncParams): void {
  try {
    // Never persist passwords
    const safe = { ...params, password: "" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // Storage unavailable — silently ignore
  }
}

export function buildVncUrl(params: VncParams): string {
  const q = new URLSearchParams({
    host: params.host,
    port: String(params.port),
    path: params.path,
    encrypt: String(params.encrypt),
    shared: String(params.shared),
    viewOnly: String(params.viewOnly),
    reconnect: String(params.reconnect),
    reconnectDelay: String(params.reconnectDelay),
    qualityLevel: String(params.qualityLevel),
    compressionLevel: String(params.compressionLevel),
    showDotCursor: String(params.showDotCursor),
    clipboardUp: String(params.clipboardUp),
    clipboardDown: String(params.clipboardDown),
    scaleMode: params.scaleMode,
    zoomLevel: String(params.zoomLevel),
  });

  if (params.repeaterId) q.set("repeaterId", params.repeaterId);

  return `/vnc.html?${q.toString()}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function loadFromStorage(): Partial<VncParams> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<VncParams>;
  } catch {
    return {};
  }
}

function mergeUrlParams(base: VncParams): VncParams {
  const q = new URLSearchParams(location.search);

  return {
    host:             q.get("host")             ?? base.host,
    port:             parseIntParam(q.get("port"),             base.port),
    path:             q.get("path")             ?? base.path,
    password:         q.get("password")         ?? base.password,
    encrypt:          parseBoolParam(q.get("encrypt"),         base.encrypt),
    shared:           parseBoolParam(q.get("shared"),          base.shared),
    viewOnly:         parseBoolParam(q.get("viewOnly"),        base.viewOnly),
    autoConnect:      parseBoolParam(q.get("autoConnect"),     base.autoConnect),
    reconnect:        parseBoolParam(q.get("reconnect"),       base.reconnect),
    reconnectDelay:   parseIntParam(q.get("reconnectDelay"),   base.reconnectDelay),
    repeaterId:       q.get("repeaterId")        ?? base.repeaterId,
    qualityLevel:     parseIntParam(q.get("qualityLevel"),     base.qualityLevel),
    compressionLevel: parseIntParam(q.get("compressionLevel"), base.compressionLevel),
    showDotCursor:    parseBoolParam(q.get("showDotCursor"),   base.showDotCursor),
    clipboardUp:      parseBoolParam(q.get("clipboardUp"),     base.clipboardUp),
    clipboardDown:    parseBoolParam(q.get("clipboardDown"),   base.clipboardDown),
    scaleMode:        (q.get("scaleMode") as ScaleMode)        ?? base.scaleMode,
    zoomLevel:        parseFloatParam(q.get("zoomLevel"),      base.zoomLevel),
  };
}

function parseBoolParam(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value === "true" || value === "1";
}

function parseIntParam(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const n = parseInt(value, 10);
  return isNaN(n) ? fallback : n;
}

function parseFloatParam(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const n = parseFloat(value);
  return isNaN(n) ? fallback : n;
}
