# WebVNC

Browser-based VNC client powered by [noVNC](https://novnc.com) and [Fastify](https://fastify.dev).

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)

A production-ready, self-hostable VNC client for the browser. Connect to any VNC server
directly from a clean, minimal dark web interface — no plugins, no Java, no desktop app required.

---

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Setting up a VNC server](#setting-up-a-vnc-server)
- [WebSocket bridge](#websocket-bridge)
- [Configuration](#configuration)
- [URL parameters](#url-parameters)
- [API](#api)
- [Production deployment](#production-deployment)
- [Docker](#docker)
- [Development scripts](#development-scripts)
- [Project structure](#project-structure)
- [Windows installer](#windows-installer)
- [Roadmap](#roadmap)

---

## Features

- Full noVNC integration with WebSocket VNC proxying
- Fastify backend — structured logging, plugin-based, strict TypeScript
- Dark minimal UI — CSS design system, responsive, no frontend framework
- Scale modes: fit-to-window, actual pixels (1:1, scrollable), remote resize, and custom zoom
- View-only toggle, screenshot capture, power actions (shutdown/reboot/reset)
- Open multiple simultaneous connections in separate tabs
- All noVNC options: encryption, shared sessions, view-only, clipboard, quality, reconnect
- Secure defaults: Helmet headers, rate limiting, CORS, Zod-validated config
- Docker ready with built-in websockify bridge
- Vitest test suite with coverage

---

## How it works

```
Browser  <──WebSocket──>  WebVNC (Fastify)  <──TCP──>  VNC Server
              (noVNC)        built-in proxy
                             (websockify)
```

The browser runs noVNC, which speaks the RFB protocol over a WebSocket connection.
WebVNC's built-in websockify bridge proxies that WebSocket to a raw TCP VNC port on
the same or a remote machine. No standalone websockify installation is required unless
you prefer to manage the bridge separately.

---

## Requirements

| Dependency | Minimum version | Notes |
|---|---|---|
| Node.js | 20.x | Required |
| npm | 10.x | Bundled with Node.js |
| A VNC server | — | See [Setting up a VNC server](#setting-up-a-vnc-server) |
| Python 3 + websockify | — | Only if **not** using the built-in bridge |

---

## Quick start

```bash
# 1. Clone the repository
git clone https://github.com/elias4044/webvnc.git
cd webvnc

# 2. Install dependencies
npm install

# 3. Copy and edit the environment config
cp .env.example .env

# 4. Start in development mode (Fastify + Vite HMR in parallel)
npm run dev
```

Open **http://localhost:3020** and fill in the connection form.

For a fast first test without any VNC server, set the host/port to an existing RealVNC,
TigerVNC, or UltraVNC machine on your network. See the next section for how to set
one up from scratch.

---

## Setting up a VNC server

WebVNC is a _client_ — it connects to an existing VNC server. Below are setup guides
for the most common options.

### UltraVNC (Windows, recommended)

UltraVNC is a high-performance open-source VNC server for Windows. It supports
hardware-accelerated screen capture via the Mirror Driver and has good compatibility
with noVNC.

**Installation**

1. Download the installer from **https://uvnc.com/downloads/ultravnc.html**.
   Choose the latest stable release for your architecture (32-bit or 64-bit).

2. Run the installer. On the _Select Components_ screen, enable:
   - UltraVNC Server
   - UltraVNC Viewer (optional, useful for local testing)
   - Mirror Driver (recommended — significantly improves performance on older hardware)

3. During installation you will be prompted to set a **VNC password**. This is the
   password WebVNC will prompt for when connecting. Choose a strong password.

**Configuration**

After installation, open **UltraVNC Server** from the system tray icon and click
_Admin Properties_:

| Setting | Recommended value | Reason |
|---|---|---|
| VNC Password | (your chosen password) | Mandatory for secure access |
| MS-Logon II | Off (unless you need Windows auth) | Simplifies setup |
| Query on connect | Off (or On if you want pop-up approval) | Personal preference |
| Allow Loopback connections | On | Required if testing locally |
| Accept Incoming Connections | On | Must be enabled |
| Port | 5900 | Default; change if needed |

Click _Apply_ then restart the UltraVNC service via the tray icon (_Restart Service_).

**Firewall**

Open Windows Firewall and allow inbound TCP traffic on port **5900** (or whichever
port you configured). If you are only accessing WebVNC from the same machine, this
is not necessary.

**Mirror Driver (optional but recommended)**

If you installed the Mirror Driver, enable it in Admin Properties under the
_Capture_ tab. It reduces CPU usage and improves frame rates dramatically.

---

### TigerVNC (Linux)

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install tigervnc-standalone-server

# Set a VNC password
vncpasswd

# Start a virtual display on screen :1 (port 5901)
vncserver :1 -geometry 1920x1080 -depth 24
```

To run a full desktop session, create `~/.vnc/xstartup`:

```bash
#!/bin/bash
exec /usr/bin/startxfce4   # or gnome-session, openbox, etc.
```

```bash
chmod +x ~/.vnc/xstartup
vncserver :1 -geometry 1920x1080 -depth 24
```

TigerVNC listens on port `5900 + display_number`, so `:1` = port **5901**.

---

### RealVNC (Windows / Linux / macOS)

Download from **https://www.realvnc.com/en/connect/download/vnc/**.
RealVNC Server supports WebSocket natively on Enterprise editions. On free/Home
editions, use the built-in websockify bridge (see below).

---

## WebSocket bridge

VNC uses a raw TCP socket. Browsers can only use WebSockets. A bridge is required.

### Option A — Built-in bridge (default, zero extra setup)

WebVNC ships with a built-in WebSocket-to-TCP proxy (enabled by default via
`WEBSOCKIFY_ENABLED=true` in `.env`). It listens on `WEBSOCKIFY_PORT` (default `6080`)
and forwards connections to `VNC_DEFAULT_HOST:VNC_DEFAULT_PORT`.

With the built-in bridge active you point noVNC at the WebVNC server:

```
VNC Server port:  5900  (raw TCP, UltraVNC / TigerVNC / etc.)
WebVNC port:      6080  (WebSocket, what the browser connects to)
```

Set `VNC_DEFAULT_PORT=6080` in `.env` (or enter `6080` in the UI).

No additional software is required.

---

### Option B — Standalone websockify

Use this if you prefer to manage the bridge as a separate process, or if you are
running the VNC server on a different machine.

**Installation**

```bash
# Python 3 required
pip install websockify
```

**Usage**

```bash
# Forward WebSocket port 6080 to VNC TCP port 5900 on the same machine
websockify 6080 localhost:5900

# Forward to a VNC server on a different host
websockify 6080 192.168.1.50:5900

# With SSL termination
websockify --cert /path/to/cert.pem --key /path/to/key.pem 6081 localhost:5900
```

When using standalone websockify, set `WEBSOCKIFY_ENABLED=false` in `.env` to disable
the built-in proxy. Set `VNC_DEFAULT_PORT` to the websockify listen port.

---

### Option C — VNC server with native WebSocket support

TigerVNC 1.11+, RealVNC Enterprise, and some other servers support WebSocket directly.
In this case no bridge is needed at all. Point WebVNC directly at the VNC server's
WebSocket port and set `WEBSOCKIFY_ENABLED=false`.

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and edit:

```bash
cp .env.example .env
```

| Variable               | Default       | Description                                               |
|------------------------|---------------|-----------------------------------------------------------|
| `NODE_ENV`             | `development` | `development` / `production` / `test`                    |
| `HOST`                 | `0.0.0.0`     | Bind address for the WebVNC HTTP server                   |
| `PORT`                 | `3020`        | HTTP port for the WebVNC server                           |
| `LOG_LEVEL`            | `info`        | Pino log level (`trace` `debug` `info` `warn` `error`)   |
| `CORS_ORIGIN`          | `*`           | Allowed CORS origin. Set to your domain in production     |
| `RATE_LIMIT_MAX`       | `100`         | Maximum requests per window per IP                        |
| `RATE_LIMIT_WINDOW_MS` | `60000`       | Rate limit window in milliseconds                         |
| `VNC_DEFAULT_HOST`     | `localhost`   | Default VNC host pre-filled in the UI                     |
| `VNC_DEFAULT_PORT`     | `6080`        | Default VNC port pre-filled in the UI                     |
| `VNC_DEFAULT_PATH`     | `/`           | Default WebSocket path                                    |
| `VNC_DEFAULT_ENCRYPT`  | `false`       | Use `wss://` by default                                   |
| `WEBSOCKIFY_ENABLED`   | `true`        | Enable the built-in WebSocket-to-TCP bridge               |
| `WEBSOCKIFY_PORT`      | `6080`        | Port the built-in bridge listens on                       |
| `WEBSOCKIFY_HOST`      | `0.0.0.0`     | Bind address for the built-in bridge                      |
| `TRUST_PROXY`          | `false`       | Set `true` when running behind nginx / traefik / Caddy    |

---

## URL parameters

The `/vnc.html` viewer page accepts all connection settings as URL query parameters.
This is useful for bookmarks, deep links, kiosk setups, or embedding.

```
http://localhost:3020/vnc.html?host=myserver&port=6080&encrypt=false&autoConnect=true
```

| Parameter          | Type    | Default     | Description                                    |
|--------------------|---------|-------------|------------------------------------------------|
| `host`             | string  | `localhost` | VNC server hostname or IP                      |
| `port`             | number  | `6080`      | WebSocket port                                 |
| `path`             | string  | `/`         | WebSocket path                                 |
| `password`         | string  | —           | Pre-fill password (not stored or logged)        |
| `encrypt`          | boolean | `false`     | Use `wss://` instead of `ws://`                |
| `shared`           | boolean | `true`      | Allow multiple simultaneous VNC connections     |
| `viewOnly`         | boolean | `false`     | Disable keyboard/mouse input                   |
| `autoConnect`      | boolean | `false`     | Connect immediately on page load               |
| `reconnect`        | boolean | `false`     | Auto-reconnect on unexpected disconnect        |
| `reconnectDelay`   | number  | `3020`      | Delay before reconnect attempt (ms)            |
| `repeaterId`       | string  | —           | UltraVNC repeater ID                           |
| `qualityLevel`     | number  | `6`         | JPEG quality 0–9 (0 = lossless)                |
| `compressionLevel` | number  | `2`         | Zlib compression 0–9                           |
| `showDotCursor`    | boolean | `false`     | Show a dot cursor when the remote cursor is hidden |
| `clipboardUp`      | boolean | `true`      | Send local clipboard to remote                 |
| `clipboardDown`    | boolean | `true`      | Receive remote clipboard locally               |
| `scaleMode`        | string  | `fit`       | `fit` / `real` / `remote` / `zoom`             |
| `zoomLevel`        | number  | `1.0`       | Zoom multiplier when `scaleMode=zoom`          |

---

## API

| Method | Path                | Description                                 |
|--------|---------------------|---------------------------------------------|
| `GET`  | `/api/health`       | Health check — returns server status        |
| `GET`  | `/api/vnc/defaults` | Returns server-configured VNC defaults      |
| `POST` | `/api/vnc/validate` | Validates connection parameter object       |

---

## Production deployment

```bash
# Build client and server
npm run build

# Start the production server
npm start
```

The server listens on `HOST:PORT` (default `0.0.0.0:3020`).

**Recommended nginx reverse proxy config:**

```nginx
server {
    listen 443 ssl;
    server_name vnc.example.com;

    ssl_certificate     /etc/letsencrypt/live/vnc.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vnc.example.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }
}
```

Set `TRUST_PROXY=true` and `CORS_ORIGIN=https://vnc.example.com` in `.env`.

---

## Docker

```bash
# Build and start with docker compose
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

The compose file exposes port `3020` (HTTP) and `6080` (built-in websockify bridge).
Set VNC target host/port via environment variables in `.env` or directly in
`docker-compose.yml`.

To connect to a VNC server running on the Docker host machine, use the host's LAN IP
rather than `localhost` inside the container (`172.17.0.1` on default Docker networks,
or use `host.docker.internal` on Docker Desktop).

---

## Development scripts

| Command                  | Description                                      |
|--------------------------|--------------------------------------------------|
| `npm run dev`            | Start all dev servers (Fastify + Vite HMR)       |
| `npm run build`          | Production build (client + server)               |
| `npm start`              | Start production server                          |
| `npm test`               | Run test suite                                   |
| `npm run test:coverage`  | Run tests with coverage report                   |
| `npm run lint`           | Lint TypeScript                                  |
| `npm run lint:fix`       | Auto-fix lint issues                             |
| `npm run format`         | Format source files with Prettier                |
| `npm run typecheck`      | Type-check without emitting                      |
| `npm run clean`          | Delete `dist/`                                   |

---

## Project structure

```
src/
  server/
    config/          Zod-validated environment config
    plugins/         Fastify plugins (CORS, Helmet, rate-limit, static)
    routes/
      api/           /api/health, /api/vnc/* route handlers
    services/        Websockify bridge and other server services
    app.ts           Fastify app factory
    index.ts         Server entry point
    types.ts         Shared server types
  client/
    components/      Dashboard UI components (ConnectionForm, AdvancedSettings, etc.)
    vnc/             noVNC integration (VncClient, VncApp)
    styles/          CSS design system (global, components, dashboard, vnc)
    utils/           params (URL/storage serialisation), events (emitter, logger)
    main.ts          Dashboard entry point
    types.ts         Shared client types
tests/
  server/            Fastify route integration tests
  client/            Client utility unit tests
installer/
  webvnc-setup.ps1  Windows interactive installer script
  build-exe.ps1     Compiles the installer script to a standalone .exe
```

---

## Windows installer

An interactive PowerShell installer is included under `installer/`. It handles the
full setup on Windows without any prior knowledge of Node.js or npm.

**What the installer does:**

1. Checks for Node.js 20+ and installs it via `winget` if missing
2. Checks for Python 3 and installs it via `winget` if missing (needed for standalone websockify)
3. Installs `websockify` via `pip` (optional, only if you decline the built-in bridge)
4. Runs `npm install` and `npm run build`
5. Creates a `.env` from `.env.example` with values you provide interactively
6. Optionally opens the UltraVNC download page in your browser
7. Creates a `Start WebVNC.bat` launcher on your Desktop

**Running the PowerShell script directly:**

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\installer\webvnc-setup.ps1
```

**Building a standalone .exe:**

The `build-exe.ps1` script compiles the installer into a self-contained `.exe` using
[ps2exe](https://github.com/MScholtes/PS2EXE) from the PowerShell Gallery.

```powershell
.\installer\build-exe.ps1
# Output: installer\WebVNC-Setup.exe
```

Run `WebVNC-Setup.exe` on any Windows 10/11 machine — no PowerShell knowledge required.

---

## Roadmap

- Connection profiles (save and switch named sessions)
- Built-in access control / authentication layer
- Audit log for connections
- Multi-session management dashboard
- Theme presets
- WebRTC tunnel option

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) © 2026 elias4044


![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js ≥ 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)

A production-ready, self-hostable VNC client for the browser. Connect to any
VNC server directly from a clean, minimal dark web interface.

---

## Features

- 🖥️  **Full noVNC integration** — WebSocket VNC via the battle-tested noVNC library  
- ⚡  **Fastify backend** — Fast, structured logging, plugin-based, strict TypeScript  
- 🎨  **Dark minimal UI** — CSS design system, responsive, no framework required  
- 🔧  **All noVNC options** — encrypt, shared, view-only, clipboard, quality, reconnect…  
- 🔒  **Secure defaults** — Helmet headers, rate limiting, CORS, input validation  
- 🐳  **Docker ready** — Dockerfile + docker-compose included  
- 🧪  **Tested** — Vitest test suite with coverage  
- 🔌  **Extensible** — Plugin architecture for future features (profiles, auth, multi-session)

---

## Quick start

```bash
# Clone
git clone https://github.com/elias4044/webvnc.git
cd webvnc

# Install
npm install

# Configure
cp .env.example .env
# Edit .env — set VNC_DEFAULT_HOST etc.

# Develop (Fastify + Vite HMR in parallel)
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Production

```bash
# Build client + server
npm run build

# Start production server
npm start
```

Or with Docker:

```bash
docker compose up -d
```

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env`:

| Variable               | Default         | Description                                      |
|------------------------|-----------------|--------------------------------------------------|
| `NODE_ENV`             | `development`   | `development` / `production` / `test`            |
| `HOST`                 | `0.0.0.0`       | Bind address                                     |
| `PORT`                 | `3020`          | HTTP port                                        |
| `LOG_LEVEL`            | `info`          | Pino log level                                   |
| `CORS_ORIGIN`          | `*`             | Allowed CORS origin(s)                           |
| `RATE_LIMIT_MAX`       | `100`           | Max requests per window                          |
| `RATE_LIMIT_WINDOW_MS` | `60000`         | Rate limit window (ms)                           |
| `VNC_DEFAULT_HOST`     | `localhost`     | Default VNC host shown in UI                     |
| `VNC_DEFAULT_PORT`     | `5900`          | Default VNC port                                 |
| `VNC_DEFAULT_PATH`     | `/`             | Default WebSocket path                           |
| `VNC_DEFAULT_ENCRYPT`  | `false`         | Use TLS by default                               |
| `TRUST_PROXY`          | `false`         | Set `true` behind nginx/traefik                  |

---

## VNC connection

WebVNC connects the browser to a VNC server via WebSocket. You need a WebSocket
bridge. Two common approaches:

### Option A — websockify (recommended)

```bash
# Install websockify
pip install websockify

# Bridge port 6080 (WS) → 5900 (VNC)
websockify 6080 localhost:5900
```

Set `VNC_DEFAULT_PORT=6080` (or enter `6080` in the UI).

### Option B — VNC server with built-in WebSocket support

Some VNC servers (e.g. TigerVNC ≥ 1.11, RealVNC) support WebSocket natively.
Point WebVNC directly at the WebSocket port.

---

## API

| Method | Path                | Description                          |
|--------|---------------------|--------------------------------------|
| GET    | `/api/health`       | Health check                         |
| GET    | `/api/vnc/defaults` | Server-configured VNC defaults       |
| POST   | `/api/vnc/validate` | Validate connection params           |

---

## URL parameters

The `/vnc.html` viewer accepts all connection settings via query parameters,
useful for deep-linking or embedding:

```
/vnc.html?host=myserver&port=6080&encrypt=true&autoConnect=true&viewOnly=true
```

| Parameter          | Type    | Default     |
|--------------------|---------|-------------|
| `host`             | string  | `localhost` |
| `port`             | number  | `5900`      |
| `path`             | string  | `/`         |
| `password`         | string  | —           |
| `encrypt`          | boolean | `false`     |
| `shared`           | boolean | `true`      |
| `viewOnly`         | boolean | `false`     |
| `autoConnect`      | boolean | `false`     |
| `reconnect`        | boolean | `false`     |
| `reconnectDelay`   | number  | `3020`      |
| `repeaterId`       | string  | —           |
| `qualityLevel`     | number  | `6`         |
| `compressionLevel` | number  | `2`         |
| `showDotCursor`    | boolean | `false`     |
| `clipboardUp`      | boolean | `true`      |
| `clipboardDown`    | boolean | `true`      |

---

## Development scripts

```bash
npm run dev            # Start all dev servers
npm run build          # Production build
npm start              # Production server
npm test               # Run tests
npm run test:coverage  # Test + coverage report
npm run lint           # Lint TypeScript
npm run lint:fix       # Auto-fix lint issues
npm run format         # Prettier format
npm run typecheck      # TypeScript type check
npm run clean          # Remove dist/
```

---

## Project structure

```
src/
  server/
    config/        Zod-validated environment config
    plugins/       Fastify plugins (CORS, helmet, rate-limit, static)
    routes/
      api/         /api/health, /api/vnc/* handlers
    services/      Business logic (extensible)
    utils/         Server utilities
    app.ts         Fastify app factory
    index.ts       Server entry point
    types.ts       Shared server types
  client/
    components/    Dashboard UI (ConnectionForm, AdvancedSettings, LogViewer, StatusBar)
    vnc/           noVNC integration (VncClient, VncApp)
    styles/        CSS design system (global, components, dashboard, vnc)
    utils/         params (URL/storage), events (emitter, logger)
    main.ts        Dashboard entry
    types.ts       Shared client types
tests/
  server/          Fastify route tests
  client/          Client utility tests
```

---

## Roadmap

- [ ] Connection profiles (save named sessions)
- [ ] Theme presets
- [ ] Audit log
- [ ] Access control / authentication
- [ ] Multi-session management
- [ ] WebRTC tunnel option

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) © 2026 elias4044
