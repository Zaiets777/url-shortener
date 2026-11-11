// Only absolute, explicit HTTP(S) origins are allowed for credentialed CORS.
// Normalize an optional trailing slash; reject paths, credentials and wildcards.
export function allowedCorsOrigins(value) {
  const origins = String(value).split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length) throw new Error('FRONTEND_URL must contain at least one origin');
  return [...new Set(origins.map((origin) => {
    let url;
    try { url = new URL(origin); } catch { throw new Error(`Invalid FRONTEND_URL origin: ${origin}`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash || origin.includes('*')) {
      throw new Error(`FRONTEND_URL must contain origins only (no paths or wildcards): ${origin}`);
    }
    return url.origin;
  }))];
}
