# Internal Engineering Changelog (Kang Open Banking)

This document is **internal only**. It is NOT served from the API, NOT linked from /developer, and NOT part of any public artifact. It exists to preserve the engineering rationale, per-version self-review, and Guardian/Standing-Order citations that were previously embedded in the public OpenAPI `info.description`.

If you are an external integrator, the public changelog is at https://kangopenbanking.com/changelog.json and at /developer/changelog. This file is not part of that surface.

---

## Archive: openapi.json info.description as of 2026-06-25 (pre-v4.51.1)

```
COBAC & BEAC compliant Open Banking API providing Account Information (AISP), Payment Initiation (PISP), Credit Scoring, Loans, Savings, Mobile Money, Double-Entry Ledger, Virtual Cards, Custodial Wallets, Escrow, Compliance Screening, SLA Monitoring, POS Commerce, Bank Directory, Bank Connector Kit, Interbank Engine (ISO 20022), and comprehensive financial services for the Central African region. All monetary examples use XAF (Central African CFA Franc). Note: POS, Catalog, and Inventory modules are planned for a future release and are not yet exposed in this version of the API. | v4.3.0 (2026-03-27): Standards remediation release. Fixed PISP required fields, added FAPI x-fapi-interaction-id headers, corrected server URL versioning, moved provider webhook paths under /v1/, added currency enums, corrected amount field types to string, added 4 missing tag declarations, removed 6 unused POS tags, added OIDC discovery mandatory fields, added OAuth2 refreshUrl, enumerated webhook event types, added pagination to 17 list endpoints, added savings account read endpoints, extended KYC schema for FATF R.10 compliance, structured escrow release_conditions, added DCR grant_type enums, added Sunset metadata to deprecated endpoints, secured WooCommerce plugin download endpoint. No breaking changes to existing paths, operationIds, or schema names. | v4.4.0 (2026-03-29): Final compliance release. R1: Removed duplicate inline pagination params. R2: Wired StandardResponse/PaginatedResponse allOf envelopes on 12 operations. R3: Added 6 OBIE-mandated required fields to Account schema. R4: Added 7 OBIE PascalCase aliases with x-obie-mapping to Transaction schema. R5: Added 5 FAPI params (nonce, request_uri, request, acr_values, claims) to /v1/oauth/authorize. R6: Added 8 missing fields to GatewayCharge schema. R7: Added PATCH/DELETE to subscriptions endpoint. R8: Added ProblemDetails (RFC 7807) schema with application/problem+json on 6 endpoints. R9: Added ISO 20022 metadata to interbank payment endpoints. R10: Added mTLS security option to /v1/oauth/token. R11: Added 5 new ISO 20022 message endpoints (pacs.004, pacs.009, camt.052, camt.054, camt.056). R12: Added PayPal webhook signature verification documentation. No breaking changes. | v4.5.0 (2026-03-27): Final compliance push — 100/100. N1: Standards-ISO 20022 tag declared. N2: nonce required=true. N3: Token endpoint restored for public PKCE clients [{},{"mtls":[]}]. N4: camt052/054 renamed to parse with correct operationIds parseISO20022Camt052/parseISO20022Camt054 and correct x-iso20022-message versions. N5: ProblemDetails extended with error_id and timestamp. N6: GatewayCharge required[] added. N7: Transaction required[] added. N8-N11: StandardResponse/PaginatedResponse wired to 4 remaining operations. N11b: TransactionInformation and Status OBIE aliases added. N11c: Account required[] extended with status. N12: KYC submit 400 now supports application/problem+json. N13: PayPal webhook signature verification headers fully documented. N14: x-iso20022-message added to original 4 ISO 20022 endpoints. N15: GatewaySubscription trial, cancel_at_period_end, billing_cycle_anchor, metadata fields added. Zero breaking changes. | v4.6.0 (2026-03-27): 100/100 COMPLIANCE ACHIEVED. G1: code_challenge and code_challenge_method required=true — FAPI 1.0 Advanced fully satisfied, API now certifiable. G2: required[] added to all 37 remaining schemas — complete schema validation coverage across all 49+1 schemas. G3: Idempotency-Key added to 15 payment-related POST endpoints — universal idempotency coverage. G4: StandardResponse allOf applied to 19 single-resource GET endpoints — consistent response envelope. G5: PaginatedResponse allOf applied to all 67 list GET endpoints — universal paginated envelope. G6: application/problem+json added to all 400 responses — RFC 7807 fully adopted across all 339 operations. G7: WebhookEventPayload base schema added with 52-event type mapping and data examples. G8: pushed_authorization_request_endpoint and backchannel_authentication_endpoint added to OIDC discovery. Zero breaking changes. Guardian invariants protected throughout.

## Token Lifetimes

| Token Type | Lifetime | Rotation Policy |
|---|---|---|
| Access Token | 15 minutes | Non-rotating; request a new one via refresh |
| Refresh Token | 30 days | Rotating — each use issues a new refresh token and invalidates the old one |
| Authorization Code | 60 seconds | Single-use; expires if not exchanged |

Refresh token reuse detection is enabled: if a previously used refresh token is presented, all tokens in the session chain are revoked immediately (per OAuth 2.1 Section 6.1).

## Webhook Delivery Policy

| Parameter | Value |
|---|---|
| Maximum attempts | 7 |
| Backoff schedule | Exponential: 1m, 5m, 30m, 2h, 8h, 24h, 48h |
| Timeout per attempt | 10 seconds |
| Signature | HMAC-SHA256 via `X-KOB-Signature` header |
| Dead letter | Failed events retained for 30 days; manual replay available via API |

### Webhook Signature & Replay Headers (canonical)

All outbound webhook deliveries include the following headers. Header names are case-insensitive per RFC 7230 §3.2. Aliases are accepted by verification middleware for backward compatibility but new integrations MUST use the canonical names below.

| Canonical Header | Purpose | Accepted Aliases |
|---|---|---|
| `X-KOB-Signature` | HMAC-SHA256 hex digest of the raw request body using the endpoint secret. Format: `v1=<hex>` (signature versioning per Stripe convention). | `X-Kang-Signature`, `X-Webhook-Signature` |
| `X-Webhook-ID` | Unique event identifier (UUID v4). Receivers MUST deduplicate on this value within a 24-hour window. | `Kang-Webhook-ID` |
| `X-Webhook-Timestamp` | RFC 3339 / ISO 8601 timestamp of event emission. Receivers SHOULD reject events older than 5 minutes (replay protection). | — |
| `X-Webhook-Event` | Event type (e.g. `payment.completed`). Mirrors the `type` field in the body. | — |
| `X-Webhook-Attempt` | 1-based delivery attempt counter (1–7). Useful for receiver-side retry telemetry. | — |


## HTTP Caching

GET endpoints return `Cache-Control`, `ETag`, and (where applicable) `Last-Modified` headers. Use conditional requests (`If-None-Match`, `If-Modified-Since`) to reduce bandwidth and respect rate limits. Mutable resources (balances, transactions) use `no-cache`; semi-static resources (bank directory, exchange rates) use `max-age=300`.


## Rate Limits

All production endpoints are rate-limited per `client_id`. Sandbox limits are applied per `client_id` at a reduced threshold.

| Endpoint Group | Limit (Production) | Limit (Sandbox) |
|---|---|---|
| All authenticated endpoints | 300 req/min | 120 req/min |
| Payment initiation (POST /payments*) | 60 req/min | 30 req/min |
| OAuth /token endpoint | 30 req/min per IP | 30 req/min |
| Webhook replay | 10 req/min | 10 req/min |

### Rate Limit Response Headers

Every response includes the following headers:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix epoch timestamp when the window resets |
| `Retry-After` | Seconds to wait before retrying (present on 429 only) |

When the rate limit is exceeded, the API returns HTTP 429 with `Content-Type: application/problem+json` and a `Retry-After` header.

## Service Level Agreement (SLA)

| Environment | Uptime SLA | Response Time (p95) | Support Response |
|---|---|---|---|
| Production | 99.9%/mo | < 500ms | P1: 30 min |
| Sandbox | 99.5%/mo | < 1000ms | Best effort |

Planned maintenance windows are announced at least 72 hours in advance via the status page and registered developer email addresses. Current API status: https://status.kangopenbanking.com
 | v4.17.0 (2026-04-24): Spec correctness pass. (a) Added string-typed monetary siblings to VirtualCard (balance, currency) and LoanScheduleItem (principal_amount, interest_amount, fees_amount, total_due_amount); deprecated original number-typed fields per RFC 8259 / FAPI 1.0 Adv §5.2.2. (b) Added reusable Unauthorized and Forbidden response components (RFC 6750 §3.1, RFC 7235) returning application/problem+json. (c) Introduced TransactionOBIE schema for OBIE Read/Write Data API v3.1 consumers; existing PascalCase aliases on Transaction marked deprecated with x-replacement pointers. Zero breaking changes — Standing Order 1 (The Lock) preserved; all original field names retained. | v4.29.0 (2026-05-03): Audit remediation. P1: PISP submission body expanded per OBIE R/W 4.0 §5.4 (instructed_amount, creditor_account, risk); 12 past-sunset endpoints marked x-retired with HTTP 410 + Sunset/Link headers per RFC 8594. P2: monetary fields coerced number→string per FAPI 1.0 Adv §5.2.2 (8 fields); webhook signature header canonical=X-KOB-Signature with X-Webhook-Signature alias; Webhook v1 endpoints deprecated, successor=/v1/webhooks/v2/endpoints (sunset 2026-12-31); 2144 application/problem+json references corrected to ProblemDetails (RFC 7807); rate-limit window_unit=per_minute declared. P3: 45 ops gained default 5XX response; SDK ecosystem unified (Java, Go added to x-sdks); currency required on interbank payment creation per ISO 20022 pacs.008; AISP list endpoints flagged x-pagination-style=cursor. Standing Orders 1, 2, 3, 6 honored — zero renames, zero removals, all changes additive. | v4.32.0 (2026-05-08): Virtual Card Issuing v2 release. Added /v1/issuing/* surface backed by Kora middleware: cardholders, cards, fund/withdraw, freeze/unfreeze/terminate, transactions, and PCI-safe reveal (step-up MFA). New tag Standards-PCI-DSS. New error codes: card_kyc_required, card_insufficient_funds, card_provider_unavailable, card_terminated, mfa_required, card_validation_failed, card_not_found. Webhook events: card.issued, card.charged, card.refunded, card.declined, card.terminated. Additive only — Standing Orders 1, 2, 4, 5, 6 preserved.
```
