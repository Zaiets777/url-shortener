import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUrl } from '../src/routes/links.js';

test('allows well-formed HTTP and HTTPS URLs', () => {
  assert.equal(validateUrl('https://example.com/path'), 'https://example.com/path');
  assert.equal(validateUrl('http://example.com'), 'http://example.com/');
});

test('rejects dangerous or invalid schemes and credentials', () => {
  for (const value of ['javascript:alert(1)', 'file:///etc/passwd', 'https://a:b@example.com', 'invalid', '']) {
    assert.throws(() => validateUrl(value), { statusCode: 400 });
  }
});
