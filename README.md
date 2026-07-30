# Library Management System

A comprehensive library management application built with Python (FastAPI) backend and React frontend.

## Project Structure

- **backend/** - Python/FastAPI REST API with PostgreSQL database
- **frontend/** - React.js web application
- **docker-compose.yml** - Docker Compose configuration for development

## Getting Started

```bash
docker compose up --build
```

Brings up Postgres, migrates and seeds the backend with sample data, and serves the frontend on
`http://localhost`. Sign in with the seeded admin account:

| Field | Value |
|---|---|
| Email | `admin@locallibrary.com` |
| Password | `admin$12345` |

See README files in respective directories for further setup instructions.

## Architecture

- PostgreSQL database for data persistence
- FastAPI for REST API
- React for frontend UI
- Docker for containerization
