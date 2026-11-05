# URL Shortener — Backend

This folder implements **Issues #7 (Express setup)** and **#6 (PostgreSQL models)**.
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

**Users**: UUID `id`, `username` (unique, case-insensitive), `password_hash` (for bcrypt in a later auth task), `created_at`, `updated_at`.

**Links**: UUID `id`, owner `user_id`, unique `short_code` (6–8 chars), `original_url`, `created_at`, `expires_at`, `click_count` (default 0).
A link is active when `expires_at > NOW()`; expired status is derived, not stored.

The models in `src/models/User.js` and `src/models/Link.js` contain read methods ready for future authentication/link endpoints. API routes beyond health checks are **not** part of these two issues.

## Security and integration
- CORS allows the frontend origin and credentials (to support httpOnly cookies in a later task).
- Express parses JSON and limits request bodies to 100 KB.
- A central JSON error handler provides 404/400/500 responses without leaking internal errors in production.
- All SQL model queries use positional parameters.
- `frontend/src/services/api.js` already expects `http://localhost:3000/api/v1`.

## Database initialization notes
`npm run db:init` executes `sql/001_initial_schema.sql`. It uses PostgreSQL's `gen_random_uuid()`. Modern supported PostgreSQL versions provide it. The SQL file is source-controlled; do not commit real DB credentials or data.
