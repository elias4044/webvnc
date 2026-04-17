import type { EventMap, LogEntry } from "../types.js";

type Listener<T> = (payload: T) => void;
type ListenerMap = { [K in keyof EventMap]?: Array<Listener<EventMap[K]>> };

/**
 * Minimal typed event emitter — no dependencies.
 */
export class EventEmitter {
  private readonly _listeners: ListenerMap = {};

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    if (!this._listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this._listeners as Record<string, unknown>)[event] = [] as Array<Listener<EventMap[K]>>;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this._listeners[event] as Array<Listener<EventMap[K]>>).push(listener);
    return this;
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    const arr = this._listeners[event];
    if (!arr) return this;
    const idx = arr.indexOf(listener);
    if (idx !== -1) arr.splice(idx, 1);
    return this;
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const arr = this._listeners[event];
    if (!arr) return;
    for (const fn of [...arr]) fn(payload);
  }
}

/**
 * Simple logger that emits structured log entries.
 */
export class Logger {
  private readonly emitter: EventEmitter;

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
  }

  private log(level: LogEntry["level"], message: string): void {
    const entry: LogEntry = {
      time: new Date().toLocaleTimeString("en", { hour12: false }),
      level,
      message,
    };
    this.emitter.emit("log", entry);
    if (level === "error") console.error(`[WebVNC] ${message}`);
    else if (level === "warn") console.warn(`[WebVNC] ${message}`);
    else console.log(`[WebVNC] ${level.toUpperCase()} ${message}`);
  }

  info(msg: string)  { this.log("info",  msg); }
  warn(msg: string)  { this.log("warn",  msg); }
  error(msg: string) { this.log("error", msg); }
  debug(msg: string) { this.log("debug", msg); }
  ok(msg: string)    { this.log("ok",    msg); }
}
