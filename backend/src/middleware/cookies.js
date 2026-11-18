// Parse Cookie header once so authorization uses req.cookies exclusively.
// Use the first occurrence of a cookie name; ignore malformed percent encoding.
export function parseCookies(req, _res, next) {
  const cookies = Object.create(null);
  for (const pair of (req.headers.cookie || '').split(';')) {
    const index = pair.indexOf('=');
    if (index < 1) continue;
    const key = pair.slice(0, index).trim();
    if (!key || Object.hasOwn(cookies, key)) continue;
    let value = pair.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try { cookies[key] = decodeURIComponent(value); } catch { /* ignore invalid cookie */ }
  }
  req.cookies = cookies;
  next();
}
