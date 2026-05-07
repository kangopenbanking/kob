# SDK Examples

Language-specific, copy-paste examples for the Kang Open Banking API.
Every example targets the public sandbox (`https://sandbox-api.kangopenbanking.com/v1`) and works with the test credentials published at `/developer/sandbox/credentials`.

## Languages

- [TypeScript / Node.js](./typescript.md)
- [Python](./python.md)
- [PHP / Laravel](./php.md)
- [Java](./java.md)
- [Go](./go.md)
- [Ruby](./ruby.md)

## What every example covers

1. Initialise the client with OAuth2 client credentials
2. Create a charge with `Idempotency-Key`
3. Retry-on-failure with exponential backoff (respects `Retry-After`)
4. Verify a webhook signature (HMAC-SHA256 + 5-minute window)

See also: [Auth & Payments snippets](/docs/snippets/auth-and-payments.md), [Error reference](/developer/api/error-codes), [Idempotency guide](/developer/api/idempotency).
