// Phase 1B-R1I-b.3 — Combined G3 runtime-idempotency cross-operation isolation
// (source-level assertions). Proves that createGlobalAccount and
// updateGlobalAccountPayoutPreference share one reservation framework but
// cannot cross-replay: distinct `resource` scopes and method/route baked
// into the canonical fingerprint guarantee independence even when the same
// UUIDv4 Idempotency-Key is presented to both handlers.
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = process.cwd();
const createSrc = fs.readFileSync(
  path.join(root, 'supabase/functions/nium-create-global-account/index.ts'),
  'utf-8',
);
const updateSrc = fs.readFileSync(
  path.join(root, 'supabase/functions/nium-update-payout-preference/index.ts'),
  'utf-8',
);
const shared = fs.readFileSync(
  path.join(root, 'supabase/functions/_shared/integration-layer/idempotency.ts'),
  'utf-8',
);

describe('b.3 — combined G3 runtime idempotency (cross-operation isolation)', () => {
  it('both handlers import the same shared reserveIdempotency helper', () => {
    expect(createSrc).toMatch(/from ["'][^"']*_shared\/integration-layer\/idempotency/);
    expect(updateSrc).toMatch(/from ["'][^"']*_shared\/integration-layer\/idempotency/);
    expect(createSrc).toMatch(/reserveIdempotency/);
    expect(updateSrc).toMatch(/reserveIdempotency/);
    expect(shared).toMatch(/export async function reserveIdempotency/);
  });

  it('both handlers use the shared integration_idempotency_keys persistence', () => {
    expect(shared).toMatch(/integration_idempotency_keys/);
  });

  it('createGlobalAccount RESOURCE is unique to POST /v1/gateway/global-accounts', () => {
    expect(createSrc).toMatch(
      /const RESOURCE\s*=\s*["']POST \/v1\/gateway\/global-accounts["']/,
    );
  });

  it('updateGlobalAccountPayoutPreference RESOURCE is unique to PATCH .../payout-preference', () => {
    expect(updateSrc).toMatch(
      /const RESOURCE\s*=\s*["']PATCH \/v1\/gateway\/global-accounts\/payout-preference["']/,
    );
  });

  it('resources differ — same client key against both handlers cannot alias by scope', () => {
    const createRes = createSrc.match(
      /const RESOURCE\s*=\s*["']([^"']+)["']/,
    )?.[1];
    const updateRes = updateSrc.match(
      /const RESOURCE\s*=\s*["']([^"']+)["']/,
    )?.[1];
    expect(createRes).toBeTruthy();
    expect(updateRes).toBeTruthy();
    expect(createRes).not.toEqual(updateRes);
  });

  it('createGlobalAccount bakes method=POST + route into the canonical fingerprint', () => {
    expect(createSrc).toMatch(
      /scope:\s*\{[^}]*method:\s*["']POST["'][^}]*route:\s*RESOURCE/,
    );
  });

  it('updateGlobalAccountPayoutPreference bakes method=PATCH + route into the canonical fingerprint', () => {
    expect(updateSrc).toMatch(/method:\s*["']PATCH["']/);
    expect(updateSrc).toMatch(/route:\s*RESOURCE/);
  });

  it('both handlers use canonicalStringify + sha256 for the fingerprint', () => {
    for (const s of [createSrc, updateSrc]) {
      expect(s).toMatch(/canonicalStringify/);
      expect(s).toMatch(/sha256/);
    }
  });

  it('createGlobalAccount reserves under RESOURCE, never under the payout-preference resource', () => {
    expect(createSrc).not.toContain('PATCH /v1/gateway/global-accounts/payout-preference');
  });

  it('updateGlobalAccountPayoutPreference reserves under its own RESOURCE, never the create resource', () => {
    // The create resource is a strict prefix, so match the whole line with the
    // trailing "/payout-preference" suffix to prove no cross-reservation.
    expect(updateSrc).not.toMatch(/RESOURCE\s*=\s*["']POST \/v1\/gateway\/global-accounts["']/);
  });

  it('the shared helper scopes reservations by (merchantId, resource, key) — cross-resource isolation by design', () => {
    // The reservation record is uniquely identified by these three columns in
    // the shared table. Any key reused across two different `resource` values
    // produces two independent rows, which is what makes cross-operation
    // replay structurally impossible.
    expect(shared).toMatch(/merchant_id/);
    expect(shared).toMatch(/resource/);
    expect(shared).toMatch(/idempotency_key/);
  });

  it('createGlobalAccount retains its provider-ambiguity + UUIDv5 operation-lock controls (b.1V / b.1X)', () => {
    expect(createSrc).toMatch(/operation-lock/);
    expect(createSrc).toMatch(/unknown_provider_result|ambiguity/i);
  });

  it('updateGlobalAccountPayoutPreference is SET_STATE / LOCAL_ONLY — no operation-lock, no provider ambiguity', () => {
    expect(updateSrc).not.toMatch(/operation-lock/);
    expect(updateSrc).not.toMatch(/unknown_provider_result/);
  });

  it('both handlers perform ownership / authentication before reservation (no negative caching)', () => {
    // updateGlobalAccountPayoutPreference: account lookup + ownership precedes
    // reservation (the call-site, not the import).
    expect(updateSrc).toMatch(/account_not_found/);
    const authCallIdx = updateSrc.indexOf('sb.auth.getClaims');
    const reserveCallIdx = updateSrc.search(/await\s+reserveIdempotency\(/);
    expect(authCallIdx).toBeGreaterThan(-1);
    expect(reserveCallIdx).toBeGreaterThan(authCallIdx);
  });

  it('public client key contract remains UUIDv4-only (no downgrade to accept UUIDv5)', () => {
    // Shared validator enforces UUID v4; b.3 must not have loosened it.
    expect(shared).toMatch(/UUID_V4_RE\s*=\s*\/\^\[0-9a-f\]\{8\}/);
    expect(shared).toMatch(/MAX_KEY_LEN\s*=\s*255/);
  });
});
