import type { ConnectionState } from "../types.js";

const STATE_LABELS: Record<ConnectionState, string> = {
  idle:         "Idle",
  connecting:   "Connecting…",
  connected:    "Connected",
  disconnected: "Disconnected",
  error:        "Error",
  password:     "Authenticating",
};

export class StatusBar {
  private readonly root: HTMLElement;
  private state: ConnectionState = "idle";
  private target = "";

  constructor(root: HTMLElement) {
    this.root = root;
    this._render();
  }

  setState(state: ConnectionState): void {
    this.state = state;
    this._update();
  }

  setTarget(target: string): void {
    this.target = target;
    this._update();
  }

  private _render(): void {
    this.root.innerHTML = `
      <div class="status-card animate-fade-in">
        <div class="status-card__icon" id="status-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" opacity="0.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41
                     M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        </div>
        <div class="status-card__body">
          <p class="status-card__title">Connection status</p>
          <p class="status-card__sub" id="status-sub">—</p>
        </div>
        <div id="status-badge"></div>
      </div>
    `;
    this._update();
  }

  private _update(): void {
    const subEl   = this.root.querySelector("#status-sub")!;
    const badgeEl = this.root.querySelector("#status-badge")!;

    subEl.textContent = this.target || "—";

    const label = STATE_LABELS[this.state];
    badgeEl.innerHTML = `
      <span class="status-badge status-badge--${this.state}">
        <span class="status-dot"></span>
        ${label}
      </span>
    `;
  }
}
