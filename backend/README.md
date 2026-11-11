# URL Shortener — Backend

This folder implements **Issues #6, #7, #8 (authentication), #9 (short links), #15 (custom aliases), #20 (daily click statistics), #23 (API edge cases) and #24 (API documentation)**.
The repository's existing frontend is unchanged.

## Requirements
- Node.js 20+ and npm
- PostgreSQL 13+ (local or hosted)
- An existing empty PostgreSQL database, for example `url_shortener`

## Quick start

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env` to match your PostgreSQL credentials. **Never commit `.env`**.
For local PostgreSQL, create a database using `createdb url_shortener` (if your PostgreSQL username/permissions allow it), or create it through pgAdmin/Postgres.app.

```bash
npm run db:init  # creates the users and links tables; safe to repeat
npm run dev      # starts the API (default port 3000)
```

Check:
- `GET http://localhost:3000/api/v1/health` => `{ "status":"ok", "service":"url-shortener-api" }`
- `GET http://localhost:3000/api/v1/health/db` => `{ "status":"ok", "database":"connected" }`

The server validates the connection at startup and stops on DB failure. To run automated tests: `npm test`.

## Configuration
| Variable | Description |
|---|---|
| `PORT` | API port, defaults to 3000 (matches frontend defaults) |
| `FRONTEND_URL` | Allowed CORS origin(s), comma separated; defaults to `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string, **required** |
| `DB_SSL` | `true` when hosted DB requires TLS, otherwise `false` |
| `DB_POOL_MAX` | Maximum database connections (default 10) |
| `NODE_ENV` | `development`, `production`, or `test` |

## Models / relationships

`users` (1) -> (many) `links`, foreign key `links.user_id` with `ON DELETE CASCADE`.

**Users**: UUID `id`, `username` (unique, case-insensitive), `password_hash` (bcrypt hash), `created_at`, `updated_at`.

**Links**: UUID `id`, owner `user_id`, unique `short_code` (3–32 chars for custom aliases; generated codes remain 8 chars), `original_url`, `created_at`, `expires_at`, `click_count` (default 0).
A link is active when `expires_at > NOW()`; expired status is derived, not stored.

The models in `src/models/User.js` and `src/models/Link.js` now support authentication and link operations. See Issues #8 and #9 below.

## Security and integration
- CORS allows the frontend origin and credentials (to support httpOnly cookies in a later task).
- Express parses JSON and limits request bodies to 100 KB.
- A central JSON error handler provides 404/400/500 responses without leaking internal errors in production.
- All SQL model queries use positional parameters.
- `frontend/src/services/api.js` already expects `http://localhost:3000/api/v1`.

## Database initialization notes
`npm run db:init` executes `sql/001_initial_schema.sql`. It uses PostgreSQL's `gen_random_uuid()`. Modern supported PostgreSQL versions provide it. The SQL file is source-controlled; do not commit real DB credentials or data.

## Issues #8 and #9 — Authentication and short URLs

Install newly added `bcryptjs` and `jsonwebtoken` packages via `npm install` and set
`JWT_SECRET` in `.env` to a fresh random value (at least 32 characters). Generate one:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Passwords are stored as bcrypt hashes (12 rounds). Successful login sets a signed,
7-day JWT in the `url_shortener_session` **httpOnly** cookie, so frontend requests
must use `credentials: 'include'` (the existing frontend already does). For local
HTTP use `COOKIE_SAME_SITE=lax`; for production cross-site deployment configure
`COOKIE_SAME_SITE=none`, `NODE_ENV=production`, HTTPS and the precise `FRONTEND_URL`.
Never commit `.env` or a real `JWT_SECRET`.

| HTTP | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | `{ "username": "demo123", "password": "SecurePass123" }` |
| POST | `/api/v1/auth/login` | Public | Same body; sends cookie |
| GET | `/api/v1/auth/me` | Cookie | Current user |
| POST | `/api/v1/auth/logout` | Public | Clears cookie |
| GET | `/api/v1/links?active=true` | Cookie | Own active links (`?active=true` optional) |
| POST | `/api/v1/links` | Cookie | `{ "originalUrl": "https://example.com", "expiresInDays": 7, "customAlias": "my-link" } (`customAlias` optional)` |
| GET | `/api/v1/links/:shortCode` | Cookie | Statistics for own link |
| PATCH | `/api/v1/links/:id` | Cookie | Update destination/expiry |
| DELETE | `/api/v1/links/:id` | Cookie | Delete own link |
| GET | `/:shortCode` | Public | HTTP 302 redirect and atomic click increment |

Links return frontend-compatible camelCase fields: `id`, `shortCode`, `shortUrl`,
`originalUrl`, `clicks`, `createdAt`, `expiresAt`, `status`. On invalid/expired
short links, the server returns 404. `Cache-Control: no-store` prevents caching
of redirects, which would otherwise bypass click counting.

### Manual smoke test

After `npm run db:init` and `npm run dev`, open a second terminal:

```bash
# 1. Register
curl -i -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo123","password":"SecurePass123"}'
# 2. Login and store httpOnly cookie
curl -i -c cookies.txt -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo123","password":"SecurePass123"}'
# 3. Create a link
curl -b cookies.txt -X POST http://localhost:3000/api/v1/links \
  -H 'Content-Type: application/json' \
  -d '{"originalUrl":"https://example.com","expiresInDays":7}'
# 4. List links
curl -b cookies.txt http://localhost:3000/api/v1/links
# 5. Open short URL (replace ABC123xy with actual returned code)
curl -I http://localhost:3000/ABC123xy
```

`curl -I` sends HEAD; for testing the click counter, use `curl -i` (GET) instead.
Delete `cookies.txt` after testing; it holds a valid session. The frontend should
set `VITE_SHORT_URL_ORIGIN=http://localhost:3000` when running locally.

**Frontend integration note:** daily visit events are available through the Issue #20 statistics endpoint, but the frontend chart needs to fetch that endpoint explicitly; its older mock series may still be in use.

### Custom aliases (Issue #15)

`POST /api/v1/links` (requires an auth cookie) accepts optional `customAlias`.
Example request:

```json
{ "originalUrl": "https://example.com", "expiresInDays": 7, "customAlias": "my-link" }
```

- With an alias: response `201` contains `link.shortCode: "my-link"` and a matching `link.shortUrl`.
- Without an alias: existing random code generation is used.
- Alias must contain **3–32** ASCII letters, numbers, hyphens or underscores; case-sensitive. Other values return `400`.
- Alias already in use: `409 Conflict` with `{ "message": "This custom alias is already taken" }`. Uniqueness is global across all users; an expired alias is still reserved until removed.
- The public redirect supports the longer custom codes.

**Neon migration:** run `npm run db:init` with your production `DATABASE_URL` once after deployment (or run `backend/sql/002_custom_alias.sql` in the Neon SQL Editor). The migration preserves existing rows and the unique constraint. Never commit `.env` or paste DB credentials into GitHub.


### Daily click history (Issue #20)

Run `backend/sql/003_daily_clicks.sql` once in **Neon → SQL Editor** (database and
branch must match the Render `DATABASE_URL`). The migration adds `link_clicks`
with `link_id` referencing `links(id)` and `clicked_at TIMESTAMPTZ`, plus an index.
It is safe to repeat. Alternatively `npm run db:init` now includes the migration.

**Important:** Existing `links.click_count` totals are preserved. Historical
click dates from before the migration were never stored and cannot be reconstructed.
The graph initially shows only clicks recorded after this migration.

When a visitor follows a valid, unexpired `GET /:shortCode`, Express records
`clicked_at` and increments `click_count` in **one PostgreSQL transaction**;
if either write fails, neither is committed and the redirect fails rather than
returning untracked clicks. Expired/unknown links do not create events.

**Authenticated** route (requires the normal `url_shortener_session` cookie):

`GET /api/v1/links/:id/stats?days=7` (or `days=30`)

- `:id` is the UUID of the link (not its shortCode).
- `days` defaults to `7`; accepts only `7` or `30`; otherwise HTTP **400**.
- Only the link owner can access stats; unknown/other-user link returns **404**.
- Returns an array in UTC calendar days, **oldest first**, including today and
  zero-click days:

```json
[
  { "date": "2026-11-08", "clicks": 5 },
  { "date": "2026-11-09", "clicks": 12 }
]
```

Those two rows are *illustrative*: real responses contain exactly 7 or 30 days,
including dates with zero clicks. `clicks` values are numbers.

Example after logging in with `curl -c cookies.txt`:

```bash
curl -b cookies.txt 'http://localhost:3000/api/v1/links/YOUR_LINK_UUID/stats?days=7'
```

To verify in Neon SQL Editor:

```sql
SELECT (clicked_at AT TIME ZONE 'UTC')::date AS day, count(*) AS clicks
FROM link_clicks
GROUP BY day ORDER BY day DESC;
```

**Frontend note:** the new route is API-only. A client chart must explicitly
request `/api/v1/links/:id/stats` and map the returned array; the existing
frontend has not been modified by Issue #20.

---

## Issues #23 / #24 — Production API reference and edge cases

**Base URL:** `https://url-shortener-liei.onrender.com` (deployment-specific). Versioned API base: `/api/v1`.
Requests and responses use JSON unless stated otherwise. Protected routes require a cookie set by login:
`url_shortener_session` (JWT, `HttpOnly`; `Secure` on production; `SameSite=None` for cross-site Vercel/Render).
Frontend fetch calls must use `credentials: 'include'`; CORS does **not** accept wildcard origins with credentials.

### Authentication endpoints

| Method | Path | Auth | Request body | Success response |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | No | `{"username":"demo123","password":"SecurePass123"}` | **201** `{"user":{"id":"<uuid>","username":"demo123","createdAt":"<ISO timestamp>"},"message":"Account created"}` |
| POST | `/api/v1/auth/login` | No | `{"username":"demo123","password":"SecurePass123"}` | **200** `{"user":{"id":"<uuid>","username":"demo123","createdAt":"<ISO timestamp>"}}` + `Set-Cookie` |
| GET | `/api/v1/auth/me` | Yes | None | **200** `{"user":{"id":"<uuid>","username":"demo123","createdAt":"<ISO timestamp>"}}` |
| POST | `/api/v1/auth/logout` | No | None | **200** `{"message":"Logged out"}` and expired session cookie |

Username: 3–64 ASCII letters, digits, underscore, period or hyphen. Password: 8–64 characters with at least one uppercase letter, lowercase letter and digit. Registration duplicates return **409**; incorrect login returns **401**. Password hashes and JWTs never appear in JSON responses.

### Links endpoints

| Method | Path | Auth | Request body / query | Success response |
|---|---|---|---|---|
| GET | `/api/v1/links` | Yes | Optional `?active=true` | **200** `{"links":[<LinkObject>,...]}` |
| POST | `/api/v1/links` | Yes | `{"originalUrl":"https://example.com","expiresInDays":7,"customAlias":"my-link"}` | **201** `{"link":<LinkObject>}` |
| GET | `/api/v1/links/:shortCode` | Yes | None | **200** `{"link":<LinkObject>}` (only link owner) |
| PATCH | `/api/v1/links/:id` | Yes | `{"originalUrl":"https://example.org","expiresInDays":30}` (at least one field) | **200** `{"link":<LinkObject>}` |
| DELETE | `/api/v1/links/:id` | Yes | None | **200** `{"message":"Link deleted"}` |
| GET | `/api/v1/links/:id/stats` | Yes | `?days=7` (default) or `?days=30`; `:id` may be UUID **or shortCode** | **200** JSON array of `<DailyStat>` |
| GET | `/:shortCode` | No | None | **302** redirect; `Location: <originalUrl>`, `Cache-Control: no-store` |
| HEAD | `/:shortCode` | No | None | **405** `Allow: GET` (no click recorded) |

`customAlias` is optional; otherwise server generates an 8-character random code. Custom aliases support 3–32 ASCII letters, digits, `_`, `-`. Duplicates return **409**. `expiresInDays` defaults to 7 and supports integers 1–365. Destination must be a valid HTTP(S) URL up to 2048 characters without embedded credentials.

`<LinkObject>` example (timestamps are ISO 8601):

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "userId": "22222222-2222-4222-8222-222222222222",
  "shortCode": "my-link",
  "shortUrl": "https://url-shortener-liei.onrender.com/my-link",
  "originalUrl": "https://example.com/",
  "clicks": 4,
  "createdAt": "2026-11-11T10:00:00.000Z",
  "expiresAt": "2026-11-18T10:00:00.000Z",
  "status": "active"
}
```

`<DailyStat>` example (`days=7` returns **7** objects, `days=30` returns **30**; all dates UTC, ascending, including zeros):

```json
[
  { "date": "2026-11-05", "clicks": 0 },
  { "date": "2026-11-06", "clicks": 2 }
]
```

Above are representative entries; actual responses have the full chosen number of days.
Stats access is owner-only: unknown UUIDs, unknown shortCodes or other users' links return **404** `{"message":"Link not found"}`. Unknown/expired public redirects return **404** `{"message":"Short link not found or expired"}`.

### Health and error responses

| Method | Endpoint | Success | Failure |
|---|---|---|---|
| GET | `/api/v1/health` | **200** `{"status":"ok","service":"url-shortener-api"}` | — |
| GET | `/api/v1/health/db` | **200** `{"status":"ok","database":"connected"}` | **503** `{"message":"Database unavailable"}` |
| Any | Unknown route | — | **404** `{"message":"Route METHOD /path not found"}` |

Common errors use `{"message":"..."}`:
- **400** malformed JSON, invalid URL/alias/ID, unsupported `days` or expiry
- **401** missing/invalid/expired session
- **404** unknown link, link belonging to another user, expired redirect
- **409** duplicate username or customAlias
- **500** unexpected backend/database error (generic message; details only in server logs)

### CORS production configuration

Configure Render environment variable with **origins**, not paths or Markdown links, separated by commas:

```env
FRONTEND_URL=https://url-shortener-zaiets.vercel.app,https://url-shortener-six-jade.vercel.app
NODE_ENV=production
COOKIE_SAME_SITE=none
SHORT_URL_ORIGIN=https://url-shortener-liei.onrender.com
```

`FRONTEND_URL` accepts optional trailing `/`, trims whitespace and deduplicates origins. Invalid origins (such as a path, `*` or Markdown brackets) fail at server startup rather than silently misconfiguring CORS. The `cors` middleware answers preflight **OPTIONS** with `204`, `Access-Control-Allow-Origin` matching the allowed browser origin, `Access-Control-Allow-Credentials: true` and `Vary: Origin`. It cannot control network round-trip time or Render cold starts.

Smoke-check preflight:

```bash
curl -i -X OPTIONS 'https://url-shortener-liei.onrender.com/api/v1/auth/login' \
  -H 'Origin: https://url-shortener-zaiets.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

### Redirect counting tests and limitations

- One **successful, non-prefetch GET** calls `Link.resolveAndCount` exactly once; insert into `link_clicks` and increment `links.click_count` happen in **one transaction** with row locking. A failure rolls back both writes.
- `HEAD /:shortCode` returns **405** and does not count. Known speculative requests carrying `Sec-Purpose: prefetch` or `Purpose: prefetch` return **204** and do not count. Normal 302 responses have `Cache-Control: no-store`.
- Expired or missing short codes return **404**, without event insertion.
- **Two distinct real GET requests count as two visits.** Without a client-generated idempotency key, the server cannot reliably distinguish double-clicks from legitimate repeated visits. Do **not** deduplicate by IP alone, because different users may share an IP and one person may intentionally revisit.
- Automated unit/API checks: `cd backend && npm test`. Also run a production smoke test in a browser after deployment; unit tests do not establish real network latency or browser cookie support.

**Production verification:** create a link, inspect `click_count`, call `curl -I <shortUrl>` (should **not** increment), call `curl -i <shortUrl>` exactly once (should increment by 1), then verify in Neon:

```sql
SELECT l.short_code, l.click_count, COUNT(c.id) AS recorded_events
FROM links l LEFT JOIN link_clicks c ON c.link_id = l.id
GROUP BY l.id, l.short_code, l.click_count;
```

For links created before the `link_clicks` migration, `click_count` may be higher than `recorded_events` because historical timestamps were not stored.

**No new SQL migration is required for Issues #23/#24** if `link_clicks` from Issue #20 already exists.
