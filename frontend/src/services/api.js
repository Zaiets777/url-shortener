// Vite replaces VITE_* values at build time. Accept a URL accidentally pasted as
// Markdown ([https://example](https://example)) but never let a relative URL
// silently send API requests to the Vercel frontend domain.
function normalizeOrigin(raw, label) {
  let value = String(raw || '').trim();
  const markdown = value.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
  if (markdown) value = markdown[2];
  value = value.replace(/^['"]|['"]$/g, '').trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a plain absolute http(s) URL, not: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must be an http(s) URL without credentials, query or hash`);
  }
  return url.href.replace(/\/$/, '');
}

const API_BASE = normalizeOrigin(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
  'VITE_API_BASE_URL'
);
const SHORT_URL_ORIGIN = normalizeOrigin(
  import.meta.env.VITE_SHORT_URL_ORIGIN || 'http://localhost:3000',
  'VITE_SHORT_URL_ORIGIN'
);

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include', // Дозволяє браузеру приймати та відправляти httpOnly cookie
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });

  let data;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }
  return data;
}

export const api = {
  register: data => request('/auth/register', { method: 'POST', body: data }),
  login: data => request('/auth/login', { method: 'POST', body: data }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  links: ({ activeOnly = false } = {}) => request(`/links${activeOnly ? '?active=true' : ''}`),
  createLink: ({ url, days }) => request('/links', {
    method: 'POST', body: { originalUrl: url, expiresInDays: days }
  }),
  deleteLink: id => request(`/links/${id}`, { method: 'DELETE' }),
  stats: code => request(`/links/${encodeURIComponent(code)}`),
  resolve: async code => {
    window.location.replace(`${SHORT_URL_ORIGIN}/${encodeURIComponent(code)}`);
  }
};