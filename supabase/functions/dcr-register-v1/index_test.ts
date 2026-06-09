// Unit tests for dcr-register-v1 pure helpers.
// (End-to-end http tests run in CI against the deployed function.)

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateRedirectUris } from './index.ts';

Deno.test('validateRedirectUris: rejects empty array', () => {
  const r = validateRedirectUris([]);
  if (Array.isArray(r)) throw new Error('expected error');
  assertEquals(r.error, 'invalid_redirect_uri');
});

Deno.test('validateRedirectUris: rejects http (non-localhost)', () => {
  const r = validateRedirectUris(['http://example.com/cb']);
  if (Array.isArray(r)) throw new Error('expected error');
  assertEquals(r.error, 'invalid_redirect_uri');
});

Deno.test('validateRedirectUris: rejects fragment', () => {
  const r = validateRedirectUris(['https://example.com/cb#x']);
  if (Array.isArray(r)) throw new Error('expected error');
  assertEquals(r.error, 'invalid_redirect_uri');
});

Deno.test('validateRedirectUris: accepts https and localhost http', () => {
  const r = validateRedirectUris(['https://example.com/cb', 'http://localhost:3000/cb']);
  if (!Array.isArray(r)) throw new Error('expected ok');
  assertEquals(r.length, 2);
});
