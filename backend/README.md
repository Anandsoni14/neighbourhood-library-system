# Backend

FastAPI + SQLAlchemy (async) + PostgreSQL, behind a `Page[T]`-enveloped, JWT-authenticated API.

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

### Seeded admin login

| Field | Value |
|---|---|
| Email | `admin@locallibrary.com` |
| Password | `admin$12345` |
| Employee code | `LL-001` |
| Role | ADMIN |

Three additional LIBRARIAN accounts are also seeded (`LL-002`–`LL-004`); `LL-004` is deliberately
`INACTIVE` so deactivated-login and staff-status behaviour has sample data to exercise against.

## Tests

pytest runs against a **separate** database (`test_database_url`, default `library_test_db`), never
`library_db` — the one the entrypoint seeds. `docker-compose.yml` creates both databases on a fresh
Postgres volume (see `docker/postgres-init/`). If you're running against a pre-existing volume that
predates this, either drop it (`docker compose down -v`) or create `library_test_db` by hand.

```bash
uv run pytest -q
uv run ruff check . && uv run ruff format --check .
uv run mypy .
```

## Migrations

```bash
uv run alembic upgrade head
uv run alembic downgrade -1
uv run alembic revision --autogenerate -m "..."
```

If you have an existing `library_db` volume that was created before Alembic was introduced (e.g. from
`sql/schema-lms.sql` directly), `alembic upgrade head` will try to re-create tables that already exist.
Either `docker compose down -v` for a clean start, or `uv run alembic stamp 996e4dceab29` to tell
Alembic the initial schema is already applied.
