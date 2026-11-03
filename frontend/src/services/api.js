import { demoEnabled, isExpired, isValidUrl } from '../utils/links';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const USER_KEY = 'shortly_demo_users';
const SESSION_KEY = 'shortly_demo_session';
const LINKS_KEY = 'shortly_demo_links';
const wait = () => new Promise(resolve => setTimeout(resolve, 240));
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const current = () => read(SESSION_KEY, null);
const authorized = () => { const user = current(); if (!user) throw new Error('Please sign in to continue.'); return user; };
const hashDemoPassword = async (password) => { const bytes = new TextEncoder().encode(password); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2,'0')).join(''); };
const demo = {
  async register({ username, password }) { await wait(); const users = read(USER_KEY, []); if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) throw new Error('This username is already taken.'); users.push({ id: crypto.randomUUID(), username: username.trim(), passwordHash: await hashDemoPassword(password) }); write(USER_KEY, users); return { ok:true }; },
  async login({ username, password }) { await wait(); const h = await hashDemoPassword(password); const found = read(USER_KEY, []).find(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.passwordHash === h); if (!found) throw new Error('Incorrect username or password.'); const user = { id:found.id, username:found.username }; write(SESSION_KEY,user); return user; },
  async me() { await wait(); return current(); },
  async logout() { await wait(); localStorage.removeItem(SESSION_KEY); },
  async links({ activeOnly = false } = {}) { await wait(); const user=authorized(); const links=read(LINKS_KEY,[]).filter(x => x.userId === user.id); return links.filter(x => !activeOnly || !isExpired(x)).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); },
  async createLink({ url, days }) { await wait(); const user=authorized(); if (!isValidUrl(url)) throw new Error('Enter a valid HTTP or HTTPS URL.'); const all=read(LINKS_KEY,[]); let code; do { code=Math.random().toString(36).slice(2,9); } while(all.some(x=>x.shortCode===code)); const now=new Date(); const expires=new Date(now.getTime()+days*86400000); const link={id:crypto.randomUUID(),userId:user.id,originalUrl:url,shortCode:code,shortUrl:`${window.location.origin}/r/${code}`,createdAt:now.toISOString(),expiresAt:expires.toISOString(),clicks:0,visits:[]}; write(LINKS_KEY,[link,...all]); return link; },
  async deleteLink(id) { await wait(); const user=authorized(); const all=read(LINKS_KEY,[]); if (!all.some(x=>x.id===id && x.userId===user.id)) throw new Error('Link not found.'); write(LINKS_KEY,all.filter(x=>!(x.id===id && x.userId===user.id))); },
  async stats(code) { await wait(); const user=authorized(); const link=read(LINKS_KEY,[]).find(x=>x.shortCode===code && x.userId===user.id); if (!link) throw new Error('Link not found.'); return link; },
  async resolve(code) { await wait(); const all=read(LINKS_KEY,[]); const link=all.find(x=>x.shortCode===code); if (!link) throw new Error('This link does not exist.'); if (isExpired(link)) throw new Error('This link has expired.'); link.clicks+=1; link.visits=[...(link.visits||[]),new Date().toISOString()]; write(LINKS_KEY,all); return link.originalUrl; }
};
// Adapt these route mappings to the team's agreed backend API; the specification
// names the features but does not prescribe every endpoint or response shape.
async function request(path, { method='GET', body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, { method, credentials:'include', headers:body?{'Content-Type':'application/json'}:{}, body:body?JSON.stringify(body):undefined });
  let data; try { data=await response.json(); } catch { data=null; }
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`);
  return data;
}
const real = {
  register: data => request('/auth/register',{method:'POST',body:data}),
  login: data => request('/auth/login',{method:'POST',body:data}),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout',{method:'POST'}),
  links: ({activeOnly=false}={}) => request(`/links${activeOnly?'?active=true':''}`),
  createLink: ({url,days}) => request('/links',{method:'POST',body:{originalUrl:url,expiresInDays:days}}),
  deleteLink: id => request(`/links/${id}`,{method:'DELETE'}),
  stats: code => request(`/links/${encodeURIComponent(code)}`),
  resolve: async code => { window.location.replace(`${import.meta.env.VITE_SHORT_URL_ORIGIN || 'http://localhost:3000'}/${encodeURIComponent(code)}`); }
};
export const api = demoEnabled ? demo : real;
