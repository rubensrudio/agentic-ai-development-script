# API Contracts

Single source of truth shared by the backend and the frontend.

| File | Purpose |
|---|---|
| `python/contracts/permissions.py` | Modules, actions and OAuth2 scopes |
| `python/contracts/schemas.py` | Pydantic request/response schemas (used by the backend) |
| `typescript/api.models.ts` | TypeScript mirror (imported by the frontend as `@contracts/api.models`) |
| `openapi.json` | OpenAPI document generated from the backend (`/api/openapi.json`) |

Changes go through the orchestrator (`.change-request.md`). After changing the
Python schemas, update the TypeScript mirror and regenerate `openapi.json`.

## Authentication

- OAuth2 password flow: `POST /api/auth/token`, form-encoded `username` and
  `password`, returning a `Token`. Send `Authorization: Bearer <access_token>`.
- Unknown user, wrong password and inactive user all return **401**
  `Incorrect username or password`, so the response doesn't reveal which accounts exist.
- The JWT `sub` is the user id. `scopes` lists the effective scopes for information only.
- Permissions are re-checked against the database on every request.

## Permissions

- Scopes are `<module>:<action>`. Modules: `users`, `companies`. Actions:
  `list`, `create`, `update`, `delete`. `list` also covers `GET /{id}`.
- `is_admin = true` grants every scope.
- Missing token or invalid/expired token or inactive user → **401**. Missing scope → **403**.
- Privilege-escalation guards, enforced in `PATCH`/`POST`/`DELETE /api/users`:
  - Only admins may manage privileges (403 `Only admins can manage permissions`):
    on `POST`, a non-admin sending `is_admin=true` or any `true` permission flag;
    on `PATCH`, a non-admin sending the `is_admin` or `permissions` field at all.
  - `permissions` listing the same module twice → 422 `Duplicate module in permissions`.
  - Non-admins cannot update or delete admin users (403 `Only admins can manage admin users`).
  - Nobody can delete themselves (400 `You cannot delete yourself`).
  - Nobody can set `is_active=false` or `is_admin=false` on themselves (400 `You cannot deactivate or demote yourself`).

## Conventions

- Lists: `page` (>= 1, default 1), `size` (1..100, default 20), optional `q`
  case-insensitive substring search. Response is `Page<T>` with `total`.
- Users are ordered by `id`; `q` matches `username`, `email` and `full_name`.
- Companies are ordered by `name`, then `id`; `q` matches `name`, `legal_name` and `tax_id`.
- Unknown id → **404** `User not found` / `Company not found`.
- Duplicates → **409** `Username already registered`, `Email already registered`,
  `Tax ID already registered`.
- Validation errors → **422** (FastAPI default body).
- `DELETE` returns **204** (hard delete). Deleting a user leaves companies
  with `created_by_id = null`.
- `UserRead.permissions` always has one entry per module, in module order.
