/**
 * Type declarations for @novnc/novnc
 * noVNC does not ship TypeScript types; these are minimal hand-written stubs
 * covering the RFB class API used by WebVNC.
 */
declare module "@novnc/novnc/lib/rfb.js" {
  export interface RFBCredentials {
    password?: string;
    username?: string;
    target?:   string;
  }

  export interface RFBOptions {
    shared?:     boolean;
    credentials?: RFBCredentials;
    repeaterID?: string;
  }

  export default class RFB extends EventTarget {
    constructor(container: HTMLElement, url: string, options?: RFBOptions);

    // Settings
    viewOnly:         boolean;
    scaleViewport:    boolean;
    resizeSession:    boolean;
    qualityLevel:     number;
    compressionLevel: number;
    showDotCursor:    boolean;
    clipViewport:     boolean;
    background:       string;

    // Methods
    disconnect(): void;
    sendCredentials(credentials: RFBCredentials): void;
    sendCtrlAltDel(): void;
    machineShutdown(): void;
    machineReboot(): void;
    machineReset(): void;
    clipboardPasteFrom(text: string): void;
    focus(): void;
    blur(): void;
  }
}
