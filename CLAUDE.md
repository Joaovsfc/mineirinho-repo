# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mineirinho de Ouro** is a desktop factory management app for a pão de queijo (cheese bread) factory. It's a monorepo with:

- `mineirinho-backend/` — Express + SQLite REST API (CommonJS, Node ≥ 18)
- `mineirinho-gui-kit/` — React + Vite frontend wrapped in Electron (TypeScript/ESM)
- Root `package.json` — holds shared Electron/builder dev dependencies

## Development Commands

### Backend (`mineirinho-backend/`)

```bash
cd mineirinho-backend
npm run dev       # start in development mode (NODE_ENV=development, port 3001)
npm start         # start in production mode
```

Backend requires a `.env` file. Copy from `.env.example` and set `JWT_SECRET` to a random 64-byte hex string:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Frontend / Electron (`mineirinho-gui-kit/`)

```bash
cd mineirinho-gui-kit
npm run dev              # Vite only (no Electron), http://localhost:8080
npm run electron:dev     # Vite + Electron together (use this for full dev)
npm run lint             # ESLint
npm run build            # Vite build to dist/
npm run electron:build:win    # Windows NSIS installer → dist-electron/
npm run electron:build:mac    # macOS DMG → dist-electron/
npm run electron:build:linux  # Linux AppImage → dist-electron/
```

**Always start the backend before the frontend.**

### First-time setup — create the admin user

```bash
# With backend already running:
cd mineirinho-gui-kit
node create-first-user.cjs
```

If no users exist, the backend auto-creates `admin` / `admin123` on startup.

## Architecture

### Backend

- **Entry point**: `server.cjs` — sets up Express, CORS, mounts routes, runs migrations on startup.
- **Auth**: JWT (30-day expiry). `middleware/auth.cjs` exports `authenticateToken` (all `/api/*` routes except `/api/auth`) and `requireAdmin` (admin-only routes). Tokens stored in `sessionStorage` on the frontend.
- **Database**: `better-sqlite3` (synchronous API). `database/db.cjs` resolves the DB path via `DB_PATH` env var, creates the file and directory if missing, and enables WAL mode + foreign keys.
- **Migrations**: SQL files in `database/migrations/` are applied in alphabetical order on startup. `server.cjs` handles idempotency for ALTER TABLE migrations by checking column existence with `PRAGMA table_info`.
- **Routes** (all under `/api/`):
  - `auth` — public (login, register, first-user check)
  - `products`, `clients`, `sales`, `accounts`, `consignments`, `reports`, `database` — JWT-protected

### Frontend

- **Path alias**: `@/` maps to `mineirinho-gui-kit/src/`.
- **API client**: `src/services/api.ts` — `ApiService` class using `fetch`. Base URL from `VITE_API_URL` env var, falling back to `http://localhost:3001/api`. On 401, clears `sessionStorage` and redirects to `/login`.
- **Auth state**: `src/contexts/AuthContext.tsx` — React context wrapping login/logout/register. User and token persisted in `sessionStorage`.
- **Routing**: React Router v6. `ProtectedRoute` component guards authenticated pages. Layout: `DashboardLayout` (sidebar + header with connection status + logout).
- **UI**: Radix UI primitives + Tailwind CSS + shadcn/ui components in `src/components/ui/`. `@tanstack/react-query` for server state. `sonner` / custom toast for notifications.
- **Vite config**: `base: './'` in production (required for Electron file:// URLs). Dev server on port 8080.

### Electron

- **Main process**: `electron/main.cjs` — creates `BrowserWindow` with contextIsolation, no nodeIntegration. In dev loads `http://localhost:8080`; in production loads `dist/index.html` as a `file://` URL.
- **Preload**: `electron/preload.cjs` — exposes a safe IPC bridge via `contextBridge`.
- **isDev detection**: `!app.isPackaged` (not `electron-is-dev` module).
- **Packaging**: `electron-builder` config inside `mineirinho-gui-kit/package.json`. Output: `dist-electron/`. The `dist/` (Vite build) is bundled into the installer; the backend runs separately.

### Key conventions

- Backend files use `.cjs` extension (CommonJS). Frontend/Electron use TypeScript ESM.
- No test framework is currently configured.
- Database file (`data/mineirinho.db`) and build outputs (`dist/`, `dist-electron/`) are git-ignored.
- The Windows startup scripts (`start-backend.bat`, `start-backend-hidden.vbs`, `instalar-inicializacao.bat`) are for running the backend as a background service on the client's Windows machine.
