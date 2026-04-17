/**
 * VNC Viewer page entry point.
 * Mounts the full-screen noVNC viewer with toolbar and overlays.
 */
import "../styles/global.css";
import "../styles/vnc.css";
import { VncApp } from "./VncApp.js";
import { loadParams } from "../utils/params.js";

const container = document.getElementById("vnc-app");
if (!container) throw new Error("Missing #vnc-app element");

const params = loadParams();
const app = new VncApp(container, params);

// Auto-connect if requested
if (params.autoConnect) {
  app.connect();
}
