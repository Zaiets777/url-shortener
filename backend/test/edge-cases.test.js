import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.JWT_SECRET ||= 'test-only-secret-key-0123456789abcdefgh';
const { createApp } = await import('../src/app.js');
const { allowedCorsOrigins } = await import('../src/config/cors.js');
const { Link } = await import('../src/models/Link.js');
const { User } = await import('../src/models/User.js');
const { setSession } = await import('../src/middleware/auth.js');

const ID = '11111111-1111-4111-8111-111111111111';
const USER = { id: ID, username: 'testuser', created_at: new Date().toISOString() };

async function serve(callback) {
  const server = createApp({ dbCheck: async () => {} }).listen(0);
  try {
    if (!server.listening) await new Promise((r) => server.once('listening', r));
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally { await new Promise((r) => server.close(r)); }
}

function withStubs(stubs, fn) {
  const originals = Object.entries(stubs).map(([key, value]) => {
    const [model, method] = key.split('.');
    const target = model === 'Link' ? Link : User;
    const previous = target[method];
    target[method] = value;
    return () => { target[method] = previous; };
  });
  return Promise.resolve().then(fn).finally(() => originals.reverse().forEach((restore) => restore()));
}

function sessionCookie() {
  const headers = { get: () => '', set: () => {} };
  const cookies = [];
  const res = { cookie: (name, value) => cookies.push(`${name}=${value}`), headers };
  setSession(res, ID);
  return cookies[0];
}

test('CORS accepts explicit Vercel origins and rejects malformed entries', () => {
  assert.deepEqual(allowedCorsOrigins('https://a.vercel.app/, https://b.vercel.app,https://a.vercel.app'),
    ['https://a.vercel.app', 'https://b.vercel.app']);
  assert.throws(() => allowedCorsOrigins('https://a.vercel.app/path'), /origins only/);
  assert.throws(() => allowedCorsOrigins('*'), /Invalid|origins only/);
  assert.throws(() => allowedCorsOrigins('https://a.vercel.app,http://localhost:5173/bad'), /origins only/);
});

test('CORS preflight replies with credentials and permitted method', async () => {
  await serve(async (base) => {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'OPTIONS', headers: { Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
    assert.match(res.headers.get('access-control-allow-methods'), /POST/);
    assert.match(res.headers.get('vary'), /Origin/);
  });
});

test('HEAD and prefetch never increment a short link', async () => {
  let counted = 0;
  await withStubs({ 'Link.resolveAndCount': async () => { counted++; return 'https://example.com'; } }, () => serve(async (base) => {
    const head = await fetch(`${base}/mycode`, { method: 'HEAD' });
    assert.equal(head.status, 405);
    assert.equal(head.headers.get('allow'), 'GET');
    const prefetch = await fetch(`${base}/mycode`, { headers: { 'Sec-Purpose': 'prefetch' } });
    assert.equal(prefetch.status, 204);
    assert.equal(counted, 0);
    const normal = await fetch(`${base}/mycode`, { redirect: 'manual' });
    assert.equal(normal.status, 302);
    assert.equal(normal.headers.get('location'), 'https://example.com');
    assert.equal(normal.headers.get('cache-control'), 'no-store');
    assert.equal(counted, 1);
  }));
});

test('missing /stats shortCode returns 404 and never reads statistics', async () => {
  let statsCalls = 0;
  await withStubs({
    'User.findById': async () => USER,
    'Link.findOwnedByCode': async () => null,
    'Link.getDailyStats': async () => { statsCalls++; return []; }
  }, () => serve(async (base) => {
    const res = await fetch(`${base}/api/v1/links/notFoundCode/stats?days=7`, { headers: { Cookie: sessionCookie() } });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).message, 'Link not found');
    assert.equal(statsCalls, 0);
  }));
});

test('shortCode statistics are associated with authenticated owner UUID', async () => {
  let query;
  await withStubs({
    'User.findById': async () => USER,
    'Link.findOwnedByCode': async () => ({ id: '22222222-2222-4222-8222-222222222222' }),
    'Link.getDailyStats': async (...args) => { query = args; return [{ date: '2026-11-11', clicks: 1 }]; }
  }, () => serve(async (base) => {
    const res = await fetch(`${base}/api/v1/links/myAlias/stats?days=30`, { headers: { Cookie: sessionCookie() } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), [{ date: '2026-11-11', clicks: 1 }]);
    assert.deepEqual(query, [ID, '22222222-2222-4222-8222-222222222222', 30]);
  }));
});
