# Library Management System

A library management application for a small/neighbourhood library: catalog and inventory
management, membership records, staff accounts with role-based access, a checkout/return
circulation desk, and a fee/payment ledger.

Backend: **FastAPI** (Python, async SQLAlchemy, PostgreSQL). Frontend: **React** (TypeScript, Vite,
Redux Toolkit, MUI). The two are independently documented in [`backend/README.md`](backend/README.md)
and [`frontend/library-fe/README.md`](frontend/library-fe/README.md); this file covers the system as
a whole.

## Architecture overview

```mermaid
flowchart LR
    subgraph Browser
        FE["React SPA<br/>(Redux Toolkit, MUI)"]
    end
    subgraph "frontend container (nginx)"
        NG["nginx<br/>serves static build<br/>proxies /api/"]
    end
    subgraph "backend container"
        API["FastAPI<br/>api → services → repositories"]
    end
    subgraph "db container"
        PG[("PostgreSQL 17")]
    end

    FE -->|"HTTP (same-origin)"| NG
    NG -->|"/api/* proxy_pass"| API
    API -->|"async SQLAlchemy"| PG
```

In production (Docker Compose), the browser only ever talks to nginx; nginx proxies `/api/` to the
backend container so the app is same-origin and CORS is not on the critical path. In local
development, the frontend's Vite dev server proxies `/api` to the backend directly instead, and the
backend's own CORS middleware (`CORS_ALLOW_ORIGINS`) is what allows requests from
`http://localhost:5173`.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Redux Toolkit, React Router v7, MUI v9, Axios |
| Backend | Python 3.14, FastAPI, SQLAlchemy 2.0 (async), Pydantic, Alembic, PyJWT, bcrypt |
| Database | PostgreSQL 17 |
| Frontend tests | Vitest, React Testing Library, MSW, Playwright |
| Backend tests | pytest, pytest-asyncio, httpx |
| Containerization | Docker, Docker Compose, nginx (frontend), uv (backend package manager) |
| CI | GitHub Actions (frontend pipeline only — see [Engineering decisions](#engineering-decisions--assumptions)) |

## Repository structure

```
.
├── backend/                  FastAPI application (see backend/README.md)
│   ├── api/                  Route handlers (one module per resource)
│   ├── services/              Business logic, raises domain exceptions
│   ├── repositories/          Data-access layer over SQLAlchemy models
│   ├── models/                 ORM models and enums
│   ├── alembic/                 Database migrations
│   ├── scripts/                 Container entrypoint, sample-data seed script
│   ├── sql/schema-lms.sql       Stale historical schema snapshot — not used by any code path
│   └── tests/                   pytest suite
├── frontend/
│   └── library-fe/            React application (see frontend/library-fe/README.md)
│       ├── src/                 Application source (features, pages, redux, etc.)
│       └── e2e/                  Playwright end-to-end specs
├── docker/postgres-init/     Init script that creates the pytest database on a fresh volume
├── docker-compose.yml        Three-service stack: db, backend, frontend
└── .github/workflows/        CI (frontend lint/typecheck/test/build/e2e)
```

`docs/` and `scripts/` exist at the repository root but are currently empty.

## Backend overview

FastAPI app with a strict layering: `api` (HTTP/Pydantic) → `services` (business rules, raises typed
domain exceptions) → `repositories` (SQLAlchemy queries) → `models` (ORM). Auth is stateless JWT
bearer tokens with two roles, `ADMIN` and `LIBRARIAN`. Resources: books, categories, book copies,
members, staff, loans, and fee/payment transactions. All list endpoints return a common
`{items, total, skip, limit}` page envelope with filtering and sorting. Full detail in
[`backend/README.md`](backend/README.md).

## Frontend overview

A staff-facing single-page app for the workflows above: catalog/inventory CRUD, member records, the
circulation desk, staff administration, and a dashboard with an overdue-loans report. State is held
in Redux Toolkit slices (one per feature), each feature following the same
`types → service → slice → hook → form dialog → page` shape. Full detail in
[`frontend/library-fe/README.md`](frontend/library-fe/README.md).

## High-level application flow

1. A staff member logs in (`POST /api/v1/auth/login`); the frontend stores the returned JWT and
   attaches it as a bearer token to subsequent requests.
2. Librarians manage the catalog (books, categories) and inventory (individual book copies).
3. Librarians register members and issue loans against an available copy; the due date and per-day
   late fee are computed server-side from the copy's configuration.
4. On return, the backend computes any overdue fine and updates the copy's condition/status.
5. Fines and other charges are recorded as transactions and can be paid, failed, or waived.
6. The dashboard surfaces catalog/member/loan counts and an overdue-loans report.

## Features

- Book and category catalog management, with archive/unarchive instead of hard delete
- Book copy inventory per title (condition, shelf location, borrow duration, late-fee rate), with
  hard delete
- Member management (contact and government-ID records), with suspend/reactivate and hard delete
- Staff accounts with two roles (`ADMIN`, `LIBRARIAN`), activate/deactivate, self-service password
  change
- JWT-based authentication; role-gated endpoints for staff administration
- Loan issue/return workflow with server-computed due dates and late-fee calculation
- Fee/payment ledger (late fees, damage fees, waivers) with pay/fail/waive transitions
- Overdue-loans report
- Pagination, filtering, and sorting on every list endpoint

## Screenshots

_No screenshots are currently included in this repository._

## Quick start

Requires Docker and Docker Compose.

```bash
docker compose up --build
```

This starts three containers:

| Service | Image / build | Port | Purpose |
|---|---|---|---|
| `db` | `postgres:17-alpine` | `5432` | Database (`library_db`), plus a `library_test_db` created only on a fresh volume |
| `backend` | `backend/Dockerfile` | `8000` | Runs migrations on startup, then the FastAPI app |
| `frontend` | `frontend/library-fe/Dockerfile` | `80` | nginx serving the built SPA, proxying `/api/` to `backend` |

The backend container waits for Postgres to report healthy, then runs `alembic upgrade head`, then
(because `SEED_SAMPLE_DATA=true` by default in `docker-compose.yml`) seeds a sample catalogue. The
seed is idempotent — restarting does not duplicate rows. Set `SEED_SAMPLE_DATA` to `false` to start
from an empty database.

Open `http://localhost` and sign in with the seeded admin account:

| Field | Value |
|---|---|
| Email | `admin@locallibrary.com` |
| Password | `admin$12345` |

## Local development (without Docker)

Run the database via Docker and the two apps directly, for faster iteration:

```bash
docker compose up db
```

```bash
# backend — see backend/README.md for details
cd backend
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run fastapi dev main.py
```

```bash
# frontend — see frontend/library-fe/README.md for details
cd frontend/library-fe
npm install
cp .env.example .env
npm run dev
```

## Environment variables

Each app has its own `.env.example`. Summary:

**`backend/.env.example`**

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://user:password@localhost:5432/library_db` | Primary database connection |
| `LOG_LEVEL` | `INFO` | Root logger level |
| `ENVIRONMENT` | `local` | Free-text environment label |
| `JWT_SECRET_KEY` | placeholder — **must be overridden in real deployments** | JWT signing secret |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_EXPIRE_MINUTES` | `60` | Access token lifetime |
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173,http://localhost` | Allowed browser origins (comma-separated) |

`TEST_DATABASE_URL` (defaults to `library_test_db` on the same host) is also read, but only by the
pytest suite, never by the running app.

**`frontend/library-fe/.env.example`**

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Axios base URL, read client-side |
| `VITE_API_PROXY_TARGET` | `http://localhost:8000` | Dev-server proxy target for `/api`, read only by Vite (Node), not shipped to the client |

## Running tests

```bash
# backend
cd backend
uv run pytest -q

# frontend — unit/component
cd frontend/library-fe
npm test

# frontend — end-to-end (builds and serves the app, mocks the API)
npm run e2e
```

See each project's README for coverage flags, linting/type-checking commands, and what the test
suites cover.

## Engineering decisions & assumptions

- **Layered backend, no framework magic**: `api → services → repositories → models` is enforced by
  convention — services never raise `HTTPException` (a single pair of exception handlers maps a
  typed domain-exception hierarchy to HTTP status codes), and routes never query the database
  directly (the `/health` endpoint is the one deliberate exception).
- **Archive instead of delete for catalog data**: books and categories are soft-archived rather than
  deleted, since they may be referenced by loan history. Book copies, members, and staff support hard
  delete, but fail with `409 Conflict` if referenced by loan/transaction history.
- **Database-enforced invariants, not just application checks**: for example, a partial unique index
  guarantees a copy can have at most one active loan, backing up (not replacing) the service-layer
  pre-check.
- **Same-origin API in production**: nginx proxies `/api/` to the backend container so the deployed
  frontend never depends on CORS; CORS middleware exists on the backend for local development only.
- **No ORM lazy loading by default**: relationships are `lazy="raise"` unless explicitly eager-loaded,
  so an accidental N+1 query fails fast in tests instead of silently degrading.
- **CI covers the frontend only.** `.github/workflows/ci.yml` runs lint, type-check, unit tests,
  build, and Playwright e2e for `frontend/library-fe`. There is no backend CI job — running
  `pytest`/`ruff`/`mypy` locally (or adding a workflow) is left to the developer.
- **`backend/sql/schema-lms.sql` is historical only.** It predates the categories table and
  `book.is_archived` column and is not read by any code path; Alembic is the sole source of truth for
  the schema.
- **Unauthenticated project scope**: this is an interview/portfolio project, not a hardened
  production service — see [Future improvements](#future-improvements) for known gaps.

## Future improvements

- Add a backend CI job (pytest, ruff, mypy) alongside the existing frontend pipeline.
- Require authentication on the three currently-unauthenticated loan read endpoints
  (`GET /api/v1/loans`, `/loans/overdue`, `/loans/{id}`), for consistency with the rest of the API.
- Add request/correlation-ID logging middleware for cross-service log tracing.
- Add rate limiting, refresh tokens, and a password-reset flow.
- Wire `Settings.api_prefix` through to the routers instead of hardcoding `/api/v1` per router, or
  remove the unused setting.
- Add screenshots or a short demo recording to this README.

## License

No license file is currently included in this repository.
