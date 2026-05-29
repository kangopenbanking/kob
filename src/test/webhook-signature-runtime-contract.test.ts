// @ts-nocheck
/**
 * Phase 8 runtime contract — webhook delivery must emit timestamped
 * Stripe-style signature alongside parallel legacy header.
 *
 * Source-level guard: the runtime file is the source of truth and ships
 * to Edge Functions. We assert the emission pattern in the source to
 * prevent regressions (the actual delivery is exercised by webhook E2E tests).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const src = fs.readFileSync(
  path.join(root, 'supabase/functions/gateway-webhook-deliver-v2/index.ts'),
  'utf-8',
);

describe('Phase 8 — webhook delivery v2 signature emission', () => {
  it('signs ${ts}.${body} not just body', () => {
    expect(src).toMatch(/signedPayload\s*=\s*`\$\{ts\}\.\$\{payloadStr\}`/);
  });

  it('emits X-Webhook-Signature in t=<ts>,v1=<hex> format', () => {
    expect(src).toMatch(/'X-Webhook-Signature':\s*`t=\$\{ts\},v1=\$\{tsSig\}`/);
  });

  it('emits X-Webhook-Timestamp header alongside signature', () => {
    expect(src).toMatch(/'X-Webhook-Timestamp':\s*String\(ts\)/);
  });

  it('emits parallel deprecated legacy header for back-compat', () => {
    expect(src).toMatch(/X-Webhook-Signature-Legacy/);
  });

  it('signs both timestamped and legacy payloads in parallel', () => {
    const occurrences = (src.match(/compute_endpoint_hmac/g) || []).length;
    // dispatch path + process path × (timestamped + legacy) = at least 4
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });
});
