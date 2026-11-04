const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

// Базова функція для всіх запитів до бекенду
async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include', // ВАЖЛИВО: дозволяє браузеру приймати та відправляти httpOnly cookie
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  
  let data; 
  try { 
    data = await response.json(); 
  } catch { 
    data = null; 
  }
  
  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }
  
  return data;
}

// Експортуємо реальні ендпоінти, які буде розробляти Влад
export const api = {
  register: data => request('/auth/register', { method: 'POST', body: data }),
  login: data => request('/auth/login', { method: 'POST', body: data }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  
  links: ({ activeOnly = false } = {}) => request(`/links${activeOnly ? '?active=true' : ''}`),
  createLink: ({ url, days }) => request('/links', { method: 'POST', body: { originalUrl: url, expiresInDays: days } }),
  deleteLink: id => request(`/links/${id}`, { method: 'DELETE' }),
  stats: code => request(`/links/${encodeURIComponent(code)}`),
  
  resolve: async code => { 
    window.location.replace(`${import.meta.env.VITE_SHORT_URL_ORIGIN || 'http://localhost:3000'}/${encodeURIComponent(code)}`); 
  }
};