#!/usr/bin/env node
// Regenerate webhook signature fixtures deterministically.
// Output: public/sdk-downloads/webhook-fixtures/
//
// Usage:  node scripts/build-webhook-fixtures.mjs
//
// The script writes the JSON bodies, computes hex HMAC-SHA256 signatures with
// the sandbox secret stored in secret.txt, and writes matching headers files.
// Run this any time you intentionally change a fixture body.

import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'public', 'sdk-downloads', 'webhook-fixtures');

const secret = readFileSync(join(ROOT, 'secret.txt'), 'utf8').trim();

const fixtures = [
  {
    name: 'charge.succeeded',
    body: {
      id: 'evt_01J0FIXTURECHARGESUCCESS01',
      type: 'charge.succeeded',
      created_at: '2026-06-29T12:00:00Z',
      livemode: false,
      data: {
        id: 'ch_01J0FIXTURECHARGE000000001',
        amount: '15000',
        currency: 'XAF',
        status: 'succeeded',
        reference: 'INV-2026-000123',
        customer_id: 'cus_01J0FIXTURECUSTOMER0000001',
        payment_method: 'mobile_money',
        channel: 'mtn_momo',
        fees: '150',
        created_at: '2026-06-29T12:00:00Z',
      },
    },
  },
  {
    name: 'account.updated',
    body: {
      id: 'evt_01J0FIXTUREACCOUNTUPDATED01',
      type: 'account.updated',
      created_at: '2026-06-29T12:05:00Z',
      livemode: false,
      data: {
        id: 'acc_01J0FIXTUREACCOUNT00000001',
        iban: 'CM21100010000123456789012345',
        currency: 'XAF',
        balance: '125000',
        available_balance: '120000',
        status: 'active',
        updated_at: '2026-06-29T12:05:00Z',
      },
    },
  },
];

function sign(payload) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

mkdirSync(join(ROOT, 'tampered'), { recursive: true });

for (const f of fixtures) {
  const raw = JSON.stringify(f.body);
  const sig = sign(raw);
  writeFileSync(join(ROOT, `${f.name}.json`), raw);
  writeFileSync(
    join(ROOT, `${f.name}.headers.json`),
    JSON.stringify(
      {
        'X-Kang-Signature': sig,
        'X-Kang-Event': f.body.type,
        'X-Kang-Event-Id': f.body.id,
        'Content-Type': 'application/json',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`wrote ${f.name} (${raw.length} bytes, sig=${sig.slice(0, 12)}\u2026)`);
}

// Tampered variant: keep the charge.succeeded signature but flip the amount.
const tampered = structuredClone(fixtures[0].body);
tampered.data.amount = '99999';
writeFileSync(
  join(ROOT, 'tampered', 'charge.succeeded.json'),
  JSON.stringify(tampered),
);
console.log('wrote tampered/charge.succeeded.json (signature mismatch expected)');
