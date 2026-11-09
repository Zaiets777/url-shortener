# URL Shortener — Backend

This folder implements **Issues #6, #7, #8 (authentication), #9 (short links) and #15 (custom aliases)**.
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

**Scope note:** the Stats UI supports an optional `visits` series, but the current
schema stores only the total counter. Per-day visit charts require a separate
`link_visits` table and a later feature. The current UI shows the total counter.

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
