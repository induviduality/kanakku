# Kanakku API Reference

The Kanakku backend exposes a versioned REST API at `/api/v1/`.

---

## Interactive Docs (OpenAPI UI)

When the API is running, FastAPI serves interactive documentation automatically:

| URL | Description |
|-----|-------------|
| `http://localhost:8765/docs` | Swagger UI — try endpoints in browser |
| `http://localhost:8765/redoc` | ReDoc — clean read-only reference |
| `http://localhost:8765/openapi.json` | Raw OpenAPI 3.x schema |

Via Caddy (full stack):

| URL | Description |
|-----|-------------|
| `http://<your-domain>/api/v1/docs` | Swagger UI |
| `http://<your-domain>/api/v1/redoc` | ReDoc |

---

## Authentication

All endpoints except the ones listed below require a Bearer token:

```
Authorization: Bearer <access_token>
```

Obtain tokens via `POST /api/v1/auth/setup` (first run) or `POST /api/v1/auth/login`.

**Public endpoints (no auth required):**
- `GET /health`
- `POST /api/v1/auth/setup`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/invites/{token}/info`
- `POST /api/v1/auth/accept-invite`

---

## Endpoint Groups

| Prefix | Description |
|--------|-------------|
| `/api/v1/auth` | Setup, login, logout, refresh, invite tokens |
| `/api/v1/settings` | User settings, LLM activity log |
| `/api/v1/accounts` | Bank/cash/credit accounts, payment methods |
| `/api/v1/payees` | Payees (merchants, people) |
| `/api/v1/categories` | Transaction categories |
| `/api/v1/tags` | Tags |
| `/api/v1/transactions` | Transactions (expense / income / transfer) |
| `/api/v1/splits` | Split expenses (upfront, retroactive bundle, settle, forgive) |
| `/api/v1/budgets` | Budgets with recurrence (RRULE), scope-aware edit/delete |
| `/api/v1/subscriptions` | Recurring subscriptions |
| `/api/v1/piggy-banks` | Piggy bank savings goals |
| `/api/v1/dashboard` | Home dashboard aggregates |
| `/api/v1/imports` | PDF statement import (upload, review, confirm, reject) |
| `/api/v1/imports/gpay-takeout` | Google Pay Takeout JSON import |
| `/api/v1/reports` | Custom SQL dashboards (read-only role, widget CRUD) |
| `/api/v1/export` | JSON archive export (trigger, status, download) |
| `/api/v1/import-archive` | JSON archive import |
| `/api/v1/recently-deleted` | Items soft-deleted within the 30-day recovery window |

---

## Pagination

List endpoints that may return many rows use **cursor-based pagination**:

```
GET /api/v1/transactions?limit=50&cursor=<opaque-base64-cursor>
```

The response includes `next_cursor` — pass it as `cursor` in the next request. When `next_cursor` is `null`, you've reached the end.

---

## Soft Deletes & Recovery

Most entities support soft delete (`deleted_at` column). Deleted items are excluded from normal list responses but can be restored within 30 days via `POST /{entity}/{id}/restore`. Items older than 30 days are purged nightly.

Use `GET /api/v1/recently-deleted` to list recoverable items across all entity types.

---

## Reports — Custom SQL Queries

`POST /api/v1/reports/query` accepts arbitrary SQL SELECT statements executed against a read-only Postgres role. Constraints:

- SELECT statements only (DML is rejected by sqlglot parse + `SET TRANSACTION READ ONLY`)
- Every query must reference `user_id = '<your-uuid>'` (enforced server-side)
- Row limit: 10,000 rows per query
- Timeout: 10 seconds

Use `GET /api/v1/reports/schema` to see the curated list of queryable tables with column descriptions and FK metadata.
