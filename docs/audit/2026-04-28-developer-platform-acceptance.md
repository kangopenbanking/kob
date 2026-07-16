# Developer Platform Acceptance Report

**Date:** 2026-04-28  
**Spec version:** v4.17.3  
**Score:** 12/15  (8/10)

## Acceptance matrix

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No internal URL leaks | FAIL | 4 leak(s) |
| 2 | Canonical servers | FAIL | https://api.kangopenbanking.com,https://sandbox-api.kangopenbanking.com |
| 3 | POST /v1/gateway/charges present | PASS | operation found |
| 4 | Sandbox simulation routes | PASS | missing: none |
| 5 | Webhook signature + replay protection | PASS | {"hasSig":true,"hasReplay":true} |
| 6 | Error catalog complete | PASS | domains=8 |
| 7 | Cursor pagination documented | PASS | {"limit":{"in":"query","type":"integer","min":1,"max":100,"default":25},"starting_after":{"in":"query","type":"string","description":"Cursor: return items after this resource id"},"ending_before":{"in":"query","type":"string","description":"Cursor: return items before this resource id"}} |
| 8 | OpenAPI structurally valid | PASS | version=4.53.1 paths=410 |
| 9 | Developer doc pages present | PASS | missing=none |
| 10 | SDK ecosystem | PASS | node.js / typescript,python,php / laravel,postman,java,go |
| 11 | Postman static files | PASS | missing=none |
| 12 | Changelog v4.17.3 | FAIL | not found |
| 13 | Dashboard tooling components | PASS | missing=none |
| 14 | Contract test count | PASS | 96 test files |
| 15 | Foundational routes preserved | PASS | missing=none |

## Notes

- All changes in this pass are **additive** (Standing Order 4 — Surgeon Rule).
- No `operationId`, path key, or schema name was renamed (Standing Order 1 — The Lock).
- Webhook header families: `X-Webhook-*` (legacy) and `Kang-*` (preferred) are both emitted on outbound deliveries and accepted on inbound verification.
- Sandbox simulation surface (`/v1/sandbox/events/simulate`, `/payments/simulate`, `/webhooks/send-test`, `/reset`) routes through the new `sandbox-router` edge function to existing implementation functions; no internal function names are exposed.
- Postman collection regenerates from `public/openapi.json` on each release.

## Remaining risks

- `sandbox-api.kangopenbanking.com` requires Cloudflare DNS + Worker route binding to be fully operational. The spec advertises the URL; infra provisioning is tracked separately in `worker/wrangler.toml`.

## Recommended next improvements

1. Auto-generate the YAML specs from the JSON specs in CI to remove drift.
2. Publish a SHA-256 checksum file alongside the Postman collection for supply-chain integrity.
3. Add a synthetic monitor that hits each `/v1/sandbox/*` endpoint hourly and reports to the public status page.
