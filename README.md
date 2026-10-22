# App

A web application with a **FastAPI** backend and an **Angular** frontend. It has
username/password sign-in using **OAuth2**, and each user gets a
**permission matrix** (list / create / update / delete) for every module.

The first modules are Home, Users, Change password and Companies.

## Features

- OAuth2 password flow with JWT access tokens.
- Per-user, per-module permissions, exposed as OAuth2 scopes such as
  `companies:create`.
  - Permissions are re-checked against the database on every request, so a
    revoked permission takes effect immediately.
  - Admin users bypass the matrix.
  - Only admins can manage privileges.
- Users module: CRUD with pagination and search, a permission-matrix editor,
  and an admin password reset.
- Change password for any signed-in user.
- Companies module: CRUD with pagination and search.
- Configuration comes entirely from environment variables or a `.env` file,
  so the same build runs locally and in production.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, PyJWT, pwdlib (Argon2) |
| Database | PostgreSQL 17 (Docker for local development) |
| Backend tests | pytest against a dedicated PostgreSQL test database |
| Frontend | Angular 22, Angular Material, Vitest |
| Tooling | uv, ruff, mypy (strict), npm |

## Project structure

```
.
├── docker-compose.yml        # Local PostgreSQL (dev on 5432, tests on 5433)
├── src/
│   ├── contracts/            # Shared API contracts (single source of truth)
│   │   ├── python/contracts/ # Pydantic schemas + permission catalog
│   │   ├── typescript/       # TypeScript mirror used by the frontend
│   │   └── openapi.json      # Generated OpenAPI document
│   ├── backend/
│   │   ├── app/              # FastAPI application (core, models, api, services)
│   │   ├── alembic/          # Database migrations
│   │   └── tests/
│   └── frontend/             # Angular application
└── LICENSE
```

## Getting started

### Prerequisites

- Docker (with Docker Compose)
- [uv](https://docs.astral.sh/uv/) and Python 3.12+
- Node.js 22+ and npm

### 1. Start the databases

```bash
docker compose up -d
```

### 2. Backend

```bash
cd src/backend
cp .env.example .env              # then set SECRET_KEY and FIRST_ADMIN_PASSWORD
uv sync                           # install dependencies
uv run alembic upgrade head       # create the schema
uv run app-cli create-admin       # create the first admin from FIRST_ADMIN_* vars
uv run uvicorn app.main:app --reload
```

The API runs at <http://localhost:8000>. Interactive docs are at
<http://localhost:8000/api/docs>.

### 3. Frontend

```bash
cd src/frontend
npm install
npm start
```

Open <http://localhost:4200> and sign in with the admin credentials. The dev
server proxies `/api` to the backend (see `proxy.conf.json`).

## Configuration

All backend settings are read from environment variables. A `.env` file in
`src/backend` is used when present.

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy URL, e.g. `postgresql+psycopg://user:pass@host:5432/db` | *required* |
| `TEST_DATABASE_URL` | Database used by pytest (it is wiped on every run) | *required for tests* |
| `SECRET_KEY` | Secret used to sign JWTs (at least 16 characters) | *required* |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime | `30` |
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins | *(none)* |
| `APP_ENV` | Free-form environment name | `development` |
| `FIRST_ADMIN_USERNAME` / `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` | Defaults for `app-cli create-admin` | *(none)* |

Generate a secret key with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Permissions model

Each user has one row per module with four flags: `can_list`, `can_create`,
`can_update` and `can_delete`. Each flag maps to a scope `<module>:<action>`.

| Module | Scopes |
|---|---|
| `users` | `users:list`, `users:create`, `users:update`, `users:delete` |
| `companies` | `companies:list`, `companies:create`, `companies:update`, `companies:delete` |

- `is_admin` grants every scope.
- Only admins can grant permissions, change `is_admin`, or modify other admins.
- Nobody can delete, deactivate or demote themselves.

`src/contracts/README.md` has the full rules.

## API overview

All endpoints are under `/api`.

| Method | Path | Scope |
|---|---|---|
| `POST` | `/auth/token` | public (form-encoded `username`, `password`) |
| `GET` | `/me` | authenticated |
| `POST` | `/me/password` | authenticated |
| `GET` / `POST` | `/users` | `users:list` / `users:create` |
| `GET` / `PATCH` / `DELETE` | `/users/{id}` | `users:list` / `users:update` / `users:delete` |
| `GET` / `POST` | `/companies` | `companies:list` / `companies:create` |
| `GET` / `PATCH` / `DELETE` | `/companies/{id}` | `companies:list` / `companies:update` / `companies:delete` |
| `GET` | `/health` | public |

## Running the checks

Backend tests need the `db_test` service from `docker compose up -d`.

```bash
# Backend
cd src/backend
uv run ruff check . && uv run mypy app tests && uv run pytest

# Frontend
cd src/frontend
npm run typecheck && npm run build && npm run test:ci
```

## Deploying to production

1. Provision a PostgreSQL database and set `DATABASE_URL` in the environment.
   Don't ship a `.env` file.
2. Set a strong `SECRET_KEY` and set `CORS_ORIGINS` to the frontend's origin
   (or serve both behind the same domain).
3. Run `uv run alembic upgrade head` on each deploy, then
   `uv run app-cli create-admin` once.
4. Serve the API with `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4`
   (or behind a reverse proxy).
5. Build the frontend with `npm run build` and serve
   `src/frontend/dist/frontend/browser` as static files. Route `/api` to the
   backend.

## License

Released under the [MIT License](LICENSE).
