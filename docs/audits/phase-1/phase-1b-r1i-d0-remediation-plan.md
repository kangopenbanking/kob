# Phase 1B — R1I-d.0 — Remediation Plan (Slice Sequence)

**Rule:** narrow, reviewable slices. No slice below is authorised yet — this is the sequencing proposal only.

## 1. Slice map

| Slice | Domain / trigger | Operations | Contract | Runtime | Database | Risk |
|-------|------------------|------------|----------|---------|----------|------|
| **R1I-d.1** (recommended first) | Shared cursor & ordering foundation | 0 API changes; introduces `supabase/functions/_shared/pagination.ts` + HMAC cursor codec + `x-pagination-conformance` self-test | none (contract stays) | additive helper module | none | Low |
| R1I-d.2 | Gateway high-volume list ordering fix | `gatewayListCharges`, `gatewayListRefunds`, `gatewayListPayouts`, `gatewayListDisputes`, `gatewayListSettlements`, `gatewayListSubscriptions`, `gatewayListCustomers`, `gatewayListCustomerTokens`, `gatewayListPaymentLinks`, `gatewayListPaymentPlans`, `gatewayListSubaccounts`, `gatewayListBeneficiaries`, `gatewayGetChargeEvents`, `gatewayListReconciliationRuns`, `gatewayListFundingIntents`, `gatewayListVirtualAccounts` | Per-op `X-Pagination-*` header docs | Add `id` tie-breaker, adopt shared codec | Verify existing indexes, likely add composite indexes | Medium |
| R1I-d.3 | Webhook delivery listings | `webhookDeliveries`, `webhookV2Deliveries`, `webhookList`, `webhookV2List`, `listWebhookDlq` | Envelope for DLQ; header docs | Ordering + shared codec | Composite indexes | Medium |
| R1I-d.4 | Admin cross-tenant lists (DoS-facing) | `adminTransactionReview`, `adminListLoans`, `adminListSavings`, `adminListConsents`, `adminWebhooks`, `adminSandboxAccounts`, `adminManageBranches`, `listWithdrawalPolicies`, `listStaffAuthorizations` | Header docs | Ordering + shared codec + scoped count | Composite indexes; consider partial | HIGH |
| R1I-d.5 | Ledger / statement / interbank high-volume | `journalList`, `walletStatement`, `interbankPaymentsList`, `interbankMessagesList`, `bankPaymentsList`, `virtualCardTransactions`, `agentTransactionList` | Envelope for `agentTransactionList` | Same + count policy | Composite indexes | HIGH |
| R1I-d.6 | Bounded exemption ratification | `banksList`, `payoutRails`, `cemacCorridorsList`, `ledgerAccounts`, `savingsProducts`, `loanProducts`, `creditScoreTips`, `merchantsQrDirectoryList`, `sandboxScenarioList`, `interbankParticipantsList`, `agentList`, `loanSchedule`, `aispBalances` | Add `x-bounded-collection` extension per op | Enforce cap in handler | none | Low |
| R1I-d.7 | Cursor signing rollout | all cursor-using ops from d.1 onward | none | swap in HMAC codec; add rotation | secret storage decision | Medium |
| R1I-d.8 | Provider adapter wrap (Nium etc.) | `gatewayListPayouts` (provider branch), any bank connector list falling through to provider | none | Provider token opaque wrap | none | Medium |
| R1I-d.9 | Reports vs streams decision | `gatewayReportTransactions`, `gatewayReportSettlements`, `safeguardingSnapshots` | Possibly reclassify as `x-stream: export` | Rewrite in-memory slice | Range indexes | HIGH |

## 2. Slice acceptance criteria (per slice)

- Contract change (if any) passes existing G4 + adds a per-op assertion.
- Runtime change carries per-handler unit tests for: default limit, max-limit clamp, malformed cursor 400, cross-scope cursor 400, duplicate-avoidance under concurrent insert (test uses `pg_advisory_lock` seeding).
- Database change ships as a `pending-migration` with apply / rollback / reapply parity.
- Full quality-gate total unchanged unless the slice explicitly ratchets a gate.

## 3. Recommended first slice

**R1I-d.1 — Shared cursor codec & ordering foundation.**
- Zero contract mutation.
- Zero database migration.
- Adds `_shared/pagination.ts` with:
  - `encodeCursor(scope, position)` / `decodeCursor(scope, token)` (HMAC placeholder using existing env secret).
  - `applyKeyset(query, { orderBy, tieBreaker, cursor, limit })`.
  - `paginationHeaders({ mode, hasMore, nextCursor, limit })`.
- Adds a Vitest suite that reference-implements the AISP reference handlers on top of the helper (proving parity, no behavioural drift).
- Does not touch any of the 77 operations yet.

## 4. Explicit non-goals of d.1

- No contract change.
- No handler rewiring.
- No index migration.
- No new cursor secret. The HMAC key placeholder is derived from an existing environment secret; rotation is deferred to d.7.

## 5. R1I-d.1 authorisation request

Await Guardian ratification of:
1. The proposed shared helper's module path (`supabase/functions/_shared/pagination.ts`).
2. Adoption of `X-Pagination-*` headers on all subsequent slices (§7 of the Standard Proposal).
3. HMAC cursor placeholder using existing env secret (`SUPABASE_JWT_SECRET` or a dedicated new secret — decision needed).

**R1I-d.1 is NOT authorised by R1I-d.0.** Any implementation before ratification violates authorisation policy.
