# Deployment: Neon + Render (or Railway) + Vercel

This guide applies to this repository: `backend/` is an Express service and `frontend/` is a separate Vite SPA. **Do backend first**, then frontend, then update backend CORS.

## 0. Before deploying

- Merge tested changes to the branch that will be deployed (`main` recommended).
- In Neon, create/select a PostgreSQL project and copy the connection string from **Connect**. It commonly ends in `?sslmode=require`. Keep it private.
- To initialize tables from your Mac with `backend/.env` set to Neon: `cd backend && npm install && npm run db:init`. This is a one-time step; Render Free doesn't provide a normal interactive shell and `npm start` does **not** automatically create tables.
- Run `npm test` and check `npm run dev` and `/api/v1/health/db` locally first.

## 1A. Render deployment (recommended for a student demo)

1. Sign in at https://dashboard.render.com/, choose **New → Web Service** and connect your GitHub account/repository `Zaiets777/url-shortener`.
2. Fill in:

| Render field | Value |
|---|---|
| **Branch** | `main` (or your intended merged branch) |
| **Root Directory** | `backend` |
| **Language / Runtime** | `Node` |
| **Build Command** | `npm install` (or `npm ci` once backend has a committed package-lock) |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` if offered |
| **Health Check Path** | `/api/v1/health` |

3. Under **Environment Variables** (sometimes under **Advanced** at creation, or **Service → Environment** afterwards), add one key per line:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon secret connection string (keep private) |
| `JWT_SECRET` | New random string, >=32 characters |
| `FRONTEND_URL` | Start with `http://localhost:5173` if Vercel URL is not known; **replace after frontend deployment** |
| `COOKIE_SAME_SITE` | `none` |
| `SHORT_URL_ORIGIN` | Backend public URL: `https://YOUR-SERVICE.onrender.com` (set after URL assigned) |
| `DB_SSL` | `false` if your Neon URL includes `sslmode=require` (TLS is specified by URL) |
| `DB_POOL_MAX` | `5` |

Do not set `PORT` manually unless necessary; Render provides it. Do not add `JWT_SECRET`/`DATABASE_URL` to Vercel.

4. Click **Create Web Service**. In **Deploys → Logs**, look for `PostgreSQL connection established` followed by `API is listening ...`. If DB connection fails, deployment can exit before listening. Open `https://YOUR-SERVICE.onrender.com/api/v1/health` and `/api/v1/health/db` — both should return JSON with `status: "ok"`.
5. Once you know the public backend URL, set `SHORT_URL_ORIGIN` exactly (HTTPS, no trailing slash). Updating environment variables typically triggers a deploy/restart.

Render's Free Web Service can spin down after 15 minutes of inactivity and take around a minute to wake. This is normal for a classroom demo. Render Free may limit outbound traffic and hours; see the official free tier rules.

## 1B. Railway alternative

Railway's Free plan provides limited monthly credit after a trial, **not unlimited free hosting**. Check current pricing first.

1. Visit https://railway.com/ → **New Project → Deploy from GitHub repo** and select this repository.
2. Open the new service → **Settings**: set **Root Directory** to `/backend`; if autodetection fails, override **Start Command** to `npm start` (and build to `npm install`).
3. Open **Variables** and add `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `COOKIE_SAME_SITE=none`, `SHORT_URL_ORIGIN`, `DB_SSL`, `DB_POOL_MAX` using the same guidance as Render.
4. In **Settings → Networking / Public Networking**, create a public domain. Update `SHORT_URL_ORIGIN` to that HTTPS address.
5. Check **Deployments → Logs** and test `/api/v1/health` and `/api/v1/health/db`.

## 2. Frontend on Vercel

1. Sign in at https://vercel.com/, choose **Add New → Project → Import Git Repository** and pick `Zaiets777/url-shortener`.
2. Set **Root Directory** to `frontend` (important: this is a monorepo). Select **Framework Preset: Vite**. If required, **Build Command** `npm run build`, **Output Directory** `dist`, **Install Command** `npm install`.
3. On the import screen under **Environment Variables** or later **Project → Settings → Environment Variables**, set these for **Production**:

```dotenv
VITE_DEMO_MODE=false
VITE_API_BASE_URL=https://YOUR-BACKEND.onrender.com/api/v1
VITE_SHORT_URL_ORIGIN=https://YOUR-BACKEND.onrender.com
```

Use the actual Railway domain instead if using Railway. Don't end `VITE_API_BASE_URL` with `/`.

4. Deploy and open the assigned `https://YOUR-FRONTEND.vercel.app` domain. Your `frontend/vercel.json` adds the SPA rewrite so refreshes on `/auth/login` and `/dashboard` work.
5. Return to **Render → Service → Environment**, replace `FRONTEND_URL` with the **exact** frontend origin (e.g. `https://YOUR-FRONTEND.vercel.app`, no trailing path), then redeploy/restart backend. Railway: use **Variables**. The existing frontend `fetch()` already sends `credentials: 'include'` and Express enables credentials for the allowed frontend origin.
6. If any Vercel environment value changes, **redeploy frontend**: Vite embeds `VITE_*` values during build. Chrome DevTools → Network can verify requests target the hosted API rather than localhost.

**Cookie note:** Your frontend is on `vercel.app` and backend is on `onrender.com` — cross-site `httpOnly` cookies require `SameSite=None; Secure`. Your backend sets Secure in production when `NODE_ENV=production`. Some browsers block third-party cookies altogether; if login still fails despite correct CORS, examine browser privacy policy or move both services under same-site custom domains / a properly configured API proxy.

## 3. Smoke checks

1. Backend: `/api/v1/health` returns HTTP 200 with `status: ok`.
2. Database: `/api/v1/health/db` returns HTTP 200 and `database: connected`.
3. Frontend: signup → login → dashboard; refresh the page: user should still be logged in (subject to browser's cross-site cookie settings).
4. Create a URL; copy `shortUrl`; visit it in a new tab; check 302 redirect and incremented clicks. See `TESTING.md`.

## 4. Common errors

- **Startup exited/502**: check Render **Logs** or Railway **Deployments → Logs** for `Backend startup failed`, `DATABASE_URL is missing`, `ENOTFOUND`, `ETIMEDOUT`, TLS/auth errors. Check DB string, Neon project state, IP/network policy.
- **503 from `/health/db`**: PostgreSQL unavailable or DB credentials/SSL invalid.
- **401 auth or no cookie**: Inspect login response `Set-Cookie` and browser Network/Storage. Verify `NODE_ENV=production`, `COOKIE_SAME_SITE=none`, exact `FRONTEND_URL`, `credentials: include`, HTTPS, and browser third-party cookie settings.
- **CORS failure**: `FRONTEND_URL` should be the frontend **origin** (scheme+domain, no path), exactly matching the browser request origin; restart backend after updating.
- **404 on Vercel refresh**: `frontend/vercel.json` rewrite missing or incorrect Vercel Root Directory.
- **Redirect 404**: short code is missing, deleted or expired. The short link must start with backend origin, not Vercel frontend origin.
- **500 on redirect**: see application logs near `API error`, verify Neon schema via `npm run db:init`, tables and DB connectivity. Do not log real passwords/JWTs.
