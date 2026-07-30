# Backend

FastAPI + SQLAlchemy (async) + PostgreSQL, behind a `Page[T]`-enveloped, JWT-authenticated API.

## Architecture

Strict one-directional layering:

```
api/*.py  →  services/*.py  →  repositories/*.py  →  db/repository.py (BaseRepository)  →  models/*.py
```

```mermaid
flowchart TD
    Client -->|Bearer JWT| Router["api/*.py<br/>FastAPI routers, Pydantic models"]
    Router --> Service["services/*.py<br/>business rules, domain exceptions"]
    Service --> Repo["repositories/*.py<br/>+ db/repository.BaseRepository"]
    Repo --> ORM["models/*.py<br/>SQLAlchemy 2.0 async ORM"]
    ORM --> DB[(PostgreSQL)]
    Router -.->|DomainException| Handler["app/exception_handlers.py<br/>→ HTTP status + JSON body"]
```

### Layer responsibilities

- **`api/`** — one router module per resource. Defines request/response Pydantic models inline,
  validates input, calls a service, serializes the result. Never queries the database directly
  (`api/health.py` is the one deliberate exception, for a liveness probe).
- **`services/`** — one class per aggregate (`BookService`, `LoanService`, `AuthService`, etc.).
  Owns one or more repositories, implements all business rules (uniqueness checks, state
  transitions, fine calculation), and raises typed `DomainException` subclasses — never
  `HTTPException`. Calls `session.flush()`, not `commit()`; the request's transaction boundary is
  owned by `db/session.get_db`.
- **`repositories/`** — thin subclasses of `BaseRepository[ModelT]` adding only natural-key lookups
  (`get_by_email`, `get_by_isbn`, `get_active_loan_for_copy`, …). No business logic.
- **`db/repository.py::BaseRepository`** — generic CRUD plus `list_paginated`: filters, sorting with
  a guaranteed primary-key tiebreaker, optional eager-load options, optional joins for cross-table
  sort/filter, and a matching `COUNT` query for the page envelope's `total`.
- **`models/`** — SQLAlchemy 2.0 declarative ORM models. Relationships default to `lazy="raise"`; the
  one exception is `Book.category` (`lazy="selectin"`), so an accidental N+1 access fails fast in
  tests rather than silently degrading.
- **`core/`** — cross-cutting concerns: `config.py` (settings), `exceptions.py` (domain exception
  hierarchy), `logging.py` (JSON logging setup), `security.py` (JWT + bcrypt), `pagination.py`
  (shared sort-direction enum).
- **`app/factory.py`** — builds the FastAPI app: CORS middleware, exception handlers, and the 8
  routers (health, auth, books, categories, book-copies, members, staff, loans, transactions). No
  other middleware exists — no request-ID, access-logging, or rate-limiting middleware.
- **`db/session.py`** — one process-wide async engine and `async_sessionmaker`. `get_db()` is the
  FastAPI dependency: opens a session, commits on success, rolls back on any exception. This is the
  single transaction boundary per request.

## Folder structure

```
backend/
├── main.py              ASGI entrypoint (uv run fastapi run main.py)
├── app/                 App factory, exception handlers
├── api/                 Route handlers (one module per resource) + shared deps/pagination/validators
├── services/            Business logic
├── repositories/        Data access
├── models/              ORM models, enums, mixins
├── db/                  Declarative base, async engine/session, generic repository
├── core/                Config, security, logging, domain exceptions
├── alembic/             Migrations (env.py + versions/)
├── scripts/             Container entrypoint (entrypoint.sh), sample-data seed (seed.py)
├── sql/schema-lms.sql   Stale historical schema snapshot — not used by any code path
└── tests/               pytest suite
```

## Technology stack

Python 3.14, FastAPI, SQLAlchemy 2.0 (async, `psycopg[binary]` driver), Pydantic / pydantic-settings,
Alembic, PyJWT, bcrypt. Package management via `uv`. Dev tooling: pytest + pytest-asyncio, ruff,
black, mypy (strict).

## API overview

Base path `/api/v1` (hardcoded per router; `Settings.api_prefix` exists but is currently unused).
All list endpoints return `{items, total, skip, limit}` and accept `skip`/`limit`/`sort_by`/`sort_dir`
plus resource-specific filters. Auth column: **staff** = any active staff bearer token; **admin** =
`ADMIN` role required; **none** = no auth dependency.

| Resource | Endpoints | Auth |
|---|---|---|
| Health | `GET /health` | none |
| Auth | `POST /auth/login`, `GET /auth/me` | none / staff |
| Books | `POST`, `GET`, `GET /search`, `GET /{id}`, `PUT /{id}`, `POST /{id}/archive`, `POST /{id}/unarchive` | staff |
| Categories | `POST`, `GET`, `GET /{id}`, `PUT /{id}`, `POST /{id}/archive`, `POST /{id}/unarchive` | staff |
| Book copies | `POST`, `GET`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` | staff |
| Members | `POST`, `GET`, `GET /search`, `GET /{id}`, `PUT /{id}`, `POST /{id}/suspend`, `POST /{id}/reactivate`, `DELETE /{id}` | staff |
| Staff | `GET`, `GET /{id}` (staff) · `POST`, `PUT /{id}`, `POST /{id}/deactivate`, `POST /{id}/activate`, `DELETE /{id}` (admin) · `POST /{id}/change-password` (self or admin) | mixed |
| Loans | `POST /loans`, `POST /loans/{id}/return` (staff) · `GET /loans`, `GET /loans/overdue`, `GET /loans/{id}` (**none**) | mixed |
| Transactions | `POST`, `GET`, `GET /{id}`, `POST /{id}/pay`, `POST /{id}/fail`, `POST /{id}/waive` | staff |

Books/categories have no `DELETE` (archive/unarchive instead); book copies, members, and staff
support `DELETE` but return `409 Conflict` if referenced by loan/transaction history (an
`IntegrityError` from the FK `RESTRICT` constraint, caught and translated by the service).

**Known gap**: `GET /loans`, `GET /loans/overdue`, and `GET /loans/{id}` require no authentication,
unlike every other list/get endpoint in the API — this looks like an oversight rather than an
intentional public report and is tracked in the root README's future-improvements list.

Interactive docs are available at `/docs` (Swagger UI) once the app is running; the "Authorize"
button accepts the JWT returned by `/auth/login`.

## Database

PostgreSQL. Seven tables: `staff`, `member`, `category`, `book`, `book_copy`, `loan`, `transaction`.
Enums (`models/enums.py`) are native Postgres enum types created by migrations, not by SQLAlchemy.

Notable constraints:

- `book.isbn`, `member.email`, `staff.email`, `book_copy.barcode` are unique.
- `member` has a compound unique constraint on `(government_id_type, government_id_number)`.
- `loan` has a **partial unique index** on `copy_id` where `status = 'ACTIVE'` — the database-level
  guarantee that a copy can have at most one active loan (the service-layer availability check is
  advisory; this index is authoritative and is why loan issuance also handles `IntegrityError` as a
  fallback).
- Foreign keys from `book_copy`/`loan`/`transaction` back to `book`/`member`/`staff` use
  `ondelete="RESTRICT"` — this is what makes catalog archiving (rather than deletion) necessary once
  a book/category has been used, and what makes copy/member/staff deletion fail with `409` once they
  have history.

## Migrations

Alembic, with two migrations to date:

1. `996e4dceab29_initial_schema.py` — initial schema (staff, member, book with a free-text category
   column, book_copy, loan, transaction, all enums/constraints).
2. `7f3c1a9e5b02_category_table_and_book_is_archived.py` — adds the `category` table and
   `book.category_id` / `book.is_archived`, migrating off the free-text column.

```bash
uv run alembic upgrade head
uv run alembic downgrade -1
uv run alembic revision --autogenerate -m "..."
```

If you have an existing `library_db` volume created before Alembic was introduced (e.g. from
`sql/schema-lms.sql` directly), `alembic upgrade head` will try to re-create tables that already
exist. Either `docker compose down -v` for a clean start, or
`uv run alembic stamp 996e4dceab29` to tell Alembic the initial schema is already applied.

`sql/schema-lms.sql` is a **stale, historical snapshot** (per its own header comment) — it predates
the categories table and `book.is_archived` and is not read by any application code. Alembic is the
sole source of truth for the schema.

## Running locally

```bash
docker compose up --build
```

This brings up Postgres, then the backend container's entrypoint (`scripts/entrypoint.sh`) waits for
the database, runs `alembic upgrade head`, and — because `SEED_SAMPLE_DATA=true` in
`docker-compose.yml` — populates the catalogue with sample categories, books, copies, members, staff
and loans. The seed is idempotent: restarting the backend does not duplicate rows or touch anything
you've since edited through the app.

Set `SEED_SAMPLE_DATA=false` (or unset it) to skip seeding and start from an empty catalogue instead.

To run the API directly against a Postgres instance (e.g. `docker compose up db`):

```bash
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run fastapi dev main.py
```

### Seeded admin login

| Field | Value |
|---|---|
| Email | `admin@locallibrary.com` |
| Password | `admin$12345` |
| Employee code | `LL-001` |
| Role | ADMIN |

Three additional LIBRARIAN accounts are also seeded (`LL-002`–`LL-004`); `LL-004` is deliberately
`INACTIVE` so deactivated-login and staff-status behaviour has sample data to exercise against.

## Docker

Single-stage build (`python:3.14-slim`), package management via `uv sync --frozen --no-dev`. The
entrypoint (`scripts/entrypoint.sh`) polls the database until reachable, runs migrations, optionally
seeds sample data, then execs into `fastapi run main.py`. This is a shell script rather than a
FastAPI startup hook because multiple worker processes would otherwise race on migrations/seeding,
and it must not run at all during pytest.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://user:password@localhost:5432/library_db` | Primary database connection |
| `LOG_LEVEL` | `INFO` | Root logger level |
| `ENVIRONMENT` | `local` | Free-text environment label |
| `JWT_SECRET_KEY` | placeholder — **override in real deployments** | JWT signing secret |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_EXPIRE_MINUTES` | `60` | Access token lifetime |
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173,http://localhost` | Allowed browser origins, comma- or JSON-list format |

`TEST_DATABASE_URL` (default `postgresql+psycopg://user:password@localhost:5432/library_test_db`) is
also read by `Settings`, but only consumed by the pytest suite — never by the running app. `SEED_SAMPLE_DATA`
is read directly by `scripts/entrypoint.sh`/`scripts/seed.py`, not by `Settings`.

## Testing

```bash
uv run pytest -q
uv run ruff check . && uv run ruff format --check .
uv run mypy .
```

pytest runs against a **separate** database (`TEST_DATABASE_URL`, default `library_test_db`), never
`library_db` — the one the entrypoint seeds. `docker-compose.yml` creates both databases on a fresh
Postgres volume (see `docker/postgres-init/`). If you're running against a pre-existing volume that
predates this, either drop it (`docker compose down -v`) or create `library_test_db` by hand.

`tests/conftest.py` runs `alembic upgrade head` once per session against the test database, then
isolates each test in a transaction/savepoint that's rolled back afterward — no manual cleanup
between tests. HTTP-level tests use `httpx.AsyncClient` against the app in-process (no real network).
Auth fixtures mint bearer tokens directly rather than going through `/auth/login`. The suite mixes
service-layer unit tests with HTTP endpoint tests across 14 files (auth, books, book copies,
categories, config, CORS, error mapping, health, loans, members, seed, staff, transactions).

## Logging

`core/logging.py` installs a single stdout handler emitting one JSON object per line (`timestamp`,
`level`, `logger`, `message`, plus any `extra` fields, plus a formatted traceback on exceptions).
Services log business events (`book_created`, `loan_issued`, `staff_deactivated`, etc.) via
`logger.info(..., extra={...})`. There is **no request-ID/correlation-ID tracking and no access-log
middleware** — logging is limited to ad hoc business events plus the two exception-handler log lines
below.

## Error handling

`core/exceptions.py` defines a `DomainException` base with a fixed hierarchy (`NotFoundError`,
`ConflictError` and its subclasses, `AuthenticationException`, `AuthorizationException`, etc.), each
with a default message. Services only ever raise these — never `HTTPException` (the one exception is
`api/books.py`'s search endpoint, which raises a plain `400` directly for a missing search
parameter).

`app/exception_handlers.py` installs two handlers:

- `DomainException` → mapped by type to `401`/`403`/`404`/`409`/`400`, returned as
  `{"detail": message}`, logged at `warning`.
- Any other `Exception` → logged at `error` with the traceback, returned as a generic
  `500 {"detail": "Internal server error"}` — no internals leaked to the client.

FastAPI's own request-validation errors (`422`, list-shaped `detail`) pass through untouched. This
contract is pinned by `tests/test_error_mapping.py`.

## Design decisions

- **No `HTTPException` in services** — keeps business logic testable and HTTP-agnostic; the mapping
  from domain exception to status code lives in exactly one place.
- **Archive instead of delete for books/categories**, since they're the parent side of `RESTRICT`
  foreign keys once referenced by copies/loans; hard delete is reserved for copies, members, and
  staff, and even then only succeeds if no history references them.
- **`lazy="raise"` by default on ORM relationships** to force explicit eager-loading and catch N+1
  access at test time instead of in production.
- **A generic single failure message for all login failures** (unknown email, wrong password,
  inactive account) to avoid user enumeration.
- **Staff status is re-checked on every request**, not just at login, so deactivating an account
  invalidates its existing token immediately without a revocation list.
- **Seed data is idempotent and keyed by natural key** (email/ISBN/barcode), not by its
  deterministically-derived UUID, so it tolerates a database that already has hand-entered rows with
  the same natural keys.

## Assumptions

- Single-tenant, staff-only application — no public/member-facing API surface.
- Two roles are sufficient (`ADMIN`, `LIBRARIAN`); no fine-grained permission system.
- A copy belongs to exactly one book and is tracked individually (not just a stock count).

## Trade-offs

- No request-ID/correlation-ID propagation or access-log middleware — acceptable for a
  single-process/single-instance deployment, would need addressing before running multiple backend
  replicas behind a load balancer.
- No rate limiting, refresh tokens, or password-reset flow — out of scope for the current stage.
- `Settings.api_prefix` is defined but unused (each router hardcodes `/api/v1`); harmless today but
  a source of drift if the prefix ever needs to change.
