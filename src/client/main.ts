/**
 * Main dashboard entry point.
 * Renders the connection configuration UI and launches the VNC viewer.
 */
import "./styles/global.css";
import "./styles/components.css";
import "./styles/dashboard.css";
import { Dashboard } from "./components/Dashboard.js";
import { loadParams } from "./utils/params.js";

const appEl = document.getElementById("app");
if (!appEl) throw new Error("Missing #app element");

const params = loadParams();
new Dashboard(appEl, params);
