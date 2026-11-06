# End-to-end testing — short URLs and click counter

Substitute the actual HTTPS backend URL below. Do not paste credentials into shared screenshots.

## Checklist using Postman or browser

1. **Health:** GET `https://YOUR-BACKEND/api/v1/health` → HTTP 200 and `status: ok`.
2. **Database:** GET `https://YOUR-BACKEND/api/v1/health/db` → HTTP 200 and `database: connected`.
3. **Register:** POST `/api/v1/auth/register` with JSON `{"username":"qa_test_001","password":"SecurePass123"}` → **201**, new user object. Use a new username for repeated tests.
4. **Login:** POST `/api/v1/auth/login` with the same JSON → **200**, `Set-Cookie: url_shortener_session=...; HttpOnly; Secure; SameSite=None` in production. Postman stores cookies in its cookie jar. Do not copy the session token into your report.
5. **Create:** POST `/api/v1/links`, Cookie from login and JSON `{"originalUrl":"https://example.com/","expiresInDays":7}` → **201** with `link.shortCode`, `link.shortUrl`, `link.clicks=0`.
6. **Initial stats:** GET `/api/v1/links/<shortCode>` (authenticated) → `link.clicks` should be **0**.
7. **Redirect:** GET `https://YOUR-BACKEND/<shortCode>` (public) with **automatic redirects turned OFF** in Postman or via `curl -I` is **not enough** because the Express route is GET-only. Use `curl -s -o /dev/null -D - 'https://YOUR-BACKEND/<shortCode>'` with GET. Expected: **302 Found** and `Location: https://example.com/`.
8. **Count:** Repeat GET stats authenticated → `link.clicks=1`. Repeat public GET twice → `clicks=3`. The SQL `UPDATE ... SET click_count = click_count + 1` increments atomically.
9. **Neon database:** In Neon SQL Editor run `SELECT short_code, original_url, click_count, expires_at FROM links ORDER BY created_at DESC LIMIT 10;` and confirm count equals API value.
10. **Edge cases:** Unknown code returns **404**, expired code returns **404** and does **not** increment, deleted link returns **404**, unauthorized GET `/api/v1/links` returns **401**, malformed URL POST returns **400**.

## Redirect status: 302, not 301

The current Express code uses `res.redirect(302, destination)` and `Cache-Control: no-store` so that a browser or intermediary does not cache the redirect and bypass the click counter. A 301 permanent redirect is therefore **not expected** in this codebase.

## If a redirect yields HTTP 500

1. Open **Render Dashboard → your Web Service → Logs** (or Railway → service → Deployments → Logs) and look for the request time and `API error` / PostgreSQL messages.
2. Check `/api/v1/health/db`. If it fails, validate `DATABASE_URL` and Neon connection; do not share the full URL.
3. Check Neon **SQL Editor** for `users` and `links`: if missing, run `cd backend && npm run db:init` locally with the Neon URL in your private `.env`.
4. Verify `SHORT_URL_ORIGIN` matches the real backend public domain; ensure your link goes directly to Express (`https://BACKEND/<shortCode>`).
5. Test a known unexpired code. Expired/missing should return **404**, not 500.
6. In Postman disable **Automatically follow redirects** to see the actual 302 and Location header. In Chrome DevTools → Network enable Preserve log to trace navigation.

## Quick shell check

```bash
curl -i https://YOUR-BACKEND/api/v1/health
curl -i https://YOUR-BACKEND/api/v1/health/db
curl -s -o /dev/null -D - https://YOUR-BACKEND/YOURCODE
```

On a free Render instance, the first request after inactivity may be slow due to spin-up.
