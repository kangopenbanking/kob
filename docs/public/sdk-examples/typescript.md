# TypeScript / Node.js

```bash
npm install @kangopenbanking/sdk
```

## Initialise

```ts
import { KOBClient } from '@kangopenbanking/sdk';

const kob = new KOBClient({
  clientId: process.env.KANG_CLIENT_ID!,
  clientSecret: process.env.KANG_CLIENT_SECRET!,
  environment: 'sandbox',
});
```

## Create a charge

```ts
import { randomUUID } from 'node:crypto';

const charge = await kob.gateway.charges.create({
  amount: 50000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '+237670000000',
  tx_ref: randomUUID(),
}, { idempotencyKey: randomUUID() });
```

## Retry with exponential backoff

```ts
async function withRetry<T>(fn: () => Promise<T>, max = 5): Promise<T> {
  for (let i = 0; i < max; i++) {
    try { return await fn(); }
    catch (e: any) {
      if (![429, 500, 502, 503, 504].includes(e.status) || i === max - 1) throw e;
      const wait = e.retryAfter ?? Math.min(2 ** i * 1000, 30_000);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw new Error('unreachable');
}
```

## Verify a webhook

```ts
import crypto from 'node:crypto';

export function verify(rawBody: string, sig: string, ts: string, secret: string) {
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
```
