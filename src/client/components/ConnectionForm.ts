import type { VncParams } from "../types.js";

type OnChange = (params: VncParams) => void;

export class ConnectionForm {
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
    this.root.innerHTML = `
      <div class="card animate-fade-in">
        <div class="section-header">
          <span class="section-title">Connection</span>
        </div>
        <form class="connect-form" id="connect-form" novalidate>
          <div class="connect-form__row">
            <div class="field">
              <label class="label" for="field-host">Host</label>
              <input class="input" id="field-host" type="text"
                     placeholder="localhost" value="${this._esc(this.params.host)}"
                     autocomplete="off" spellcheck="false" />
            </div>
            <div class="field">
              <label class="label" for="field-port">Port</label>
              <input class="input" id="field-port" type="number"
                     min="1" max="65535" value="${String(this.params.port)}" />
            </div>
          </div>

          <div class="field">
            <label class="label" for="field-path">WebSocket path</label>
            <input class="input" id="field-path" type="text"
                   placeholder="/" value="${this._esc(this.params.path)}" />
          </div>

          <div class="field">
            <label class="label" for="field-password">Password</label>
            <input class="input" id="field-password" type="password"
                   placeholder="Leave blank if none" autocomplete="current-password" />
          </div>
        </form>
      </div>
    `;

    const form = this.root.querySelector<HTMLFormElement>("#connect-form")!;
    form.addEventListener("input", () => this._collectAndEmit());
  }

  private _collectAndEmit(): void {
    const get = (id: string) =>
      this.root.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "";

    const port = parseInt(get("field-port"), 10);
    this.params = {
      ...this.params,
      host:     get("field-host").trim() || "localhost",
      port:     isNaN(port) ? 5900 : Math.min(65535, Math.max(1, port)),
      path:     get("field-path") || "/",
      password: get("field-password"),
    };

    this.onChange(this.params);
  }

  private _esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }
}
