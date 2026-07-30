# Library Management System — Frontend

The staff-facing web client for the Library Management System: catalog and inventory
management, member records, the circulation desk (checkout/return), and an operational
dashboard with an overdue-loans report.

## Tech stack

- React 19 + TypeScript, built with Vite
- MUI (Material UI) v9 for components and theming
- Redux Toolkit for state (`combineSlices`, `createAsyncThunk`)
- React Router DOM v7
- Axios for HTTP, with a DI'd auth interceptor
- Vitest + React Testing Library + MSW for unit/component tests
- Playwright for end-to-end tests

## Prerequisites

- Node.js 22+
- The backend API running and reachable (see `../../backend/README.md`), or the full
  stack via Docker Compose (see below)

## Getting started

```bash
npm install
cp .env.example .env   # adjust if your backend isn't on localhost:8000
npm run dev
```

The dev server proxies `/api/*` to the backend (`VITE_API_PROXY_TARGET` in `.env`,
default `http://localhost:8000`) — see `vite.config.ts`. Sign in with a staff account
seeded on the backend.

### Running the full stack with Docker

From the repository root:

```bash
docker compose up -d --build
```

This starts Postgres, the backend API (`:8000`), and this frontend served via nginx
(`:80`), which proxies `/api/` to the backend container — see `nginx.conf`. Rebuild
(`--build`) after backend or frontend source changes; the containers don't hot-reload.

## Available scripts

| Command                 | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Start the Vite dev server                            |
| `npm run build`         | Type-check (`tsc -b`) then build for production      |
| `npm run preview`       | Serve the production build locally                   |
| `npm run lint`          | ESLint                                               |
| `npm run format`        | Prettier — write                                     |
| `npm run format:check`  | Prettier — check only                                |
| `npm run typecheck`     | `tsc -b --noEmit`                                    |
| `npm test`              | Unit/component tests (Vitest)                        |
| `npm run test:watch`    | Unit/component tests, watch mode                     |
| `npm run test:coverage` | Unit/component tests with coverage                   |
| `npm run e2e`           | End-to-end tests (Playwright, builds + serves first) |
| `npm run e2e:install`   | Install the Playwright Chromium browser + deps       |

Before opening a PR, all of `lint`, `typecheck`, `format:check`, `test`, `build`, and
`e2e` should pass.

## Project structure

```
src/
  app/          App shell composition, providers, the top-level ErrorBoundary
  components/   Small shared components used across features (ConfirmDialog,
                FeedbackSnackbar, Loader)
  features/     One folder per domain area (auth, books, members, copies, loans,
                dashboard), each with its own types/, services/, hooks/, and
                components/
  hooks/        Cross-cutting hooks (useDebouncedValue, useDocumentTitle)
  layouts/      AppLayout, Header, Sidebar
  pages/        Route-level components — compose a feature's hook + components
                into a full page (filters, table, dialogs)
  redux/        Store setup and one slice per feature, mirroring features/
  routes/       AppRoutes, ProtectedRoute
  services/     The shared Axios instance and its auth interceptors
  theme/        MUI theme customization
  types/        Types shared across features (API envelope, domain enums)
  utils/        Small pure helpers (API error message extraction)
  tests/        Vitest setup, MSW handlers/server, the shared `render` test util
e2e/            Playwright specs (one per feature area, mocking the API at the
                network boundary via page.route)
```

Each feature follows the same internal shape: `types → service → Redux slice → hook →
form dialog → page`. See `src/features/books/**` for the canonical example.

## Testing

- **Unit/component tests** (`npm test`) run against MSW-mocked API responses and a
  real (per-test) Redux store — see `src/tests/handlers.ts` for the fixtures and
  `src/tests/test-utils.tsx` for the shared `render` wrapper (Provider + Router +
  Theme).
- **E2E tests** (`npm run e2e`) run against a production build served by `vite
preview`, with the backend API mocked via Playwright's `page.route`. They don't
  require the real backend or Docker to be running.

## Environment variables

See `.env.example`. `VITE_API_BASE_URL` is read by the app at runtime (client-side);
`VITE_API_PROXY_TARGET` is read by `vite.config.ts` (Node-side, dev server only) to
pick the dev-server proxy target and is not exposed to client code.
