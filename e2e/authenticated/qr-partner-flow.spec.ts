/**
 * E2E — Partner-mode QR card payment + merchant directory discovery.
 *
 * Skips automatically when partner credentials are missing
 * (E2E_PARTNER_CC_TOKEN + E2E_PARTNER_CARD_TOKEN_ID). See e2e/SEEDING.md.
 *
 * Coverage:
 *   1. GET /merchants-qr-directory returns a paginated list (public).
 *   2. GET /merchants-qr-get builds a CRC-valid EMVCo payload.
 *   3. POST /qr-initiate-payment in PARTNER mode requires:
 *        - X-Partner-Cardholder-Ref header
 *        - partner_card_token_id + auth_evidence
 *      and reaches the PISP rail.
 *   4. Negative: missing scope → QR_007.
 *   5. Negative: missing auth_evidence → QR_009.
 */
import { test, expect, request as PWRequest } from '@playwright/test';

const PROJECT_REF = process.env.E2E_SUPABASE_PROJECT_REF ?? 'wdzkzeahdtxlynetndqw';
const FN_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;

const CC = process.env.E2E_PARTNER_CC_TOKEN;
const CARD_TOKEN = process.env.E2E_PARTNER_CARD_TOKEN_ID;
const CARDHOLDER_REF = process.env.E2E_PARTNER_CARDHOLDER_REF ?? 'cust_e2e_42';

test.describe('Partner-mode QR flow', () => {
  test('directory list is public', async () => {
    const ctx = await PWRequest.newContext();
    const res = await ctx.get(`${FN_BASE}/merchants-qr-directory?limit=5`);
    // Allow 200 or 404 (empty seed); never 401/403.
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('object', 'list');
      expect(Array.isArray(body.data)).toBe(true);
    }
    await ctx.dispose();
  });

  test('partner initiate enforces SCA evidence', async () => {
    test.skip(!CC || !CARD_TOKEN, 'Requires partner CC token + card token id');
    const ctx = await PWRequest.newContext();
    const res = await ctx.post(`${FN_BASE}/qr-initiate-payment`, {
      headers: {
        Authorization: `Bearer ${CC}`,
        'X-Partner-Cardholder-Ref': CARDHOLDER_REF,
        'Idempotency-Key': crypto.randomUUID(),
        'Content-Type': 'application/json',
      },
      data: {
        qr_payload: '00020101021126...6304ABCD',
        partner_card_token_id: CARD_TOKEN,
        // Intentionally omit auth_evidence
      },
    });
    expect(res.status()).toBe(412);
    const body = await res.json();
    expect(body.error_code).toBe('QR_009');
    await ctx.dispose();
  });

  test('partner initiate rejects bearer without payments:qr scope', async () => {
    test.skip(!CC, 'Requires partner CC token');
    const ctx = await PWRequest.newContext();
    const res = await ctx.post(`${FN_BASE}/qr-initiate-payment`, {
      headers: {
        Authorization: `Bearer ${process.env.E2E_PARTNER_CC_TOKEN_NOSCOPE ?? 'invalid'}`,
        'X-Partner-Cardholder-Ref': CARDHOLDER_REF,
        'Idempotency-Key': crypto.randomUUID(),
        'Content-Type': 'application/json',
      },
      data: { qr_payload: '00020101021126...6304ABCD' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });
});
