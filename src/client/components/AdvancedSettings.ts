import type { VncParams } from "../types.js";

type OnChange = (params: VncParams) => void;

interface ToggleDef {
  key: keyof VncParams;
  label: string;
  desc: string;
}

const TOGGLES: ToggleDef[] = [
  { key: "encrypt",       label: "Encrypt (TLS/SSL)",  desc: "Use wss:// instead of ws://" },
  { key: "shared",        label: "Shared session",     desc: "Allow multiple viewers simultaneously" },
  { key: "viewOnly",      label: "View only",          desc: "Disable mouse and keyboard input" },
  { key: "reconnect",     label: "Auto-reconnect",     desc: "Reconnect automatically on disconnect" },
  { key: "showDotCursor", label: "Show dot cursor",    desc: "Display a local dot cursor" },
  { key: "clipboardUp",   label: "Clipboard → remote", desc: "Send local clipboard to remote" },
  { key: "clipboardDown", label: "Clipboard ← remote", desc: "Receive clipboard from remote" },
];

export class AdvancedSettings {
  private readonly root: HTMLElement;
  private params: VncParams;
  private readonly onChange: OnChange;

  constructor(root: HTMLElement, params: VncParams, onChange: OnChange) {
    this.root     = root;
    this.params   = { ...params };
    this.onChange = onChange;
    this._render();
  }

  private _render(): void {
    const togglesHtml = TOGGLES.map((t) => `
      <div class="toggle-field">
        <div class="toggle-label">
          <span>${t.label}</span>
          <span>${t.desc}</span>
        </div>
        <label class="toggle">
          <input type="checkbox" data-key="${String(t.key)}"
                 ${(this.params[t.key] as boolean) ? "checked" : ""} />
          <span class="toggle-track"></span>
        </label>
      </div>
    `).join("");

    this.root.innerHTML = `
      <div class="collapsible animate-fade-in" style="animation-delay:50ms">
        <button class="collapsible-trigger" id="adv-trigger" type="button">
          <span>Advanced settings</span>
          <svg class="collapsible-chevron" viewBox="0 0 16 16" fill="none"
               stroke="currentColor" stroke-width="1.5">
            <path d="M4 6l4 4 4-4"/>
          </svg>
        </button>
        <div class="collapsible-body">
          ${togglesHtml}

          <hr class="divider" />

          <div class="field" style="margin-bottom:var(--space-4)">
            <label class="label" for="adv-reconnect-delay">
              Reconnect delay (ms)
            </label>
            <input class="input" id="adv-reconnect-delay" type="number"
                   min="500" max="30000" step="500"
                   value="${String(this.params.reconnectDelay)}" />
          </div>

          <div class="connect-form__row" style="margin-bottom:var(--space-4)">
            <div class="field">
              <label class="label" for="adv-quality">Quality (0–9)</label>
              <input class="input" id="adv-quality" type="number"
                     min="0" max="9" value="${String(this.params.qualityLevel)}" />
            </div>
            <div class="field">
              <label class="label" for="adv-compression">Compression (0–9)</label>
              <input class="input" id="adv-compression" type="number"
                     min="0" max="9" value="${String(this.params.compressionLevel)}" />
            </div>
          </div>

          <div class="field">
            <label class="label" for="adv-repeater-id">Repeater ID</label>
            <input class="input" id="adv-repeater-id" type="text"
                   placeholder="Optional" value="${this._esc(this.params.repeaterId)}" />
          </div>
        </div>
      </div>
    `;

    const trigger = this.root.querySelector<HTMLButtonElement>("#adv-trigger")!;
    const collapsible = this.root.querySelector(".collapsible")!;
    trigger.addEventListener("click", () => {
      collapsible.toggleAttribute("data-open");
    });

    // Toggles
    this.root.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => this._collectAndEmit());
    });

    // Number/text inputs
    ["adv-reconnect-delay", "adv-quality", "adv-compression", "adv-repeater-id"].forEach((id) => {
      this.root.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener("input", () => {
        this._collectAndEmit();
      });
    });
  }

  private _collectAndEmit(): void {
    const bool = (key: string): boolean =>
      (this.root.querySelector<HTMLInputElement>(`input[data-key="${key}"]`)?.checked) ?? false;

    const num = (id: string, min: number, max: number, def: number): number => {
      const v = parseInt(
        this.root.querySelector<HTMLInputElement>(`#${id}`)?.value ?? String(def),
        10,
      );
      return isNaN(v) ? def : Math.min(max, Math.max(min, v));
    };

    const str = (id: string): string =>
      this.root.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? "";

    this.params = {
      ...this.params,
      encrypt:          bool("encrypt"),
      shared:           bool("shared"),
      viewOnly:         bool("viewOnly"),
      reconnect:        bool("reconnect"),
      showDotCursor:    bool("showDotCursor"),
      clipboardUp:      bool("clipboardUp"),
      clipboardDown:    bool("clipboardDown"),
      reconnectDelay:   num("adv-reconnect-delay", 500, 30000, 3000),
      qualityLevel:     num("adv-quality",      0, 9, 6),
      compressionLevel: num("adv-compression",  0, 9, 2),
      repeaterId:       str("adv-repeater-id"),
    };

    this.onChange(this.params);
  }

  private _esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }
}
