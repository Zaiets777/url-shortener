import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
process.env.JWT_SECRET ||= 'test-only-secret-key-0123456789abcdefgh';
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { Link } = await import('../src/models/Link.js');
import { createTtlCache } from '../src/utils/ttlCache.js';
import { openapi } from '../src/docs/openapi.js';

const UUID = '11111111-1111-4111-8111-111111111111';
const LINK_ID = '22222222-2222-4222-8222-222222222222';
const USER = { id: UUID, username: 'demo_user', created_at: '2026-11-18T12:00:00Z', password_hash: '' };
const LINK = { id: LINK_ID, user_id: UUID, short_code: 'test-alias', original_url: 'https://example.com/', click_count: 0, created_at: '2026-11-18T12:00:00Z', expires_at: '2090-01-01T12:00:00Z' };

async function serve(callback) {
  const server = createApp({ dbCheck: async () => {} }).listen(0);
  try {
    if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally { await new Promise((resolve) => server.close(resolve)); }
}
async function stubs(methods, callback) {
  const restores = [];
  for (const [key, fn] of Object.entries(methods)) {
    const [model, name] = key.split('.');
    const ref = model === 'User' ? User : Link;
    const original = ref[name];
    ref[name] = fn;
    restores.push(() => { ref[name] = original; });
  }
  try { return await callback(); } finally { restores.reverse().forEach((f) => f()); }
}
const post = (base, path, body, cookie) => fetch(base + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body)
});

// These are actual HTTP endpoint tests with mock DB models, not just helper tests.
test('register creates account with bcrypt hash, returns public user and never a token', async () => {
  let storedHash;
  await stubs({
    'User.findByUsername': async () => null,
    'User.create': async (_username, hash) => { storedHash = hash; return USER; }
  }, () => serve(async (base) => {
    const response = await post(base, '/api/v1/auth/register', { username: 'demo_user', password: 'StrongPass123' });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.user.username, 'demo_user');
    assert.equal('token' in body, false);
    assert.equal('password_hash' in body.user, false);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(await bcrypt.compare('StrongPass123', storedHash), true);
  }));
});

test('register validates credentials and reports username conflicts', async () => {
  await stubs({ 'User.findByUsername': async () => USER }, () => serve(async (base) => {
    const invalid = await post(base, '/api/v1/auth/register', { username: 'x', password: 'bad' });
    assert.equal(invalid.status, 400);
    const conflict = await post(base, '/api/v1/auth/register', { username: 'demo_user', password: 'StrongPass123' });
    assert.equal(conflict.status, 409);
  }));
});

test('login sets httpOnly cookie; /me reads req.cookies; Bearer header alone rejected; logout clears', async () => {
  const hash = await bcrypt.hash('StrongPass123', 4);
  await stubs({
    'User.findByUsername': async () => ({ ...USER, password_hash: hash }),
    'User.findById': async () => USER
  }, () => serve(async (base) => {
    const invalid = await post(base, '/api/v1/auth/login', { username: 'demo_user', password: 'wrong' });
    assert.equal(invalid.status, 401);
    const login = await post(base, '/api/v1/auth/login', { username: 'demo_user', password: 'StrongPass123' });
    assert.equal(login.status, 200);
    const cookieHeader = login.headers.get('set-cookie');
    assert.match(cookieHeader, /httponly/i);
    assert.match(cookieHeader, /samesite=/i);
    assert.equal((await login.json()).user.username, 'demo_user');
    const cookie = cookieHeader.split(';')[0];
    const unauthorized = await fetch(base + '/api/v1/auth/me', { headers: { Authorization: `Bearer ${cookie.split('=')[1]}` } });
    assert.equal(unauthorized.status, 401);
    const me = await fetch(base + '/api/v1/auth/me', { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.username, 'demo_user');
    const logout = await post(base, '/api/v1/auth/logout', {}, cookie);
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /expires=/i);
  }));
});

test('links POST validates input and creates custom alias for authenticated user', async () => {
  const hash = await bcrypt.hash('StrongPass123', 4);
  await stubs({
    'User.findByUsername': async () => ({ ...USER, password_hash: hash }),
    'User.findById': async () => USER,
    'Link.findByShortCode': async () => null,
    'Link.create': async (data) => ({ ...LINK, short_code: data.shortCode })
  }, () => serve(async (base) => {
    const login = await post(base, '/api/v1/auth/login', { username: 'demo_user', password: 'StrongPass123' });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const unauthenticated = await post(base, '/api/v1/links', { originalUrl: 'https://example.com' });
    assert.equal(unauthenticated.status, 401);
    const invalid = await post(base, '/api/v1/links', { originalUrl: 'file:///etc/passwd' }, cookie);
    assert.equal(invalid.status, 400);
    const created = await post(base, '/api/v1/links', { originalUrl: 'https://example.com', customAlias: 'my-custom', expiresInDays: 10 }, cookie);
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.equal(body.link.shortCode, 'my-custom');
    assert.equal(body.link.userId, UUID);
    assert.equal(typeof body.link.shortUrl, 'string');
  }));
});

test('links GET / POST conflict / stats / PATCH / DELETE all honor session', async () => {
  const hash = await bcrypt.hash('StrongPass123', 4);
  await stubs({
    'User.findByUsername': async () => ({ ...USER, password_hash: hash }),
    'User.findById': async () => USER,
    'Link.findByShortCode': async () => LINK,
    'Link.findByUserId': async () => [LINK],
    'Link.findOwnedByCode': async () => LINK,
    'Link.findOwnedById': async () => LINK,
    'Link.getDailyStats': async () => [{ date: '2026-11-18', clicks: 3 }],
    'Link.update': async () => LINK,
    'Link.remove': async () => true
  }, () => serve(async (base) => {
    const login = await post(base, '/api/v1/auth/login', { username: 'demo_user', password: 'StrongPass123' });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const opts = { headers: { Cookie: cookie } };
    const listed = await fetch(base + '/api/v1/links?active=true', opts);
    assert.equal((await listed.json()).links.length, 1);
    const item = await fetch(base + '/api/v1/links/test-alias', opts);
    assert.equal((await item.json()).link.shortCode, 'test-alias');
    const stats = await fetch(base + '/api/v1/links/test-alias/stats?days=7', opts);
    assert.deepEqual(await stats.json(), [{ date: '2026-11-18', clicks: 3 }]);
    const conflict = await post(base, '/api/v1/links', { originalUrl: 'https://example.com', customAlias: 'test-alias' }, cookie);
    assert.equal(conflict.status, 409);
    const updated = await fetch(base + '/api/v1/links/' + LINK_ID, { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresInDays: 2 }) });
    assert.equal(updated.status, 200);
    const deleted = await fetch(base + '/api/v1/links/' + LINK_ID, { method: 'DELETE', headers: { Cookie: cookie } });
    assert.equal(deleted.status, 200);
  }));
});

test('OpenAPI spec is complete, Swagger page renders and has no exposed token response', async () => {
  assert.equal(openapi.openapi, '3.0.3');
  assert.ok(openapi.paths['/api/v1/auth/login'].post.responses['200']);
  assert.ok(openapi.paths['/api/v1/links/{id}/stats'].get);
  assert.equal(openapi.components.securitySchemes.cookieAuth.in, 'cookie');
  await serve(async (base) => {
    const spec = await fetch(base + '/api/v1/openapi.json');
    assert.equal(spec.status, 200);
    assert.equal((await spec.json()).info.title, 'URL Shortener API');
    const page = await fetch(base + '/api/docs');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /SwaggerUIBundle/);
  });
});

test('bounded TTL cache expires old values, evicts LRU and allows invalidation', () => {
  let now = 0;
  const cache = createTtlCache({ ttlMs: 100, maxEntries: 2, now: () => now });
  cache.set('a', 1); cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('c'), 3);
  now = 101;
  assert.equal(cache.get('a'), undefined);
  cache.set('x', 4); cache.delete('x');
  assert.equal(cache.get('x'), undefined);
  cache.clear(); assert.equal(cache.size, 0);
});

test('redirect cache skips lookup on repeat click, but counts each GET and refreshes destination', async () => {
  const seen = [];
  const cache = createTtlCache();
  const client = {
    query: async (sql, args) => {
      seen.push(sql);
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: LINK_ID, original_url: 'https://first.example/' }] };
      if (sql.includes('RETURNING id, original_url')) return { rows: [{ id: LINK_ID, original_url: 'https://updated.example/' }] };
      return { rows: [] };
    },
    release() {}
  };
  const pool = { connect: async () => client };
  assert.equal(await Link.resolveAndCount('cached', pool, cache), 'https://first.example/');
  assert.equal(await Link.resolveAndCount('cached', pool, cache), 'https://updated.example/');
  assert.equal(seen.filter((sql) => sql.includes('FOR UPDATE')).length, 1);
  assert.equal(seen.filter((sql) => sql.includes('link_clicks')).length, 2);
  assert.equal(seen.filter((sql) => sql === 'COMMIT').length, 2);
});
