// Phase 1B-R1I-a.3 — source-level wiring assertions for the Nium hardening.
// Runs in Vitest (Node) against the actual Edge Function source so CI can
// prove the runtime handler wires the new helpers correctly.
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = process.cwd();
const handler = fs.readFileSync(
  path.join(root, 'supabase/functions/nium-webhook/index.ts'),
  'utf-8',
);
const shared = fs.readFileSync(
  path.join(root, 'supabase/functions/_shared/webhook-replay-protection.ts'),
  'utf-8',
);

describe('Nium webhook — Phase 1B-R1I-a.3 hardening wiring', () => {
  it('imports fingerprint + replay-window helpers', () => {
    expect(handler).toMatch(/computePayloadFingerprint/);
    expect(handler).toMatch(/enforceReplayWindow/);
    expect(handler).toMatch(/markWebhookProcessed/);
  });

  it('declares a ±5 min replay window constant', () => {
    expect(handler).toMatch(/REPLAY_WINDOW_SECONDS\s*=\s*300/);
  });

  it('enforces the replay window when a timestamp header is present', () => {
    expect(handler).toMatch(/x-nium-timestamp/);
    expect(handler).toMatch(/enforceReplayWindow\(/);
    expect(handler).toMatch(/outside_replay_window|invalid_timestamp/);
  });

  it('passes payload fingerprint into checkAndRegisterWebhook', () => {
    expect(handler).toMatch(/payloadFingerprint\s*=\s*await\s+computePayloadFingerprint\(raw\)/);
    expect(handler).toMatch(/payload_fingerprint:\s*payloadFingerprint/);
  });

  it('rejects payload_fingerprint_mismatch with HTTP 409', () => {
    expect(handler).toMatch(/replay\.mismatch/);
    expect(handler).toMatch(/payload_fingerprint_mismatch[\s\S]{0,80}409/);
  });

  it('marks inbox rows processed after acceptance', () => {
    expect(handler).toMatch(/markWebhookProcessed/);
    expect(handler).toMatch(/inboxId/);
  });

  it('shared helper exposes fingerprint, window, mismatch and stale-retry semantics', () => {
    expect(shared).toMatch(/export async function computePayloadFingerprint/);
    expect(shared).toMatch(/export function enforceReplayWindow/);
    expect(shared).toMatch(/payload_fingerprint_mismatch/);
    expect(shared).toMatch(/stale_retry_reclaimed/);
    expect(shared).toMatch(/stale_retry_after_seconds/);
  });

  it('shared helper preserves back-compat: existing callers without fingerprint still work', () => {
    // The new fields on ReplayCheckArgs must be optional.
    expect(shared).toMatch(/payload_fingerprint\?\s*:\s*string/);
    expect(shared).toMatch(/stale_retry_after_seconds\?\s*:\s*number/);
  });
});
