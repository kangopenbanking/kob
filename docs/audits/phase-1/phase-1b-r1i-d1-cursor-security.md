# Phase 1B-R1I-d.1F — Cursor Security

## Threat model addressed

| Threat | Mitigation |
|--------|------------|
| Client forges a cursor | HMAC-SHA-256 signature over the entire versioned payload; forged tokens fail `INVALID_SIGNATURE`. |
| Client mutates the payload | Signature covers `signing_input = "kobp1." + payload_b64`; any payload byte change invalidates verification. |
| Client swaps a valid cursor onto a different operation | `op` field is bound; mismatch → `OPERATION_MISMATCH`. |
| Client swaps a valid cursor onto a different tenant / user / account | `sh` field is bound; mismatch → `SCOPE_MISMATCH`. |
| Client keeps a cursor after changing filters (would return wrong rows) | `fh` field is bound; mismatch → `FILTER_MISMATCH`. |
| Client reuses a cursor from an incompatible ordering profile | `ord` field is bound; mismatch → `ORDER_MISMATCH`. |
| Client replays a stale cursor after data lifecycle changes | `exp` enforces bounded lifetime (60 s ≤ ttl ≤ 86 400 s); mismatch → `EXPIRED`. |
| Payload leaks raw tenant / user / account / credential values | Scope IDs are represented only via `sh` (SHA-256 hex); prohibited-key guard rejects `password / token / secret / …` inputs to hash functions. |
| Signature comparison is timing-attackable | Uses `SubtleCrypto.verify` which is constant-time. |
| Secret is weak, missing, or reused | Loader fails closed when secret is absent or shorter than 32 bytes; `KOB_CURSOR_HMAC_SECRET` is dedicated (never `SUPABASE_JWT_SECRET`). |
| Errors leak signature or secret material | Failure `detail` strings carry only category-level text; secret value is never included; tests assert absence. |

## Explicit non-guarantees

- **Not confidentiality.** The payload is base64url-encoded, not encrypted. `pos` values MUST already be public response fields of the corresponding collection item — this is enforced socially (per-slice review) and by the "position values contain no field prohibited by the test fixture" invariant. Operation slices are responsible for this restriction.
- **Not replay-proof within TTL.** A stolen cursor remains valid within its expiry. Rotation and revocation are deferred to d.7.
- **Not database-order-safe on its own.** The cursor binds the ordering profile ID, but the actual `ORDER BY … , id` SQL is per-slice.

## Cryptography

- Web Crypto API only (`globalThis.crypto.subtle`).
- HMAC-SHA-256.
- No Node-only crypto import (`node:crypto` intentionally avoided so the same module works in Supabase Edge Functions).
- No external cryptography dependency added.

## Secret governance

- Environment variable: `KOB_CURSOR_HMAC_SECRET`.
- Never reused from `SUPABASE_JWT_SECRET`.
- Minimum 32 bytes of entropy.
- Injected in tests via the `{ secret }` option — no live secret needed.
- Production provisioning and rotation are explicitly deferred to d.7.
