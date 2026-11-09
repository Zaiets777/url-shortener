import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLinkWithAlias, validateCustomAlias } from '../src/routes/links.js';

const base = { userId: 'user-1', originalUrl: 'https://example.com/', expiresInDays: 7 };

test('validates optional aliases, including max length', () => {
  assert.equal(validateCustomAlias(undefined), undefined);
  assert.equal(validateCustomAlias('my-link_123'), 'my-link_123');
  assert.equal(validateCustomAlias('x'.repeat(32)), 'x'.repeat(32));
  for (const value of ['', 'a', 'a b', 'a/b', 'a.b', 'ééé', 'x'.repeat(33), null, 17]) {
    assert.throws(() => validateCustomAlias(value), { statusCode: 400 });
  }
});

test('uses chosen alias if available', async () => {
  let received;
  const model = { findByShortCode: async () => null, create: async (input) => { received = input; return input; } };
  const result = await createLinkWithAlias({ ...base, customAlias: 'my-link', model });
  assert.equal(result.shortCode, 'my-link');
  assert.equal(received.shortCode, 'my-link');
});

test('returns 409 if alias already exists in database', async () => {
  const model = { findByShortCode: async () => ({ id: 'taken' }), create: async () => { throw Error('must not insert'); } };
  await assert.rejects(createLinkWithAlias({ ...base, customAlias: 'taken', model }), { statusCode: 409, message: 'This custom alias is already taken' });
});

test('returns 409 if competing request inserts same alias first', async () => {
  const model = { findByShortCode: async () => null, create: async () => { throw Object.assign(new Error('unique'), { code: '23505', constraint: 'links_short_code_key' }); } };
  await assert.rejects(createLinkWithAlias({ ...base, customAlias: 'my-link', model }), { statusCode: 409 });
});

test('generates random code when customAlias omitted; retries collision', async () => {
  const seen = [];
  const model = { create: async (input) => { seen.push(input.shortCode); if (seen.length === 1) throw Object.assign(new Error('unique'), { code: '23505', constraint: 'links_short_code_key' }); return input; } };
  const result = await createLinkWithAlias({ ...base, model, generateCode: () => seen.length ? 'newcode2' : 'oldcode1' });
  assert.deepEqual(seen, ['oldcode1', 'newcode2']);
  assert.equal(result.shortCode, 'newcode2');
});
