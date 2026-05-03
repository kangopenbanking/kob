/**
 * v4.29.0 audit remediation regression tests.
 * One assertion per finding from the external E2E audit.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

let spec: any;
let sbx: any;
beforeAll(() => {
  spec = JSON.parse(fs.readFileSync(path.resolve('public/openapi.json'), 'utf8'));
  sbx = JSON.parse(fs.readFileSync(path.resolve('public/openapi-sandbox.json'), 'utf8'));
});

describe('v4.29.0 — audit remediation', () => {
  it('Pre-flight: version is 4.29.0 across SSOT, JSON, sandbox, changelog', () => {
    const ssot = fs.readFileSync(path.resolve('src/config/version.ts'), 'utf8');
    expect(ssot).toMatch(/KOB_API_VERSION\s*=\s*"4\.29\.0"/);
    expect(spec.info.version).toBe('4.29.0');
    expect(sbx.info.version).toBe('4.29.0');
    const cl = JSON.parse(fs.readFileSync(path.resolve('public/changelog.json'), 'utf8'));
    expect(cl.apiVersion).toBe('4.29.0');
    expect(cl.entries.some((e: any) => e.version === '4.29.0')).toBe(true);
  });

  it('P1.1: DCR /v1/dcr/register references DcrRegistrationRequest via $ref', () => {
    const ref = spec.paths['/v1/dcr/register'].post.requestBody.content['application/json'].schema.$ref;
    expect(ref).toBe('#/components/schemas/DcrRegistrationRequest');
  });

  it('P1.2: PISP payment-submission body has expanded required + properties', () => {
    const sch = spec.paths['/v1/pisp/payment-submission'].post.requestBody.content['application/json'].schema;
    for (const r of ['payment_id', 'instructed_amount', 'creditor_account', 'risk']) {
      expect(sch.required).toContain(r);
    }
    for (const p of ['instructed_amount', 'creditor_account', 'debtor_account', 'remittance_information', 'risk']) {
      expect(sch.properties[p]).toBeDefined();
    }
  });

  it('P1.3: 12 retired endpoints have x-retired + 410 + Sunset header', () => {
    const retired = [
      ['/v1/mobile-money/charge', 'post'],
      ['/v1/mobile-money/transfer', 'post'],
      ['/v1/mobile-money/verify', 'post'],
      ['/v1/mobile-money/to-bank', 'post'],
      ['/v1/flutterwave/bank-transfer', 'post'],
      ['/v1/flutterwave/banks', 'get'],
      ['/v1/flutterwave/verify-bank', 'post'],
      ['/v1/stripe/payment-intent', 'post'],
      ['/v1/stripe/confirm-payment', 'post'],
      ['/v1/standards/swift/mt103/parse', 'post'],
      ['/v1/standards/swift/mt940/parse', 'post'],
      ['/v1/standards/swift/mt103/generate', 'post'],
    ] as const;
    for (const [p, m] of retired) {
      const op = spec.paths[p]?.[m];
      expect(op, `${m} ${p}`).toBeDefined();
      expect(op['x-retired']).toBe(true);
      expect(op['x-successor']).toBeTruthy();
      expect(op.responses['410']).toBeDefined();
      expect(op.responses['410'].headers?.Sunset).toBeDefined();
    }
  });

  it('P2.1: no monetary-named property is type number/integer', () => {
    const RE = /^(amount|fee|fee_amount|net_amount|fixed_fee|balance|principal|interest|fees|repayment|installment|gross|tax|vat|principal_amount|interest_amount|fees_amount|total_due_amount|amount_minor|amount_paid|amount_due|outstanding_balance|opening_balance|closing_balance|available_balance|reserved_balance|debit_amount|credit_amount|charge_amount|refund_amount|payout_amount|settlement_amount)$/i;
    const offenders: string[] = [];
    for (const [name, sch] of Object.entries<any>(spec.components.schemas)) {
      if (!sch?.properties) continue;
      for (const [pn, pv] of Object.entries<any>(sch.properties)) {
        if (RE.test(pn) && (pv?.type === 'number' || pv?.type === 'integer') && !pv?.deprecated) {
          offenders.push(`${name}.${pn}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('P2.2: webhook signature header canonical = X-Webhook-Signature with X-KOB-Signature alias', () => {
    const w = spec['x-webhook-policy'];
    expect(w.signature_header).toBe('X-Webhook-Signature');
    expect(w.signature_header_aliases).toContain('X-KOB-Signature');
    expect(w['x-canonical-headers']).toBeDefined();
  });

  it('P2.3: Webhook v1 endpoints deprecated with successor', () => {
    const v1 = ['/v1/webhooks', '/v1/merchants/webhooks'];
    for (const p of v1) {
      const item = spec.paths[p];
      if (!item) continue;
      for (const m of ['get', 'post']) {
        if (!item[m]) continue;
        expect(item[m].deprecated, `${m} ${p}`).toBe(true);
        expect(item[m]['x-successor']).toContain('/v1/webhooks/v2');
      }
    }
    // v2 must NOT be deprecated
    const v2 = spec.paths['/v1/webhooks/v2/endpoints'];
    if (v2?.post) expect(v2.post.deprecated).not.toBe(true);
  });

  it('P2.4: zero application/problem+json refs point at Error schema', () => {
    const txt = JSON.stringify(spec);
    // count occurrences where problem+json content has Error ref
    const matches = txt.match(/"application\/problem\+json"\s*:\s*\{\s*"schema"\s*:\s*\{\s*"\$ref"\s*:\s*"#\/components\/schemas\/Error"/g) || [];
    expect(matches.length).toBe(0);
  });

  it('P2.5: x-rate-limits has window_unit per_minute', () => {
    expect(spec['x-rate-limits'].window_unit).toBe('per_minute');
  });

  it('P3.1: every operation has a 5XX or default response', () => {
    const offenders: string[] = [];
    for (const [p, item] of Object.entries<any>(spec.paths)) {
      for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
        const op = item[m];
        if (!op?.responses) continue;
        const has5 = Object.keys(op.responses).some((c) => /^5/.test(c) || c === 'default');
        if (!has5) offenders.push(`${m.toUpperCase()} ${p}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('P3.2: x-sdks includes Java and Go', () => {
    const langs = (spec['x-sdks'] || []).map((s: any) => (s.language || '').toLowerCase());
    expect(langs.some((l: string) => l.includes('java'))).toBe(true);
    expect(langs.some((l: string) => l.includes('go'))).toBe(true);
  });

  it('P3.3: POST /v1/interbank/payments requires currency', () => {
    const sch = spec.paths['/v1/interbank/payments'].post.requestBody.content['application/json'].schema;
    expect(sch.required).toContain('currency');
  });

  it('P3.4: AISP list endpoints declare x-pagination-style cursor', () => {
    const lists = [
      '/v1/aisp/accounts',
      '/v1/aisp/accounts/{accountId}/balances',
      '/v1/aisp/accounts/{accountId}/transactions',
      '/v1/aisp/accounts/{accountId}/beneficiaries',
      '/v1/aisp/accounts/{accountId}/standing-orders',
      '/v1/aisp/accounts/{accountId}/direct-debits',
    ];
    for (const p of lists) {
      const op = spec.paths[p]?.get;
      if (!op) continue;
      expect(op['x-pagination-style']).toBe('cursor');
    }
  });

  it('Sandbox spec mirrors the same version', () => {
    expect(sbx.info.version).toBe('4.29.0');
  });
});
