#!/usr/bin/env node
// Live edge probes for the QR stack — public endpoints only.
// Used by the qr-e2e-regression workflow to block releases if the QR rails
// are unreachable or returning the wrong shape.
const BASE = process.env.AUDIT_BASE || 'https://wdzkzeahdtxlynetndqw.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indkemt6ZWFoZHR4bHluZXRuZHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQ1OTksImV4cCI6MjA4ODQ3MDU5OX0.i-5Sx5xz2ntXQ9mTEfOJ4PQKuaeWRycvbkAQQfx2zYg';

const HDR = { apikey: ANON, Authorization: `Bearer ${ANON}` };
const failures = [];

async function probe(name, url, check) {
  try {
    const r = await fetch(url, { headers: HDR });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }
    const ok = check(r, json, text);
    console.log(`${ok ? '✓' : '✗'} ${name} → ${r.status}`);
    if (!ok) failures.push({ name, status: r.status, body: text.slice(0, 200) });
  } catch (e) {
    console.log(`✗ ${name} → ${e.message}`);
    failures.push({ name, error: e.message });
  }
}

await probe(
  'merchants-qr-directory (public list)',
  `${BASE}/functions/v1/merchants-qr-directory?limit=1`,
  (r, j) => r.status === 200 && (Array.isArray(j?.data) || Array.isArray(j))
);

await probe(
  'pos-qr-payment (unauth → 401)',
  `${BASE}/functions/v1/pos-qr-payment`,
  (r) => r.status === 401 || r.status === 400
);

await probe(
  'qr-telemetry-alert (no spike → ok)',
  `${BASE}/functions/v1/qr-telemetry-alert?dry=1`,
  (r) => r.status === 200 || r.status === 401
);

if (failures.length) {
  console.error(`\n${failures.length} QR probe(s) failed:`);
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('\nAll QR smoke probes passed.');
