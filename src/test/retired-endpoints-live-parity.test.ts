// Live-parity guard for the 12 retired endpoints.
//
// Standing Order 2 (Ratchet) + RFC 8594 + the 2026-05-04 audit ticket require
// that the deployed OpenAPI spec NEVER advertises an HTTP 200 success response
// for any of the 12 sunset-passed endpoints. The shipped spec MUST advertise
// only HTTP 410 Gone with `x-replacement-endpoint`, `x-successor`,
// `x-sunset-date`, and an RFC 7807 problem+json body.
//
// This test exercises the SHIPPED static `public/openapi.json` (the file Vite
// bundles + the public spec collector serves). A separate uptime workflow
// runs the same matrix against the live deployed URL so a stale CDN can never
// silently downgrade the contract.

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type Op = Record<string, any>;

const RETIRED: ReadonlyArray<readonly [string, 'get' | 'post', string, string]> = [
  ['/v1/mobile-money/charge', 'post', '/v1/gateway/charges?channel=mobile_money', '2026-01-01'],
  ['/v1/mobile-money/transfer', 'post', '/v1/gateway/payouts?channel=mobile_money', '2026-01-01'],
  ['/v1/mobile-money/verify', 'post', '/v1/gateway/charges/{chargeId}', '2026-01-01'],
  ['/v1/mobile-money/to-bank', 'post', '/v1/gateway/payouts?channel=bank_transfer', '2026-01-01'],
  ['/v1/flutterwave/bank-transfer', 'post', '/v1/gateway/payouts?provider=flutterwave', '2026-01-01'],
  ['/v1/flutterwave/banks', 'get', '/v1/banks/directory', '2026-01-01'],
  ['/v1/flutterwave/verify-bank', 'post', '/v1/banks/verify-account', '2026-01-01'],
  ['/v1/stripe/payment-intent', 'post', '/v1/gateway/charges?provider=stripe', '2026-01-01'],
  ['/v1/stripe/confirm-payment', 'post', '/v1/gateway/charges/{chargeId}', '2026-01-01'],
  ['/v1/standards/swift/mt103/parse', 'post', '/v1/standards/iso20022/pacs008/generate', '2025-11-22'],
  ['/v1/standards/swift/mt940/parse', 'post', '/v1/standards/iso20022/camt053/parse', '2025-11-22'],
  ['/v1/standards/swift/mt103/generate', 'post', '/v1/standards/iso20022/pacs008/generate', '2025-11-22'],
];

const SPECS = ['public/openapi.json', 'public/openapi-sandbox.json'];

describe('Retired endpoint live-parity (RFC 8594 + Standing Order 2)', () => {
  for (const specPath of SPECS) {
    describe(specPath, () => {
      let spec: any;
      beforeAll(() => {
        spec = JSON.parse(fs.readFileSync(path.resolve(specPath), 'utf8'));
      });

      it('info.version is at least 4.29.2', () => {
        const v = String(spec?.info?.version ?? '0.0.0');
        const [maj, min, pat] = v.split('.').map((s) => parseInt(s, 10));
        const numeric = (maj || 0) * 1_000_000 + (min || 0) * 1000 + (pat || 0);
        expect(numeric, `info.version=${v}`).toBeGreaterThanOrEqual(4_029_002);
      });

      for (const [p, m, replacement, sunset] of RETIRED) {
        it(`${m.toUpperCase()} ${p} → 410 only, replacement=${replacement}, sunset=${sunset}`, () => {
          const op: Op | undefined = spec.paths?.[p]?.[m];
          expect(op, `${m} ${p} missing from spec`).toBeDefined();
          expect(op!.deprecated).toBe(true);
          expect(op!['x-retired']).toBe(true);
          expect(op!['x-replacement-endpoint']).toBe(replacement);
          expect(op!['x-successor']).toBe(replacement);
          expect(op!['x-sunset-date'] ?? op!['x-sunset']).toBe(sunset);

          const responses = op!.responses ?? {};
          expect(responses['200'], `${m} ${p} must not advertise 200`).toBeUndefined();
          expect(responses['201'], `${m} ${p} must not advertise 201`).toBeUndefined();
          expect(responses['410'], `${m} ${p} must advertise 410`).toBeDefined();
          expect(responses['410'].headers?.Sunset).toBeDefined();
          expect(responses['410'].headers?.Link).toBeDefined();
          expect(responses['410'].content?.['application/problem+json']).toBeDefined();
        });
      }
    });
  }
});
