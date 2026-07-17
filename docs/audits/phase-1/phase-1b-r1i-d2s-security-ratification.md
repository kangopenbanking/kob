# Phase 1B — R1I-d.2S — Security Ratification

## 1. Per-sub-slice security decision matrix

| Sub-slice | Scope inputs approved | Cursor scope binding approved | Leakage risk (position/payload) | Security decision |
|-----------|-----------------------|-------------------------------|---------------------------------|-------------------|
| R1I-d.2A | env, merchant_id, actor.sub | YES — sh binds merchant + actor + env | 0 raw IDs; position = `[created_at, id(UUID)]` | APPROVED |
| R1I-d.2B | env, merchant_id, actor.sub | YES | idem | APPROVED |
| R1I-d.2C | env, merchant_id, actor.sub | YES | idem | APPROVED |
| R1I-d.2D | env, merchant_id, actor.sub | YES; `status` bound via `fh` | idem | APPROVED |
| R1I-d.2E | env, merchant_id, actor.sub | YES; `chargeId` (events) bound via `sh` | idem; charge_id is per-actor-authorized parent, hashed | APPROVED |
| R1I-d.2F | env, merchant_id, customer_id, actor.sub | YES; unbounded query eliminated | idem; provider token remains provider-only, never surfaced to client (payouts DB branch only in d.2) | APPROVED (with d.8 deferred for provider branch) |

## 2. Cross-scope reuse verification (inherited from d.1F codec)

- Cross-operation cursor reuse → `OPERATION_MISMATCH` (400) — verified in `pagination-foundation.test.ts`.
- Cross-tenant cursor reuse → `SCOPE_MISMATCH` (400).
- Cross-owner cursor reuse → `SCOPE_MISMATCH` (400).
- Changed-filter cursor reuse → `FILTER_MISMATCH` (400).
- Expired cursor → `EXPIRED` (400).
- Malformed cursor → `MALFORMED` / `INVALID_SIGNATURE` (400).

## 3. Enumeration & DoS assessment

| Sub-slice | Max rows per request | Unbounded exposure closed | Exact-count DoS closed |
|-----------|----------------------|---------------------------|------------------------|
| d.2A | 101 (limit+1) | n/a | n/a (medium volume) |
| d.2B | 101 | n/a | n/a |
| d.2C | 101 | n/a | approved to retain (medium volume) |
| d.2D | 101 | n/a | n/a |
| d.2E | 101 (200+1 for events) | n/a | **YES** — `total` dropped |
| d.2F | 101 | **YES** — customer_tokens bounded | **YES** — payouts DB branch drops `total` |

## 4. Internal identifier exposure

Position tuple = `[created_at (ISO-8601 string), id (UUID)]`. UUIDs are non-enumerable public identifiers already carried in item responses; no additional exposure.

## 5. Provider-token handling

- `gatewayListPayouts` provider branch is **untouched** in d.2F; existing behaviour (provider token consumed server-side, never returned) is preserved.
- Provider adapter (opaque wrap) authorisation is R1I-d.8. d.2F must not emit a provider token in any cursor payload or response.

## 6. Compliance/Data-Protection assessment

- Cursor payload contains no PII.
- Cursor payload contains no financial value.
- Position tuple exposes only immutable creation timestamp + UUID.
- Filter hash is one-way (SHA-256) — filter values are not reconstructible from the token.
- Scope hash is one-way (SHA-256) — merchant_id / actor.sub are not reconstructible from the token.

## 7. Security decision

**All six sub-slices APPROVED** subject to the ratified codec (d.1F) and the count-policy change on high-volume tables (d.2E, d.2F payouts).
