# Wave 5.1 — Operational Closeout (2026-04-17)

## P0 fixes verified
- `bank_side_transactions`, `bank_side_balances`, `bank_retry_queue`, `bank_profile_presets` all exist in production (migration was already applied).
- `bank_profile_presets` confirmed seeded with 12 CEMAC banks.
- Cron jobs **scheduled**:
  - `bank-data-poller-5min` — `*/5 * * * *`
  - `bank-retry-worker-2min` — `*/2 * * * *`

## P1 — Consent gap closed
Two new edge functions, both additive:

| Endpoint | Method | Purpose |
|---|---|---|
| `consent-status` | GET / POST | Unified poll of AISP/PISP/CBPII consent state, expiration, and last 10 events |
| `consent-extend` | POST | Renew an Authorised consent up to 90 days; logs `extended` event |

Both verify `auth.getUser()`, scope by `user_id`, and write to `consent_events`.

## Standing Orders compliance
- Order 1 (Lock): no renames, only additive endpoints
- Order 4 (Surgeon): two new functions added, zero existing changed
- Order 6 (Version Gate): minor bump v4.16.0 → **v4.17.0** (new endpoints)
- Order P5 (Working Code): both functions return JSON contracts ready for sandbox smoke tests

## Out-of-scope (deferred)
- Schema harmonization between `bank_sourced_*` and `bank_side_*` tables (P2)
- OpenAPI publication of `/v1/consent-status` and `/v1/consent-extend` paths
- End-to-end onboarding of one real sandbox bank (P3)
