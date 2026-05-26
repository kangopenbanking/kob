/**
 * qr-system-regression.test.ts
 *
 * Static regression tests for the QR stack — runs on every CI/post-deploy.
 * Catches the classes of bugs we fixed in 2026-05-26-consumer-qr-pentest.md:
 *  - parser rejects valid Request-Money QRs (`kang_id` field)
 *  - missing PIN gate around `pos-qr-payment`
 *  - telemetry hook drift (renamed error codes break alerting)
 *  - removed QR edge functions
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('QR system regression', () => {
  it('CustomerScan accepts kob_pay with either account or kang_id', () => {
    const src = read('src/pages/customer-app/CustomerScan.tsx');
    expect(src).toMatch(/kob_pay.*account.*kang_id|account \|\| data\.kang_id/s);
  });

  it('CustomerScan PIN-gates merchant payments before executePayment', () => {
    const src = read('src/pages/customer-app/CustomerScan.tsx');
    expect(src).toMatch(/PinConfirmDialog/);
    expect(src).toMatch(/onConfirmed=\{executePayment\}/);
  });

  it('CustomerScan logs telemetry on parse failures', () => {
    const src = read('src/pages/customer-app/CustomerScan.tsx');
    expect(src).toMatch(/logQrEvent|qr-telemetry/);
  });

  it('All QR edge functions are present in the repo', () => {
    const required = [
      'pos-qr-payment',
      'merchant-qr',
      'merchants-qr-directory',
      'merchants-qr-get',
      'qr-initiate-payment',
      'qr-cancel-payment',
      'qr-telemetry-alert',
    ];
    for (const fn of required) {
      const p = path.join(ROOT, 'supabase/functions', fn, 'index.ts');
      expect(fs.existsSync(p), `${fn}/index.ts missing`).toBe(true);
    }
  });

  it('qr-telemetry stable error codes are not renamed', () => {
    const src = read('src/lib/qr-telemetry.ts');
    for (const code of [
      'QR_PARSE_INVALID_JSON',
      'QR_PARSE_UNKNOWN_TYPE',
      'QR_PARSE_MISSING_FIELDS',
      'QR_PAY_EDGE_ERROR',
    ]) {
      expect(src, `error code ${code} removed`).toContain(code);
    }
  });

  it('pos-qr-payment requires an Idempotency-Key in invocations', () => {
    const src = read('src/pages/customer-app/CustomerScan.tsx');
    expect(src).toMatch(/Idempotency-Key.*qr_pay_/);
  });
});
