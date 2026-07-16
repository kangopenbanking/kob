# Phase 1B — Infrastructure Decision Record

## Existing components reused
| Component | Location | Reuse decision |
|---|---|---|
| `IdempotencyKey` header parameter (required=true) | `components.parameters.IdempotencyKey` | Retained unchanged for endpoints already requiring it (e.g. the four agent float endpoints). Not applied to new Phase 1B additions because §6.1 requires backward-compatible optional headers on existing v1 operations. |
| `IdempotencyKeyHeader` header parameter (required=false) | `components.parameters.IdempotencyKeyHeader` — **new** | Added as the canonical optional variant for Phase 1B. Same UUID v4 schema / 255-char ceiling / pattern as the required version. |
| `CursorParam`, `StartingAfter`, `EndingBefore`, `LimitParam`, `PageParam` | `components.parameters.*` | Reused for the three G4 collection endpoints. No competing pagination design introduced. |
| `PaginatedResponse`, `Pagination` schemas | `components.schemas.*` | Available. Not swapped into affected G4 responses this phase to preserve legacy client compatibility (see §10.3 — plain-array/envelope responses preserved; cursor is exposed additively via query params and response-header conventions). |
| `AgentTransactionResponse` schema — **new** | `components.schemas.AgentTransactionResponse` | Named response schema shared by the four G1 agent operations. |
| Shared runtime helper `supabase/functions/_shared/integration-layer/idempotency.ts` | Existing hardened helper covering `reserveIdempotency`, request-fingerprint hashing, `X-Idempotent-Replay`, in-flight reservation, and RFC-7807 error emission (`IDEMPOTENCY_KEY_INVALID` / `IDEMPOTENCY_KEY_REUSED` / `IDEMPOTENCY_KEY_IN_FLIGHT`). | **Reused as-is.** No competing framework introduced. |
| Idempotency storage table | Already provisioned in `_shared/integration-layer/idempotency.ts` (per prior Phase 5a work — 5 outcomes: miss / replay / conflict / in-flight / invalid). | **Reused as-is.** No new migration required for Phase 1B. |
| Structured logger | `supabase/functions/_shared/kob-logger.ts` (Batch 8). | Reused. |
| Quality-gate harness | `src/test/openapi-quality-gates.test.ts` (Phase 1A). | Reused. |

## Components rejected
| Component | Reason |
|---|---|
| New database table | The hardened idempotency helper already writes to the canonical idempotency store — creating a second table would violate Standing Order #4 (Surgeon Rule) and split the audit trail. |
| Second pagination convention (offset-only) | Would immediately regress G8. |
| Swapping affected list responses to `PaginatedResponse` envelope | §10.2/10.3 — legacy compatibility for clients that omit pagination parameters. Deferred beyond Phase 1B. |
| Making `Idempotency-Key` mandatory on existing v1 operations | §6.1 forbids it in this phase. |

## Database impact
None. No new migrations executed against production. The existing idempotency table (`integration-layer/idempotency`) is used unchanged.

## Client impact
- Existing consumers that omit `Idempotency-Key` continue to receive prior behaviour.
- Consumers may opt in by sending a UUID v4 in the header — replay, conflict, and in-flight semantics are enforced by the shared helper.
- Existing consumers of the three G4 list endpoints see no shape change when they omit `limit` / `cursor` / `starting_after` / `ending_before`.

## Rollback approach
1. Revert `public/openapi.json` and `public/openapi.yaml` to commit `f875be25a75e8d3f6cc79f3a9b697ec846bccbee`.
2. Revert `src/config/version.ts` (`4.53.1 → 4.53.0`).
3. Remove the changelog entry for `4.53.1` from `public/changelog.json`.
4. Regenerate downstream artifacts: `npm run version:sync`.
5. No database change to reverse. No handler code path changes (existing shared idempotency helper stays wired).
