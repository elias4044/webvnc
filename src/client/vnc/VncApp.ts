/**
 * VncApp — orchestrates the full-screen VNC viewer UI.
 * Renders toolbar, canvas, overlays, and password dialog.
 */
import type { VncParams, ConnectionState, ScaleMode } from "../types.js";
import { EventEmitter, Logger } from "../utils/events.js";
import { saveParams } from "../utils/params.js";
import { buildVncUrl } from "../utils/params.js";
import { VncClient } from "./VncClient.js";

const ZOOM_STEP  = 0.1;   // ±10% per click
const ZOOM_MIN   = 0.25;
const ZOOM_MAX   = 4.0;

const ICONS = {
  monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
  </svg>`,
  connect: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>`,
  disconnect: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>`,
  fullscreen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
  </svg>`,
  cad: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4M15 21h4a2 2 0 002-2v-4"/>
  </svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
  </svg>`,
  zoomIn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
  </svg>`,
  zoomOut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/>
  </svg>`,
  screenshot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>`,
  power: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/>
  </svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>
  </svg>`,
  newTab: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`,
};

export class VncApp {
  private readonly root: HTMLElement;
  private readonly emitter = new EventEmitter();
  private readonly logger: Logger;
  private client: VncClient | null = null;
  private params: VncParams;
  private state: ConnectionState = "idle";

  // DOM refs
  private screenEl!: HTMLElement;
  private canvasContainer!: HTMLElement;
  private overlayEl!: HTMLElement;
  private overlayTitle!: HTMLElement;
  private overlaySubtitle!: HTMLElement;
  private overlaySpinner!: HTMLElement;
  private passwordDialog!: HTMLElement;
  private passwordInput!: HTMLInputElement;
  private connectBtn!: HTMLButtonElement;
  private disconnectBtn!: HTMLButtonElement;
  private hostLabel!: HTMLElement;
  private clipboardBar!: HTMLElement;
  private clipboardTextarea!: HTMLTextAreaElement;
  // Scale / zoom refs
  private zoomControls!: HTMLElement;
  private zoomDisplay!: HTMLElement;
  private viewOnlyBtn!: HTMLButtonElement;
  private powerMenu!: HTMLElement;

  constructor(root: HTMLElement, params: VncParams) {
    this.root   = root;
    this.params = params;
    this.logger = new Logger(this.emitter);
    this._render();
  }

  connect(): void {
    if (this.client) {
      this.client.destroy();
    }

    this.client = new VncClient({
      container:     this.screenEl,
      params:        this.params,
      logger:        this.logger,
      onStateChange: (s) => this._setState(s),
      onCredentials: () => this._showPasswordDialog(),
      onClipboard:   (t) => this._handleRemoteClipboard(t),
      onDesktopName: (n) => this._updateDesktopName(n),
    });

    this.client.connect();
    this._updateHostLabel();
  }

  disconnect(): void {
    this.client?.disconnect();
  }

  // ── Rendering ─────────────────────────────────────────────────────────

  private _render(): void {
    this.root.innerHTML = `
      <div id="vnc-app">
        <!-- Toolbar -->
        <header class="vnc-toolbar">
          <div class="vnc-toolbar__brand">
            <span class="vnc-toolbar__brand-icon">${ICONS.monitor}</span>
            WebVNC
          </div>

          <span class="vnc-toolbar__host" id="vnc-host-label">Not connected</span>

          <!-- Scale mode selector -->
          <div class="vnc-scale-group" id="vnc-scale-group">
            <button class="vnc-scale-btn vnc-scale-btn--active" data-scale="fit"    title="Scale to fit window">Fit</button>
            <button class="vnc-scale-btn"                       data-scale="real"   title="Actual pixel size (1:1), scrollable">1:1</button>
            <button class="vnc-scale-btn"                       data-scale="remote" title="Ask server to resize its desktop">Remote</button>
            <button class="vnc-scale-btn"                       data-scale="zoom"   title="Custom zoom level">Zoom</button>
          </div>

          <!-- Custom zoom controls — only visible in zoom mode -->
          <div class="vnc-zoom-controls" id="vnc-zoom-controls" style="display:none">
            <button class="btn btn--ghost btn--icon btn--xs" id="vnc-btn-zoom-out" title="Zoom out (−10%)">
              ${ICONS.zoomOut}
            </button>
            <span class="vnc-zoom-display" id="vnc-zoom-display">100%</span>
            <button class="btn btn--ghost btn--icon btn--xs" id="vnc-btn-zoom-in" title="Zoom in (+10%)">
              ${ICONS.zoomIn}
            </button>
            <button class="btn btn--ghost btn--xs" id="vnc-btn-zoom-reset" title="Reset to 100%">Reset</button>
          </div>

          <div class="vnc-toolbar__spacer"></div>

          <!-- View-only toggle -->
          <button class="btn btn--ghost btn--icon" id="vnc-btn-viewonly"
                  title="Toggle view-only mode">
            ${ICONS.eye}
          </button>

          <!-- Screenshot -->
          <button class="btn btn--ghost btn--icon" id="vnc-btn-screenshot"
                  title="Save screenshot">
            ${ICONS.screenshot}
          </button>

          <button class="btn btn--ghost btn--sm" id="vnc-btn-cad"
                  data-tooltip="Send Ctrl+Alt+Del" title="Ctrl+Alt+Del">
            ${ICONS.cad}
            <span>Ctrl+Alt+Del</span>
          </button>

          <button class="btn btn--ghost btn--icon" id="vnc-btn-clipboard"
                  data-tooltip="Clipboard" title="Clipboard">
            ${ICONS.clipboard}
          </button>

          <button class="btn btn--ghost btn--icon" id="vnc-btn-fullscreen"
                  data-tooltip="Fullscreen" title="Fullscreen">
            ${ICONS.fullscreen}
          </button>

          <!-- Power actions dropdown -->
          <div class="vnc-power-wrap" id="vnc-power-wrap">
            <button class="btn btn--ghost btn--icon" id="vnc-btn-power" title="Power actions">
              ${ICONS.power}
            </button>
            <div class="vnc-dropdown" id="vnc-power-menu" hidden>
              <button class="vnc-dropdown__item" id="vnc-power-shutdown">Shutdown</button>
              <button class="vnc-dropdown__item" id="vnc-power-reboot">Reboot</button>
              <button class="vnc-dropdown__item" id="vnc-power-reset">Reset</button>
            </div>
          </div>

          <!-- Open new VNC tab (second simultaneous connection) -->
          <button class="btn btn--ghost btn--icon" id="vnc-btn-newtab"
                  title="Open new connection tab">
            ${ICONS.newTab}
          </button>

          <button class="btn btn--primary btn--sm" id="vnc-btn-connect">
            ${ICONS.connect}
            Connect
          </button>

          <button class="btn btn--danger btn--sm" id="vnc-btn-disconnect" style="display:none">
            ${ICONS.disconnect}
            Disconnect
          </button>
        </header>

        <!-- Canvas -->
        <div class="vnc-canvas-container" id="vnc-canvas-container">
          <div id="vnc-screen"></div>

          <!-- State overlay -->
          <div class="vnc-overlay" id="vnc-overlay">
            <div class="vnc-overlay__spinner" id="vnc-overlay-spinner" style="display:none"></div>
            <span class="vnc-overlay__icon" id="vnc-overlay-icon">${ICONS.monitor}</span>
            <p class="vnc-overlay__title" id="vnc-overlay-title">Ready</p>
            <p class="vnc-overlay__subtitle" id="vnc-overlay-subtitle">
              Press Connect to start a VNC session.
            </p>
            <button class="btn btn--primary" id="vnc-overlay-connect-btn">Connect</button>
          </div>
        </div>

        <!-- Clipboard bar -->
        <div class="vnc-clipboard" id="vnc-clipboard-bar">
          <textarea id="vnc-clipboard-text" placeholder="Paste here to send…"></textarea>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            <button class="btn btn--primary btn--sm" id="vnc-clipboard-send">Send</button>
            <button class="btn btn--ghost btn--sm" id="vnc-clipboard-close">Close</button>
          </div>
        </div>

        <!-- Password dialog -->
        <div class="vnc-dialog" id="vnc-password-dialog" hidden>
          <div class="vnc-dialog__box animate-scale-in">
            <p class="vnc-dialog__title">Authentication required</p>
            <div class="field">
              <label class="label" for="vnc-password-input">VNC Password</label>
              <input class="input" id="vnc-password-input" type="password"
                     placeholder="Enter password…" autocomplete="current-password" />
            </div>
            <div class="vnc-dialog__actions">
              <button class="btn btn--ghost" id="vnc-password-cancel">Cancel</button>
              <button class="btn btn--primary" id="vnc-password-submit">Submit</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cache refs
    this.screenEl          = this.root.querySelector("#vnc-screen")!;
    this.canvasContainer   = this.root.querySelector("#vnc-canvas-container")!;
    this.overlayEl         = this.root.querySelector("#vnc-overlay")!;
    this.overlayTitle      = this.root.querySelector("#vnc-overlay-title")!;
    this.overlaySubtitle   = this.root.querySelector("#vnc-overlay-subtitle")!;
    this.overlaySpinner    = this.root.querySelector("#vnc-overlay-spinner")!;
    this.passwordDialog    = this.root.querySelector("#vnc-password-dialog")!;
    this.passwordInput     = this.root.querySelector("#vnc-password-input")!;
    this.connectBtn        = this.root.querySelector("#vnc-btn-connect")!;
    this.disconnectBtn     = this.root.querySelector("#vnc-btn-disconnect")!;
    this.hostLabel         = this.root.querySelector("#vnc-host-label")!;
    this.clipboardBar      = this.root.querySelector("#vnc-clipboard-bar")!;
    this.clipboardTextarea = this.root.querySelector("#vnc-clipboard-text")!;
    this.zoomControls      = this.root.querySelector("#vnc-zoom-controls")!;
    this.zoomDisplay       = this.root.querySelector("#vnc-zoom-display")!;
    this.viewOnlyBtn       = this.root.querySelector("#vnc-btn-viewonly")!;
    this.powerMenu         = this.root.querySelector("#vnc-power-menu")!;

    // Reflect initial params into UI
    this._syncScaleBtns();
    this._syncViewOnlyBtn();

    this._bindEvents();
  }

  private _bindEvents(): void {
    this.connectBtn.addEventListener("click", () => this.connect());

    const overlayConnectBtn = this.root.querySelector("#vnc-overlay-connect-btn")!;
    overlayConnectBtn.addEventListener("click", () => this.connect());

    this.disconnectBtn.addEventListener("click", () => this.disconnect());

    const cadBtn = this.root.querySelector("#vnc-btn-cad")!;
    cadBtn.addEventListener("click", () => this.client?.sendCtrlAltDel());

    const fullscreenBtn = this.root.querySelector("#vnc-btn-fullscreen")!;
    fullscreenBtn.addEventListener("click", () => this._toggleFullscreen());

    const clipboardToggleBtn = this.root.querySelector("#vnc-btn-clipboard")!;
    clipboardToggleBtn.addEventListener("click", () => this._toggleClipboardBar());

    const clipboardSendBtn = this.root.querySelector("#vnc-clipboard-send")!;
    clipboardSendBtn.addEventListener("click", () => {
      this.client?.sendClipboard(this.clipboardTextarea.value);
    });

    const clipboardCloseBtn = this.root.querySelector("#vnc-clipboard-close")!;
    clipboardCloseBtn.addEventListener("click", () => {
      delete this.clipboardBar.dataset["visible"];
    });

    // Password dialog
    const submitBtn = this.root.querySelector("#vnc-password-submit")!;
    submitBtn.addEventListener("click", () => this._submitPassword());

    const cancelBtn = this.root.querySelector("#vnc-password-cancel")!;
    cancelBtn.addEventListener("click", () => {
      this.passwordDialog.hidden = true;
      this.disconnect();
    });

    this.passwordInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") this._submitPassword();
    });

    // ── Scale mode buttons ─────────────────────────────────────────────
    const scaleGroup = this.root.querySelector("#vnc-scale-group")!;
    scaleGroup.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-scale]");
      if (btn?.dataset["scale"]) this._setScaleMode(btn.dataset["scale"] as ScaleMode);
    });

    // ── Zoom controls ──────────────────────────────────────────────────
    this.root.querySelector("#vnc-btn-zoom-in")!
      .addEventListener("click", () => this._adjustZoom(+ZOOM_STEP));
    this.root.querySelector("#vnc-btn-zoom-out")!
      .addEventListener("click", () => this._adjustZoom(-ZOOM_STEP));
    this.root.querySelector("#vnc-btn-zoom-reset")!
      .addEventListener("click", () => this._setZoom(1.0));

    // ── View-only toggle ───────────────────────────────────────────────
    this.viewOnlyBtn.addEventListener("click", () => this._toggleViewOnly());

    // ── Screenshot ─────────────────────────────────────────────────────
    this.root.querySelector("#vnc-btn-screenshot")!
      .addEventListener("click", () => this._takeScreenshot());

    // ── Power menu ─────────────────────────────────────────────────────
    this.root.querySelector("#vnc-btn-power")!
      .addEventListener("click", (e) => { e.stopPropagation(); this._togglePowerMenu(); });
    this.root.querySelector("#vnc-power-shutdown")!
      .addEventListener("click", () => { this.powerMenu.hidden = true; this.client?.shutdown(); });
    this.root.querySelector("#vnc-power-reboot")!
      .addEventListener("click", () => { this.powerMenu.hidden = true; this.client?.reboot(); });
    this.root.querySelector("#vnc-power-reset")!
      .addEventListener("click", () => { this.powerMenu.hidden = true; this.client?.reset(); });
    document.addEventListener("click", () => { this.powerMenu.hidden = true; });

    // ── New tab ────────────────────────────────────────────────────────
    this.root.querySelector("#vnc-btn-newtab")!
      .addEventListener("click", () => this._openNewTab());

    // ── Keyboard shortcuts ─────────────────────────────────────────────
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key) {
          case "F": e.preventDefault(); this._toggleFullscreen();   break;
          case "V": e.preventDefault(); this._toggleViewOnly();     break;
          case "S": e.preventDefault(); this._takeScreenshot();     break;
          case "=":
          case "+": e.preventDefault(); this._adjustZoom(+ZOOM_STEP); break;
          case "-": e.preventDefault(); this._adjustZoom(-ZOOM_STEP); break;
        }
      }
    });
  }

  // ── State management ───────────────────────────────────────────────────

  private _setState(state: ConnectionState): void {
    this.state = state;
    this.emitter.emit("state-change", state);
    this._updateUi(state);
  }

  private _updateUi(state: ConnectionState): void {
    const showOverlay = state !== "connected";
    this.overlayEl.hidden = !showOverlay;
    this.overlayEl.toggleAttribute("hidden", !showOverlay);

    const inProgress = state === "connecting";
    this.overlaySpinner.style.display = inProgress ? "block" : "none";
    const overlayIcon = this.root.querySelector<HTMLElement>("#vnc-overlay-icon");
    if (overlayIcon) overlayIcon.style.display = inProgress ? "none" : "block";

    this.connectBtn.style.display    = state === "connected" ? "none" : "";
    this.disconnectBtn.style.display = state === "connected" ? "" : "none";

    const CONFIG: Record<ConnectionState, { title: string; sub: string }> = {
      idle:         { title: "Ready",        sub: "Press Connect to start." },
      connecting:   { title: "Connecting…",  sub: "Establishing WebSocket connection." },
      connected:    { title: "Connected",    sub: "" },
      disconnected: { title: "Disconnected", sub: "Press Connect to reconnect." },
      error:        { title: "Connection error", sub: "Check settings and try again." },
      password:     { title: "Authenticating", sub: "Waiting for credentials." },
    };

    const cfg = CONFIG[state];
    this.overlayTitle.textContent    = cfg.title;
    this.overlaySubtitle.textContent = cfg.sub;

    // Hide the overlay connect button while connecting
    const overlayConnectBtn = this.root.querySelector<HTMLButtonElement>("#vnc-overlay-connect-btn")!;
    overlayConnectBtn.style.display = inProgress || state === "password" ? "none" : "";
  }

  private _updateHostLabel(): void {
    const { host, port } = this.params;
    this.hostLabel.textContent = `${host}:${port}`;
  }

  private _updateDesktopName(name: string): void {
    document.title = `${name} — WebVNC`;
  }

  private _showPasswordDialog(): void {
    this.passwordDialog.hidden = false;
    this.passwordInput.value = "";
    setTimeout(() => this.passwordInput.focus(), 50);
  }

  private _submitPassword(): void {
    const pw = this.passwordInput.value;
    this.passwordDialog.hidden = true;
    this.client?.sendCredentials(pw);
  }

  private _handleRemoteClipboard(text: string): void {
    this.clipboardTextarea.value = text;
  }

  private _toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      void this.root.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  }

  private _toggleClipboardBar(): void {
    if (this.clipboardBar.dataset["visible"] !== undefined) {
      delete this.clipboardBar.dataset["visible"];
    } else {
      this.clipboardBar.dataset["visible"] = "";
      this.clipboardTextarea.focus();
    }
  }

  // ── Scale / zoom ───────────────────────────────────────────────────────

  private _setScaleMode(mode: ScaleMode): void {
    this.params.scaleMode = mode;

    // Zoom controls visibility
    this.zoomControls.style.display = mode === "zoom" ? "" : "none";

    // Apply rfb settings (no reconnect needed)
    this.client?.updateParams(this.params);

    // Apply CSS layout
    this._applyScaleLayout();
    this._syncScaleBtns();
    saveParams(this.params);
  }

  private _adjustZoom(delta: number): void {
    const next = Math.round((this.params.zoomLevel + delta) * 100) / 100;
    this._setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)));
  }

  private _setZoom(level: number): void {
    this.params.zoomLevel = level;
    this._applyScaleLayout();
    this._updateZoomDisplay();
    saveParams(this.params);
  }

  /**
   * Applies the appropriate CSS classes / inline styles to make the chosen
   * scale mode work visually:
   *
   * - fit / remote  → container is non-scrollable, screen is 100×100%
   * - real (1:1)    → container scrolls, screen uses auto size (noVNC native)
   * - zoom          → container scrolls, screen is (zoomLevel×100)% so that
   *                   noVNC (scaleViewport=true) fills that enlarged area
   */
  private _applyScaleLayout(): void {
    const mode = this.params.scaleMode;
    const scrollable = mode === "real" || mode === "zoom";

    this.canvasContainer.classList.toggle("vnc-canvas-container--scrollable", scrollable);

    if (mode === "zoom") {
      const pct = `${this.params.zoomLevel * 100}%`;
      this.screenEl.style.width  = pct;
      this.screenEl.style.height = pct;
    } else {
      this.screenEl.style.width  = "";
      this.screenEl.style.height = "";
    }
  }

  private _updateZoomDisplay(): void {
    this.zoomDisplay.textContent = `${Math.round(this.params.zoomLevel * 100)}%`;
  }

  private _syncScaleBtns(): void {
    this.root.querySelectorAll<HTMLButtonElement>(".vnc-scale-btn").forEach((b) => {
      b.classList.toggle("vnc-scale-btn--active", b.dataset["scale"] === this.params.scaleMode);
    });
    this.zoomControls.style.display = this.params.scaleMode === "zoom" ? "" : "none";
    this._updateZoomDisplay();
    this._applyScaleLayout();
  }

  // ── View-only ──────────────────────────────────────────────────────────

  private _toggleViewOnly(): void {
    this.params.viewOnly = !this.params.viewOnly;
    this.client?.updateParams(this.params);
    this._syncViewOnlyBtn();
    saveParams(this.params);
  }

  private _syncViewOnlyBtn(): void {
    const isViewOnly = this.params.viewOnly;
    this.viewOnlyBtn.innerHTML = isViewOnly ? ICONS.eyeOff : ICONS.eye;
    this.viewOnlyBtn.title     = isViewOnly ? "View-only ON — click to allow input" : "Toggle view-only";
    this.viewOnlyBtn.classList.toggle("btn--active", isViewOnly);
  }

  // ── Screenshot ─────────────────────────────────────────────────────────

  private _takeScreenshot(): void {
    const canvas = this.screenEl.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas) {
      this.logger.warn("No VNC canvas found — connect first.");
      return;
    }
    const url = canvas.toDataURL("image/png");
    const a   = document.createElement("a");
    const ts  = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href     = url;
    a.download = `webvnc-${ts}.png`;
    a.click();
  }

  // ── Power menu ─────────────────────────────────────────────────────────

  private _togglePowerMenu(): void {
    this.powerMenu.hidden = !this.powerMenu.hidden;
  }

  // ── New tab ────────────────────────────────────────────────────────────

  private _openNewTab(): void {
    window.open(buildVncUrl(this.params), "_blank", "noopener,noreferrer");
  }
}
