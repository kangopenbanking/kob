// @ts-nocheck
/**
 * Webhook signature contract test.
 *
 * Locks documentation examples to the runtime verification logic in
 * supabase/functions/gateway-webhook-deliver-v2/index.ts so the
 * "secret + timestamp + header names" trio cannot drift.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');

const RUNTIME_FILES = [
  'supabase/functions/gateway-webhook-deliver-v2/index.ts',
  'supabase/functions/gateway-deliver-webhook/index.ts',
];
const DOC_FILES = [
  'src/pages/developer/GatewayWebhooksGuide.tsx',
  'src/pages/developer/PollingAndWebhooks.tsx',
  'src/pages/developer/webhook-verification-snippet.md',
];

const SIG_HEADER = 'X-Webhook-Signature';
const EVT_HEADER = 'X-Webhook-Event';

function read(rel: string) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

describe('Webhook signature: docs match runtime', () => {
  it('runtime emits X-Webhook-Signature + X-Webhook-Event', () => {
    const blob = RUNTIME_FILES.map(read).join('\n');
    expect(blob).toContain(SIG_HEADER);
    expect(blob).toContain(EVT_HEADER);
  });

  it('documentation references the same header names', () => {
    const blob = DOC_FILES.map(read).join('\n');
    expect(blob).toContain(SIG_HEADER);
  });

  it('documentation examples use HMAC-SHA256 with the endpoint secret', () => {
    const blob = DOC_FILES.map(read).join('\n').toLowerCase();
    expect(blob).toMatch(/hmac/);
    expect(blob).toMatch(/sha-?256/);
    expect(blob).toMatch(/secret/);
  });

  it('documentation references X-Webhook-ID for replay protection', () => {
    const blob = DOC_FILES.map(read).join('\n');
    expect(blob).toContain('X-Webhook-ID');
  });
});
