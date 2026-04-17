import type { LogEntry } from "../types.js";

const MAX_ENTRIES = 200;

export class LogViewer {
  private readonly root: HTMLElement;
  private readonly entries: LogEntry[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
    this._render();
  }

  append(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }
    this._appendRow(entry);
  }

  clear(): void {
    this.entries.length = 0;
    const viewer = this.root.querySelector<HTMLElement>(".log-viewer");
    if (viewer) viewer.innerHTML = "";
  }

  private _render(): void {
    this.root.innerHTML = `
      <div class="card animate-fade-in" style="animation-delay:75ms">
        <div class="section-header">
          <span class="section-title">Event log</span>
          <div style="flex:1"></div>
          <button class="btn btn--ghost btn--sm" id="log-clear-btn">Clear</button>
        </div>
        <div class="log-viewer" id="log-viewer" aria-live="polite" aria-label="Event log"></div>
      </div>
    `;

    this.root.querySelector("#log-clear-btn")?.addEventListener("click", () => this.clear());
  }

  private _appendRow(entry: LogEntry): void {
    const viewer = this.root.querySelector<HTMLElement>("#log-viewer");
    if (!viewer) return;

    const row = document.createElement("div");
    row.className = "log-entry animate-fade-in";
    row.innerHTML = `
      <span class="log-time">${this._esc(entry.time)}</span>
      <span class="log-level log-level--${entry.level}">${entry.level.toUpperCase()}</span>
      <span class="log-msg">${this._esc(entry.message)}</span>
    `;

    viewer.appendChild(row);

    // Keep scrolled to bottom
    viewer.scrollTop = viewer.scrollHeight;
  }

  private _esc(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
