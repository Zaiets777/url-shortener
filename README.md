# URL Shortener

**Full-stack URL shortener** built with React, Vite, Node.js, Express and Neon PostgreSQL. Users can register, log in, create and manage short links, and view click counts and expiration dates. Public visitors can follow a short link without logging in.

> **Deployed frontend:** _add Vercel URL here_  
> **Deployed backend:** _add Render / Railway URL here_  
> **API health:** _add `https://YOUR-BACKEND/api/v1/health` here_

## Technologies

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, React Router, Lucide React, CSS |
| Backend | Node.js 20+, Express 4, REST API, CORS |
| Database | PostgreSQL (`pg`) — locally or hosted on Neon |
| Auth | bcryptjs password hashes; JWT in `httpOnly` cookies |
| Hosting | Render or Railway for API; Vercel for frontend; Neon for database |
| Tests | Node.js built-in test runner (`node --test`) |

## Repository layout

```text
backend/        Express API, SQL schema, models, tests
frontend/       React/Vite SPA and Vercel routing configuration
DEPLOYMENT.md   Step-by-step hosting guide
TESTING.md      Redirect and click-counter verification
```

## Local setup

Requirements: **Node.js >=20**, npm, and a PostgreSQL database (Neon or local). The server connects to the database at startup.

1. Clone the repo and install backend dependencies:

```bash
git clone https://github.com/Zaiets777/url-shortener.git
cd url-shortener/backend
npm install
cp .env.example .env
```

2. Edit **`backend/.env`** (do not commit it):

```dotenv
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
DB_SSL=false
DB_POOL_MAX=5
JWT_SECRET=replace_with_a_unique_random_secret_at_least_32_chars
COOKIE_SAME_SITE=lax
SHORT_URL_ORIGIN=http://localhost:3000
```

Generate your own random JWT secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

For Neon, copy the actual **connection string** from the Neon dashboard; do not copy the illustrative placeholder. For local PostgreSQL, use its own connection URL, usually with `DB_SSL=false`. The existing code also supports `DB_SSL=true` for a server requiring TLS with a trusted certificate. Do not place database credentials in frontend environment variables.

3. Create the database schema and start Express:

```bash
npm run db:init
npm run dev
```

The initialization script creates the `users` and `links` tables. Verify `http://localhost:3000/api/v1/health` and `http://localhost:3000/api/v1/health/db`.

4. In **another terminal**, install and run the frontend:

```bash
cd ../frontend  # from backend/
npm install
cp .env.example .env
npm run dev
```

Set `VITE_DEMO_MODE=false`, `VITE_API_BASE_URL=http://localhost:3000/api/v1`, and `VITE_SHORT_URL_ORIGIN=http://localhost:3000` in `frontend/.env`. Open `http://localhost:5173`.

## API routes

API prefix: `/api/v1`. Login sets the `url_shortener_session` cookie; authenticated requests must include cookies (`credentials: 'include'` in the existing frontend).

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/v1/health` | Server health check | Public |
| `GET` | `/api/v1/health/db` | Database connection check | Public |
| `POST` | `/api/v1/auth/register` | Register `{ "username", "password" }` | Public |
| `POST` | `/api/v1/auth/login` | Log in; set httpOnly cookie | Public |
| `GET` | `/api/v1/auth/me` | Get logged-in user | Required |
| `POST` | `/api/v1/auth/logout` | Clear session cookie | Public |
| `POST` | `/api/v1/links` | Create short link `{ "originalUrl", "expiresInDays" }` | Required |
| `GET` | `/api/v1/links` | List owned links, optionally `?active=true` | Required |
| `GET` | `/api/v1/links/:shortCode` | Retrieve link details / click count | Required |
| `PATCH` | `/api/v1/links/:id` | Update destination and/or expiration | Required |
| `DELETE` | `/api/v1/links/:id` | Delete owned link | Required |
| `GET` | `/:shortCode` | Public **302** redirect and atomic click increment | Public |

Example create-link payload:

```json
{ "originalUrl": "https://example.com/", "expiresInDays": 7 }
```

Responses include a generated `shortCode`, `shortUrl`, `clicks`, and `expiresAt`. Expired or missing short codes return HTTP 404.

## Production deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for exact Render/Railway/Vercel settings. Key production variables:

**Backend (Render/Railway):** `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL=https://YOUR-FRONTEND.vercel.app`, `SHORT_URL_ORIGIN=https://YOUR-BACKEND.onrender.com`, `NODE_ENV=production`, `COOKIE_SAME_SITE=none` (and optional `DB_POOL_MAX=5`). Hosting platform normally provides `PORT`.

**Frontend (Vercel):** `VITE_DEMO_MODE=false`, `VITE_API_BASE_URL=https://YOUR-BACKEND.onrender.com/api/v1`, `VITE_SHORT_URL_ORIGIN=https://YOUR-BACKEND.onrender.com`.

Rebuild/redeploy the frontend after changing `VITE_*` variables. Note that cross-site cookies may be restricted by third-party cookie policies in some browsers; for a more resilient production configuration, serve frontend and API under the same site using custom domains or a reviewed proxy setup.

## Tests and quality

```bash
cd backend
npm test
```

See [TESTING.md](TESTING.md) for registration/login, redirect status, click-count and 500-error diagnostics. Confirm test coverage separately; running `npm test` alone does **not** establish the course requirement of >=70% backend coverage.

## Security notes

Never commit real `.env` files, database passwords, JWT secrets, or Neon credentials. `.env.example` is for placeholders only. Short URLs must redirect through the backend origin, **not** the frontend domain, for counts to increment. Free Render services may sleep after inactivity; Neon retains the database independently.
