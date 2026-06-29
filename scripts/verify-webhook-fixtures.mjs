#!/usr/bin/env node
// Verify the published webhook fixtures against each Kang SDK's verifier.
// Fails the process with exit 1 if any of these are false:
//   - canonical body + signature verifies true (Node, Python, PHP)
//   - tampered body + canonical signature verifies false
//   - canonical body + wrong-secret verifies false

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHmac, timingSafeEqual } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'public', 'sdk-downloads', 'webhook-fixtures');
const SECRET = readFileSync(join(ROOT, 'secret.txt'), 'utf8').trim();

let failures = 0;
function assert(label, cond) {
  if (cond) {
    console.log(`  ok    ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

// --- Node verifier (mirrors packages/sdk-node/src/client.ts) ---
function nodeVerify(body, sig, secret) {
  const computed = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(sig, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function runFixture(name) {
  console.log(`\n[${name}]`);
  const body = readFileSync(join(ROOT, `${name}.json`), 'utf8');
  const headers = JSON.parse(readFileSync(join(ROOT, `${name}.headers.json`), 'utf8'));
  const sig = headers['X-Kang-Signature'];

  assert(`node: canonical body verifies`, nodeVerify(body, sig, SECRET));
  assert(`node: wrong secret rejected`, !nodeVerify(body, sig, 'whsec_wrong_secret'));

  // Python verifier
  const py = spawnSync('python3', ['-c', `
import hmac, hashlib, sys
secret = sys.argv[1].encode()
body   = open(sys.argv[2], 'rb').read()
sig    = sys.argv[3]
computed = hmac.new(secret, body, hashlib.sha256).hexdigest()
print('1' if hmac.compare_digest(computed, sig) else '0')
`, SECRET, join(ROOT, `${name}.json`), sig]);
  assert(`python: canonical body verifies`, py.stdout.toString().trim() === '1');

  // PHP verifier
  const php = spawnSync('php', ['-r', `
$secret = $argv[1]; $body = file_get_contents($argv[2]); $sig = $argv[3];
$computed = hash_hmac('sha256', $body, $secret);
echo hash_equals($computed, $sig) ? '1' : '0';
`, '--', SECRET, join(ROOT, `${name}.json`), sig]);
  if (php.status === null) {
    console.log('  skip  php: php binary not available');
  } else {
    assert(`php: canonical body verifies`, php.stdout.toString().trim() === '1');
  }
}

for (const fixture of ['charge.succeeded', 'account.updated']) {
  runFixture(fixture);
}

console.log(`\n[tampered]`);
const tamperedBody = readFileSync(join(ROOT, 'tampered', 'charge.succeeded.json'), 'utf8');
const goodHeaders = JSON.parse(readFileSync(join(ROOT, 'charge.succeeded.headers.json'), 'utf8'));
assert('tampered body rejected (node)', !nodeVerify(tamperedBody, goodHeaders['X-Kang-Signature'], SECRET));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll webhook fixture checks passed.');
