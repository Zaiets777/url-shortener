export const dateLabel = (value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const isExpired = (link) => new Date(link.expiresAt).getTime() <= Date.now();
export const isValidUrl = (value) => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && Boolean(u.hostname.includes('.') || u.hostname === 'localhost'); } catch { return false; } };
export const shortUrl = (link) => link.shortUrl || `${window.location.origin}/r/${link.shortCode}`;
export const demoEnabled = import.meta.env.VITE_DEMO_MODE !== 'false';
export const safeNavigate = (url) => { try { const u = new URL(url); if (['http:', 'https:'].includes(u.protocol)) window.location.assign(u.href); } catch { /* ignore */ } };
