/**
 * Dashboard — main page that houses the connection form, status, and log viewer.
 */
import type { VncParams } from "../types.js";
import { saveParams, buildVncUrl } from "../utils/params.js";
import { EventEmitter, Logger } from "../utils/events.js";
import { ConnectionForm } from "./ConnectionForm.js";
import { AdvancedSettings } from "./AdvancedSettings.js";
import { LogViewer } from "./LogViewer.js";
import { StatusBar } from "./StatusBar.js";

const BRAND_ICON = `<svg class="header__brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
  <rect x="2" y="3" width="20" height="14" rx="2"/>
  <path d="M8 21h8M12 17v4"/>
</svg>`;

export class Dashboard {
  private readonly root: HTMLElement;
  private readonly emitter = new EventEmitter();
  private readonly logger: Logger;
  private params: VncParams;
  private statusBar!: StatusBar;
  private logViewer!: LogViewer;

  constructor(root: HTMLElement, params: VncParams) {
    this.root   = root;
    this.params = params;
    this.logger = new Logger(this.emitter);
    this._render();
    this._fetchServerDefaults();
  }

  // ── Render ────────────────────────────────────────────────────────────

  private _render(): void {
    this.root.innerHTML = `
      <div class="app animate-fade-in">
        <!-- Header -->
        <header class="header">
          ${BRAND_ICON}
          <div class="header__brand">
            WebVNC
            <span class="header__version">v1.0.0</span>
          </div>
          <div class="header__spacer"></div>
          <nav class="header__nav">
            <a href="https://github.com/elias4044/webvnc" target="_blank"
               rel="noopener" class="header__nav-link">GitHub</a>
          </nav>
        </header>

        <!-- Main -->
        <main class="main">
          <div class="page-hero">
            <p class="page-hero__eyebrow">Browser-based VNC access</p>
            <h1 class="page-hero__title">Connect to your desktop</h1>
            <p class="page-hero__sub">
              Enter connection details below, configure advanced options,
              then launch the viewer in a full-screen session.
            </p>
          </div>

          <div class="dashboard">
            <!-- Left: Connection form -->
            <aside class="connect-panel">
              <div id="connection-form-mount"></div>
              <div id="advanced-settings-mount"></div>
            </aside>

            <!-- Right: Status + Log -->
            <section class="info-panel">
              <div id="status-bar-mount"></div>
              <div id="log-viewer-mount"></div>

              <!-- Quick launch card -->
              <div class="launch-card animate-fade-in" style="animation-delay:100ms">
                <p class="launch-card__title">Quick launch</p>
                <p class="launch-card__desc">
                  Open the VNC viewer in a new tab with your current settings.
                  The viewer supports full-screen mode, clipboard sync, and
                  Ctrl+Alt+Del passthrough.
                </p>
                <button class="btn btn--primary" id="launch-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Launch viewer
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    `;

    // Mount sub-components
    const formMount     = this.root.querySelector("#connection-form-mount")!;
    const advMount      = this.root.querySelector("#advanced-settings-mount")!;
    const statusMount   = this.root.querySelector("#status-bar-mount")!;
    const logMount      = this.root.querySelector("#log-viewer-mount")!;

    new ConnectionForm(formMount as HTMLElement, this.params, (p) => {
      // Merge ONLY the fields owned by ConnectionForm; preserve all advanced settings
      // that AdvancedSettings may have changed since construction.
      this.params = {
        ...this.params,
        host:     p.host,
        port:     p.port,
        path:     p.path,
        password: p.password,
      };
      saveParams(this.params);
      this.statusBar.setTarget(`${this.params.host}:${this.params.port}`);
    });

    new AdvancedSettings(advMount as HTMLElement, this.params, (p) => {
      // Merge ONLY the fields owned by AdvancedSettings; preserve connection fields
      // that ConnectionForm may have changed since construction.
      this.params = {
        ...this.params,
        encrypt:          p.encrypt,
        shared:           p.shared,
        viewOnly:         p.viewOnly,
        reconnect:        p.reconnect,
        showDotCursor:    p.showDotCursor,
        clipboardUp:      p.clipboardUp,
        clipboardDown:    p.clipboardDown,
        reconnectDelay:   p.reconnectDelay,
        qualityLevel:     p.qualityLevel,
        compressionLevel: p.compressionLevel,
        repeaterId:       p.repeaterId,
      };
      saveParams(this.params);
    });

    this.statusBar = new StatusBar(statusMount as HTMLElement);
    this.logViewer = new LogViewer(logMount as HTMLElement);

    // Wire log entries to the viewer
    this.emitter.on("log", (entry) => this.logViewer.append(entry));

    // Launch button
    const launchBtn = this.root.querySelector<HTMLButtonElement>("#launch-btn")!;
    launchBtn.addEventListener("click", () => {
      saveParams(this.params);
      const url = buildVncUrl(this.params);
      window.open(url, "_blank", "noopener");
    });

    this.logger.info("WebVNC dashboard ready");
    this.statusBar.setTarget(`${this.params.host}:${this.params.port}`);
  }

  // ── Server defaults ───────────────────────────────────────────────────

  private _fetchServerDefaults(): void {
    fetch("/api/vnc/defaults")
      .then((r) => r.json())
      .then((data: { host?: string; port?: number; path?: string; encrypt?: boolean }) => {
        // Only apply server defaults if user hasn't customised storage
        const hasStoredHost = localStorage.getItem("webvnc:params") !== null;
        if (!hasStoredHost) {
          if (data.host)    this.params = { ...this.params, host:    data.host };
          if (data.port)    this.params = { ...this.params, port:    data.port };
          if (data.path)    this.params = { ...this.params, path:    data.path };
          if (data.encrypt !== undefined) {
            this.params = { ...this.params, encrypt: data.encrypt };
          }
          this.logger.debug("Loaded server VNC defaults");
        }
      })
      .catch(() => {
        // Not critical — dev server may not be running
      });

    // Use the built-in websockify port as the WebSocket connection port
    fetch("/api/vnc/websockify")
      .then((r) => r.json())
      .then((ws: { enabled?: boolean; host?: string; port?: number }) => {
        if (ws.enabled && ws.port) {
          const hasStoredHost = localStorage.getItem("webvnc:params") !== null;
          if (!hasStoredHost) {
            this.params = { ...this.params, port: ws.port };
            this.logger.debug(`Using built-in websockify port ${ws.port}`);
          }
        }
      })
      .catch(() => {
        // Optional enhancement — ignore if unavailable
      });
  }
}
