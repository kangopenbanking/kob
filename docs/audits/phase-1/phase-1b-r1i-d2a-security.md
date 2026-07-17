# Phase 1B — R1I-d.2A-DB1 — Security (Delta from R1I-d.2A)

The cursor binding matrix, cross-scope rejection matrix, DoS controls, secret
handling and error hygiene ratified in the original
`phase-1b-r1i-d2a-security.md` are unchanged by R1I-d.2A-DB1. This slice does
not modify:

- `supabase/functions/_shared/pagination.ts` (cursor codec)
- `supabase/functions/gateway-query/_pagination.ts` (d.2A adapter)
- `supabase/functions/gateway-query/index.ts` (route branches)

## Deltas introduced by R1I-d.2A-DB1

| Area | Change | Security impact |
|---|---|---|
| Canonical migration hardening | Adds `pg_temp.d2a_ensure_index` verifying exact definition + `indisvalid` + `indisready` | Prevents silent acceptance of a same-named but attacker-substituted index (fails closed inside the transaction). |
| Online CONCURRENTLY operation | Moved out of `pending-migrations/` into `pending-operations/` (inert to migration runner) | Removes risk of transactional runner attempting a forbidden statement in production. |
| Harness environment guard | Refuses non-local hosts and port 6543 | Prevents accidental execution against production or transaction pooler. |
| Secret exposure | None (harness reads `D2A_HARNESS_PGURL` only, does not log it) | Preserved. |

## Failure mapping (§15) — unchanged

Foundation cursor failures continue to map to canonical client `400` per the
d.2A adapter. Missing or weak `KOB_CURSOR_HMAC_SECRET` continues to map to a
canonical internal configuration failure (`500`), never a `400` client leak.

No secret names, signatures, hashes, internal SQL, table names, or merchant /
tenant identifiers are exposed in error bodies or logs by the new harness or
migration.
