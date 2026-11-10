import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Link } from '../src/models/Link.js';
import { parseStatsDays } from '../src/routes/links.js';

const UUID = '11111111-1111-4111-8111-111111111111';

test('days accepts only 7 and 30; defaults to 7', () => {
  assert.equal(parseStatsDays(undefined), 7);
  assert.equal(parseStatsDays('7'), 7);
  assert.equal(parseStatsDays('30'), 30);
  for (const value of ['0', '31', 'abc', 7, ['7']]) {
    assert.throws(() => parseStatsDays(value), { statusCode: 400 });
  }
});

test('daily stats fetches fixed-size UTC series for the given user/link', async () => {
  const calls = [];
  const pool = { query: async (sql, args) => {
    calls.push({ sql, args });
    return { rows: [ { date: '2026-11-09', clicks: 0 }, { date: '2026-11-10', clicks: 3 } ] };
  } };
  const rows = await Link.getDailyStats('user-id', UUID, 30, pool);
  assert.deepEqual(rows, [ { date: '2026-11-09', clicks: 0 }, { date: '2026-11-10', clicks: 3 } ]);
  assert.deepEqual(calls[0].args, [UUID, 'user-id', 30]);
  assert.match(calls[0].sql, /link_clicks/);
  assert.match(calls[0].sql, /AT TIME ZONE 'UTC'/);
  assert.match(calls[0].sql, /user_id = \$2/);
});

test('redirect inserts timestamp and increments total in one transaction', async () => {
  const seen = [];
  const client = {
    query: async (sql, args) => {
      seen.push({ sql, args });
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: UUID, original_url: 'https://example.com/' }] };
      return { rows: [] };
    },
    release: () => seen.push({ sql: 'RELEASE' })
  };
  const destination = await Link.resolveAndCount('abc123', { connect: async () => client });
  assert.equal(destination, 'https://example.com/');
  assert.deepEqual(seen.map((call) => call.sql.match(/^\w+/)?.[0]),
    ['BEGIN', 'SELECT', 'INSERT', 'UPDATE', 'COMMIT', 'RELEASE']);
  assert.match(seen[2].sql, /link_clicks/);
  assert.deepEqual(seen[2].args, [UUID]);
  assert.deepEqual(seen[3].args, [UUID]);
});

test('expired or missing short links do not create click records', async () => {
  const seen = [];
  const client = {
    query: async (sql) => { seen.push(sql); return { rows: [] }; },
    release: () => seen.push('RELEASE')
  };
  assert.equal(await Link.resolveAndCount('missing', { connect: async () => client }), null);
  assert.deepEqual(seen, ['BEGIN', seen[1], 'ROLLBACK', 'RELEASE']);
  assert.match(seen[1], /expires_at > NOW\(\)/);
});

test('failed click insert rolls back and never increments the total', async () => {
  const seen = [];
  const client = {
    query: async (sql) => {
      seen.push(sql);
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: UUID, original_url: 'https://example.com' }] };
      if (sql.startsWith('INSERT')) throw new Error('DB write failed');
      return { rows: [] };
    },
    release: () => seen.push('RELEASE')
  };
  await assert.rejects(Link.resolveAndCount('abc123', { connect: async () => client }), /DB write failed/);
  assert.equal(seen.some((sql) => sql.startsWith('UPDATE')), false);
  assert.equal(seen.at(-2), 'ROLLBACK');
  assert.equal(seen.at(-1), 'RELEASE');
});
