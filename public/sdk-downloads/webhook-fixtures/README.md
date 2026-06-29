# Kang Open Banking — Webhook Test Fixtures

Deterministic, signed sample payloads so partner institutions can validate their
webhook receivers (and our SDK verifiers) without hitting a live sandbox.

## Signature scheme

```
X-Kang-Signature = hex( HMAC_SHA256( secret, raw_request_body ) )
```

`raw_request_body` is the bytes delivered on the wire — do not re-serialize the
JSON before verifying. Compare with a constant-time comparator
(`crypto.timingSafeEqual` in Node, `hmac.compare_digest` in Python,
`hash_equals` in PHP). All three Kang SDKs ship a helper that does this for you.

## Files

| File | Purpose |
| --- | --- |
| `secret.txt` | Sandbox-only HMAC secret. Never reuse in production. |
| `charge.succeeded.json` | Canonical `charge.succeeded` body. |
| `charge.succeeded.headers.json` | Headers Kang would send for that body. |
| `account.updated.json` | Canonical `account.updated` body. |
| `account.updated.headers.json` | Headers for that body. |
| `tampered/charge.succeeded.json` | One field flipped. Verifiers MUST reject. |

## Quick check

Node:

```ts
import { readFileSync } from 'node:fs';
import KangOpenBanking from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({ apiKey: 'sandbox' });
const body = readFileSync('charge.succeeded.json', 'utf8');
const { 'X-Kang-Signature': sig } = JSON.parse(readFileSync('charge.succeeded.headers.json','utf8'));
const secret = readFileSync('secret.txt','utf8').trim();

console.log(await kob.verifyWebhookSignature(body, sig, secret)); // true
```

Python:

```python
from pathlib import Path, json
from kangopenbanking import KangOpenBanking

body = Path('charge.succeeded.json').read_text()
sig  = json.loads(Path('charge.succeeded.headers.json').read_text())['X-Kang-Signature']
secret = Path('secret.txt').read_text().strip()

print(KangOpenBanking.verify_webhook_signature(body, sig, secret))  # True
```

PHP:

```php
use Kang\OpenBanking\KangOpenBanking;
$body   = file_get_contents('charge.succeeded.json');
$hdrs   = json_decode(file_get_contents('charge.succeeded.headers.json'), true);
$secret = trim(file_get_contents('secret.txt'));
var_dump(KangOpenBanking::verifyWebhookSignature($body, $hdrs['X-Kang-Signature'], $secret));
```

## Reproducibility

These fixtures are byte-identical to the output of
`node scripts/build-webhook-fixtures.mjs`. The CI workflow
`.github/workflows/webhook-signature-smoke.yml` verifies them on every push and
nightly.
