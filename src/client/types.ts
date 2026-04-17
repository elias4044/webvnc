/**
 * VNC connection parameters — shared type between UI and noVNC client.
 */

/** How the remote canvas is scaled inside the viewport. */
export type ScaleMode =
  | "fit"     // noVNC scales canvas to fill the container (default)
  | "real"    // canvas at native resolution, container scrollable (1:1)
  | "remote"  // request server to resize its desktop to match viewport
  | "zoom";   // manual zoom level, container scrollable

export interface VncParams {
  host: string;
  port: number;
  path: string;
  password: string;
  encrypt: boolean;
  shared: boolean;
  viewOnly: boolean;
  autoConnect: boolean;
  reconnect: boolean;
  reconnectDelay: number;
  repeaterId: string;
  qualityLevel: number;      // 0–9
  compressionLevel: number;  // 0–9
  showDotCursor: boolean;
  clipboardUp: boolean;
  clipboardDown: boolean;
  scaleMode: ScaleMode;
  zoomLevel: number;   // multiplier used when scaleMode === "zoom", e.g. 1.5 = 150%
}

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
  | "password";

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error" | "debug" | "ok";
  message: string;
}

export type EventMap = {
  "connect": VncParams;
  "disconnect": void;
  "state-change": ConnectionState;
  "log": LogEntry;
};
