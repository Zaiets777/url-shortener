import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

async function withServer(app, callback) {
  const server = app.listen(0);
  try {
    await new Promise((resolve, reject) => {
      if (server.listening) resolve();
      else { server.once('listening', resolve); server.once('error', reject); }
    });
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('server health, 404 and CORS headers', async () => {
  await withServer(createApp({ dbCheck: async () => {} }), async (base) => {
    const healthy = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(healthy.status, 200);
    assert.equal((await healthy.json()).status, 'ok');
    assert.equal(healthy.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(healthy.headers.get('access-control-allow-credentials'), 'true');

    const missing = await fetch(`${base}/unknown`);
    assert.equal(missing.status, 404);
    assert.match((await missing.json()).message, /not found/);
  });
});

test('DB health reports success and failure without exposing credentials', async () => {
  await withServer(createApp({ dbCheck: async () => {} }), async (base) => {
    const response = await fetch(`${base}/api/v1/health/db`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).database, 'connected');
  });
  await withServer(createApp({ dbCheck: async () => { throw new Error('secret credentials'); } }), async (base) => {
    const response = await fetch(`${base}/api/v1/health/db`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).message, 'Database unavailable');
  });
});

test('malformed JSON returns 400 with centralized error handler', async () => {
  await withServer(createApp({ dbCheck: async () => {} }), async (base) => {
    const response = await fetch(`${base}/api/v1/health`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken'
    });
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).message, 'string');
  });
});
