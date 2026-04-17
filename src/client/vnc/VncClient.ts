/**
 * VncClient — wraps the noVNC RFB class with typed events, reconnect logic,
 * and clean lifecycle management.
 */
import RFBClass from "@novnc/novnc/lib/rfb.js";
import type { VncParams, ConnectionState } from "../types.js";
import type { Logger } from "../utils/events.js";
import type RFB from "@novnc/novnc/lib/rfb.js";

type RFBInstance = InstanceType<typeof RFB>;

// noVNC event detail types (loosely typed — library has no official TS types)
interface RfbCredentialsDetail { types: string[] }
interface RfbDisconnectedDetail { clean: boolean }
interface RfbDesktopNameDetail { name: string }
interface RfbClipboardDetail { text: string }

export type OnStateChange = (state: ConnectionState) => void;
export type OnCredentials = (types: string[]) => void;
export type OnClipboard   = (text: string) => void;
export type OnDesktopName = (name: string) => void;

export interface VncClientOptions {
  container: HTMLElement;
  params: VncParams;
  logger: Logger;
  onStateChange: OnStateChange;
  onCredentials: OnCredentials;
  onClipboard:   OnClipboard;
  onDesktopName: OnDesktopName;
}

export class VncClient {
  private rfb: RFBInstance | null = null;
  private opts: VncClientOptions;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _desktopName = "";
  private _destroyed = false;

  constructor(opts: VncClientOptions) {
    this.opts = opts;
  }

  get desktopName() { return this._desktopName; }

  // ── Connection lifecycle ───────────────────────────────────────────────

  connect(): void {
    if (this.rfb) this.disconnect();

    const { params, logger } = this.opts;
    const wsUrl = this._buildWsUrl(params);

    logger.info(`Connecting to ${wsUrl}`);
    this.opts.onStateChange("connecting");

    try {
      const creds = params.password ? { password: params.password } : undefined;

      this.rfb = new RFBClass(this.opts.container, wsUrl, {
        ...(creds !== undefined && { credentials: creds }),
        shared: params.shared,
        repeaterID: params.repeaterId || "",
      });

      this._applySettings();
      this._attachEvents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to initialise RFB: ${msg}`);
      this.opts.onStateChange("error");
    }
  }

  disconnect(): void {
    this._clearReconnect();
    if (this.rfb) {
      this.rfb.disconnect();
      this.rfb = null;
    }
  }

  destroy(): void {
    this._destroyed = true;
    this.disconnect();
  }

  sendCredentials(password: string): void {
    this.rfb?.sendCredentials({ password });
  }

  sendClipboard(text: string): void {
    if (this.rfb) this.rfb.clipboardPasteFrom(text);
  }

  sendCtrlAltDel(): void {
    this.rfb?.sendCtrlAltDel();
  }

  shutdown(): void { this.rfb?.machineShutdown(); }
  reboot():   void { this.rfb?.machineReboot(); }
  reset():    void { this.rfb?.machineReset(); }

  // ── Settings ───────────────────────────────────────────────────────────

  updateParams(params: VncParams): void {
    this.opts.params = params;
    this._applySettings();
  }

  private _applySettings(): void {
    if (!this.rfb) return;
    const { params } = this.opts;

    this.rfb.viewOnly         = params.viewOnly;
    this.rfb.qualityLevel     = params.qualityLevel;
    this.rfb.compressionLevel = params.compressionLevel;
    this.rfb.showDotCursor    = params.showDotCursor;

    switch (params.scaleMode) {
      case "fit":
        this.rfb.scaleViewport = true;
        this.rfb.resizeSession = false;
        this.rfb.clipViewport  = false;
        break;
      case "real":
        this.rfb.scaleViewport = false;
        this.rfb.resizeSession = false;
        this.rfb.clipViewport  = false;
        break;
      case "remote":
        this.rfb.scaleViewport = false;
        this.rfb.resizeSession = true;
        this.rfb.clipViewport  = false;
        break;
      case "zoom":
        // VncApp sizes the #vnc-screen div to zoomLevel×100%; noVNC fills it.
        this.rfb.scaleViewport = true;
        this.rfb.resizeSession = false;
        this.rfb.clipViewport  = false;
        break;
    }
  }

  // ── Event wiring ───────────────────────────────────────────────────────

  private _attachEvents(): void {
    if (!this.rfb) return;

    this.rfb.addEventListener("connect", () => {
      this.opts.logger.ok("Connected");
      this.opts.onStateChange("connected");
    });

    this.rfb.addEventListener("disconnect", (e: Event) => {
      const detail = (e as CustomEvent<RfbDisconnectedDetail>).detail;
      if (detail.clean) {
        this.opts.logger.info("Disconnected cleanly");
        this.opts.onStateChange("disconnected");
      } else {
        this.opts.logger.warn("Connection lost unexpectedly");
        this.opts.onStateChange("error");
        this._scheduleReconnect();
      }
    });

    this.rfb.addEventListener("credentialsrequired", (e: Event) => {
      const detail = (e as CustomEvent<RfbCredentialsDetail>).detail;
      this.opts.logger.info("Credentials required");
      this.opts.onStateChange("password");
      this.opts.onCredentials(detail.types);
    });

    this.rfb.addEventListener("desktopname", (e: Event) => {
      const detail = (e as CustomEvent<RfbDesktopNameDetail>).detail;
      this._desktopName = detail.name;
      this.opts.onDesktopName(detail.name);
    });

    this.rfb.addEventListener("clipboard", (e: Event) => {
      const detail = (e as CustomEvent<RfbClipboardDetail>).detail;
      if (this.opts.params.clipboardDown) {
        this.opts.onClipboard(detail.text);
      }
    });
  }

  // ── Reconnect ──────────────────────────────────────────────────────────

  private _scheduleReconnect(): void {
    const { params, logger } = this.opts;
    if (!params.reconnect || this._destroyed) return;

    const delay = params.reconnectDelay;
    logger.info(`Reconnecting in ${delay}ms…`);

    this.reconnectTimer = setTimeout(() => {
      if (!this._destroyed) this.connect();
    }, delay);
  }

  private _clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ── URL builder ────────────────────────────────────────────────────────

  private _buildWsUrl(params: VncParams): string {
    const scheme = params.encrypt ? "wss" : "ws";
    const path   = params.path.startsWith("/") ? params.path : `/${params.path}`;
    return `${scheme}://${params.host}:${params.port}${path}`;
  }
}
