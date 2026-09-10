# ProAudio Player Web UI

Realtime browser control surface for ProAudio Player.

This repository contains only the frontend client. Player logic, protocol integrations, alerts, source arbitration, audio routing and the HTTP control backend live in `proaudio-player-native`.

The new UI is developed on the `newui` branch and targets the versioned `/api/v1` contract from `proaudio-player-native/dev`.

## Stack

- SolidJS 1.x for fine-grained UI reactivity.
- TypeScript in strict mode.
- Vite 8 for development and production builds.
- Tailwind CSS 4 for layout and design tokens.
- Server-Sent Events for player/state updates.
- Canvas 2D for high-frequency level-meter rendering.
- WebSocket is reserved for the dedicated meter stream when the native backend exposes that capability.

The production player does **not** need Node.js. Vite produces static assets in `dist/`, which are served by the native daemon from `/usr/share/proaudio-player/webui`.

## Development requirements

Use Node.js 22 LTS. Vite 8 requires Node 22.12+ on the Node 22 line, and the lint toolchain is also standardized on Node 22.

```bash
nvm install 22
nvm use 22
node --version
npm --version
```

Install dependencies:

```bash
npm install
```

The first install creates `package-lock.json`. Keep that lockfile in Git once generated so local development, CI and firmware builds resolve the same dependency graph.

## Run in VS Code / WSL

Open this repository from WSL, not through the Windows filesystem:

```bash
cd ~/dev/proaudio-player-webui
git switch newui
npm install
code .
```

Recommended VS Code extensions are ESLint, Prettier and Tailwind CSS IntelliSense. Solid TSX works through the TypeScript language service and `vite-plugin-solid`.

By default the Vite development server proxies `/api/*` to `http://127.0.0.1:8080`.

If `proaudio-player-native` runs on another host, create `.env.local`:

```dotenv
PROAUDIO_BACKEND=http://192.168.88.122:8080
```

Then start the frontend:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```

To format the repository:

```bash
npm run format
```

## Source layout

```text
src/
├── api/          typed /api/v1 client and SSE transport
├── app/          application composition
├── components/   reusable UI primitives
├── features/     player, mixer and future feature modules
├── realtime/     non-reactive fast-path buffers for metering
├── state/        Solid state tied to backend events
└── styles/       Tailwind entry point and global styles
```

High-frequency meter samples must not be pushed through Solid signals on every frame. The intended path is:

```text
PipeWire -> Rust meter collector -> WebSocket -> MeterBuffer
                                               -> requestAnimationFrame
                                               -> Canvas 2D
```

Normal state uses the existing backend contract:

```text
REST /api/v1/*       -> commands and settings
SSE  /api/v1/events -> complete status updates
```

The frontend must remain optional. A player without this repository must continue to work as a headless audio appliance and API service.

## Current backend contract

The native `dev` backend currently exposes:

- `GET /api/v1/health`
- `GET /api/v1/capabilities`
- `GET /api/v1/status`
- `GET /api/v1/events`
- player, volume, mixer, output, library, playlist, queue and alert-setting resources below `/api/v1`

The meter WebSocket endpoint is intentionally not assumed to exist yet. Its protocol will be added in lockstep with `proaudio-player-native/dev`.
