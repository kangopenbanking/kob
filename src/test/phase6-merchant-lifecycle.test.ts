/**
 * Phase 6 — Merchant Lifecycle E2E
 * --------------------------------
 *  KYB submit → admin review → approved → merchant ACTIVE
 *  Keys issued → rotated → old key invalid after grace window
 *
 * Models the contract enforced by:
 *   - supabase/functions/gateway-merchant-kyb/index.ts (submit)
 *   - supabase/functions/gateway-merchant-kyb-review/index.ts (approve/reject)
 *   - supabase/functions/gateway-merchant-keys/index.ts (issue/rotate/list)
 */
import { describe, it, expect, beforeEach } from 'vitest';

type Merchant = {
  id: string; user_id: string; status: 'DRAFT' | 'SUBMITTED' | 'ACTIVE' | 'REJECTED';
  kyb_status: 'not_submitted' | 'submitted' | 'approved' | 'rejected';
  kyb_documents?: any[]; kyb_rejection_reason?: string | null;
};
type Key = {
  id: string; merchant_id: string; environment: 'sandbox' | 'live';
  public_key: string; secret_key_hash: string;
  is_active: boolean; revoked_at: string | null; grace_until: string | null;
};

const GRACE_MS = 24 * 60 * 60 * 1000; // 24h grace per Standing Order P3 sandbox stability

function lifecycle() {
  const merchants: Merchant[] = [{ id: 'm1', user_id: 'u1', status: 'DRAFT', kyb_status: 'not_submitted' }];
  const keys: Key[] = [];
  return {
    submit(merchantId: string, userId: string, documents: any[]) {
      const m = merchants.find((m) => m.id === merchantId);
      if (!m) return { status: 404, body: { error: 'not_found' } };
      if (m.user_id !== userId) return { status: 403, body: { error: 'forbidden' } };
      if (!['not_submitted', 'rejected'].includes(m.kyb_status)) return { status: 409, body: { error: 'invalid_state' } };
      if (!documents?.length) return { status: 400, body: { error: 'documents_required' } };
      m.kyb_status = 'submitted'; m.status = 'SUBMITTED'; m.kyb_documents = documents;
      return { status: 200, body: { kyb_status: m.kyb_status, merchant_status: m.status } };
    },
    review(merchantId: string, isAdmin: boolean, decision: 'approve' | 'reject', reason?: string) {
      if (!isAdmin) return { status: 403, body: { error: 'forbidden' } };
      const m = merchants.find((m) => m.id === merchantId);
      if (!m) return { status: 404, body: { error: 'not_found' } };
      if (m.kyb_status !== 'submitted') return { status: 409, body: { error: 'not_submitted' } };
      if (decision === 'approve') { m.kyb_status = 'approved'; m.status = 'ACTIVE'; }
      else { m.kyb_status = 'rejected'; m.status = 'REJECTED'; m.kyb_rejection_reason = reason || 'unspecified'; }
      return { status: 200, body: { kyb_status: m.kyb_status, merchant_status: m.status } };
    },
    issueKey(merchantId: string, env: 'sandbox' | 'live' = 'sandbox') {
      const m = merchants.find((m) => m.id === merchantId);
      if (!m || m.status !== 'ACTIVE') return { status: 403, body: { error: 'merchant_not_active' } };
      const id = `k_${keys.length + 1}`;
      const secret = `sk_${env}_${id}_secret`;
      const k: Key = {
        id, merchant_id: merchantId, environment: env,
        public_key: `pk_${env}_${id}`, secret_key_hash: `hash(${secret})`,
        is_active: true, revoked_at: null, grace_until: null,
      };
      keys.push(k);
      return { status: 201, body: { ...k, secret_key: secret } };
    },
    rotateKey(keyId: string, now: number) {
      const old = keys.find((k) => k.id === keyId);
      if (!old) return { status: 404, body: { error: 'not_found' } };
      // Old key kept active during grace window, then expires
      old.grace_until = new Date(now + GRACE_MS).toISOString();
      const id = `k_${keys.length + 1}`;
      const secret = `sk_${old.environment}_${id}_rotated`;
      const k: Key = {
        id, merchant_id: old.merchant_id, environment: old.environment,
        public_key: `pk_${old.environment}_${id}`, secret_key_hash: `hash(${secret})`,
        is_active: true, revoked_at: null, grace_until: null,
      };
      keys.push(k);
      return { status: 200, body: { new_key: { ...k, secret_key: secret }, revoked_key_id: old.id, grace_until: old.grace_until } };
    },
    verifyKey(secret_key_hash: string, now: number) {
      const k = keys.find((k) => k.secret_key_hash === secret_key_hash);
      if (!k) return { valid: false, reason: 'unknown_key' };
      if (k.grace_until) {
        const exp = new Date(k.grace_until).getTime();
        if (now > exp) return { valid: false, reason: 'expired_after_grace' };
        return { valid: true, in_grace: true };
      }
      if (!k.is_active) return { valid: false, reason: 'revoked' };
      return { valid: true, in_grace: false };
    },
    _state: { merchants, keys },
  };
}

describe('Phase 6 · Merchant lifecycle — KYB', () => {
  let l: ReturnType<typeof lifecycle>;
  beforeEach(() => { l = lifecycle(); });

  it('full happy path: submit → admin approve → merchant ACTIVE', () => {
    const sub = l.submit('m1', 'u1', [{ type: 'business_registration', url: 'https://x' }]);
    expect(sub.status).toBe(200);
    expect(sub.body.kyb_status).toBe('submitted');
    expect(sub.body.merchant_status).toBe('SUBMITTED');

    const rev = l.review('m1', true, 'approve');
    expect(rev.status).toBe(200);
    expect(rev.body.kyb_status).toBe('approved');
    expect(rev.body.merchant_status).toBe('ACTIVE');
  });

  it('non-owner cannot submit', () => {
    const res = l.submit('m1', 'attacker', [{ type: 'x' }]);
    expect(res.status).toBe(403);
  });

  it('non-admin cannot review', () => {
    l.submit('m1', 'u1', [{ type: 'x' }]);
    const res = l.review('m1', false, 'approve');
    expect(res.status).toBe(403);
  });

  it('rejected merchant can resubmit and be approved', () => {
    l.submit('m1', 'u1', [{ type: 'x' }]);
    l.review('m1', true, 'reject', 'docs unclear');
    expect(l._state.merchants[0].kyb_status).toBe('rejected');
    const r2 = l.submit('m1', 'u1', [{ type: 'x', v: 2 }]);
    expect(r2.status).toBe(200);
    const rev = l.review('m1', true, 'approve');
    expect(rev.body.merchant_status).toBe('ACTIVE');
  });

  it('cannot issue keys before merchant is ACTIVE', () => {
    const res = l.issueKey('m1');
    expect(res.status).toBe(403);
  });
});

describe('Phase 6 · Merchant lifecycle — Key rotation + grace', () => {
  let l: ReturnType<typeof lifecycle>;
  beforeEach(() => {
    l = lifecycle();
    l.submit('m1', 'u1', [{ type: 'x' }]);
    l.review('m1', true, 'approve');
  });

  it('issue key, rotate key, old key still valid during grace', () => {
    const k1 = (l.issueKey("m1", "sandbox").body as any);
    const now = Date.parse('2026-04-30T00:00:00Z');
    const r = l.rotateKey(k1.id, now);
    expect(r.status).toBe(200);

    // Old key still valid 1h after rotation
    const within = l.verifyKey(k1.secret_key_hash, now + 60 * 60 * 1000);
    expect(within.valid).toBe(true);
    expect(within.in_grace).toBe(true);

    // New key valid normally
    const newKey = l.verifyKey(r.body.new_key.secret_key_hash, now + 60 * 60 * 1000);
    expect(newKey.valid).toBe(true);
    expect(newKey.in_grace).toBe(false);
  });

  it('old key invalid after grace window expires', () => {
    const k1 = (l.issueKey("m1", "sandbox").body as any);
    const now = Date.parse('2026-04-30T00:00:00Z');
    l.rotateKey(k1.id, now);

    const after = l.verifyKey(k1.secret_key_hash, now + GRACE_MS + 1000);
    expect(after.valid).toBe(false);
    expect(after.reason).toBe('expired_after_grace');
  });
});
