# Phase 1B — R1I-d.2P — Decision-Integrity Matrix

**Legend:** `EXISTING_RATIFIED` (spec/foundation already carries it), `RATIFIED_BY_R1I_D0` (d.0 remediation plan or Standard Proposal explicitly ratified), `RATIFIED_BY_R1I_D1` (d.1F ratification), `PROPOSED_NOT_RATIFIED` (Standard Proposal, awaiting Guardian ratification), `UNKNOWN`.

## 1. Universal decisions (apply to all 16 d.2 operations)

| Decision | Value | Classification | Evidence |
|----------|-------|----------------|----------|
| Pagination model | Cursor (keyset) with legacy offset retained on Family B | `PROPOSED_NOT_RATIFIED` for cursor-primary; offset retention is existing | d.0 Standard Proposal §3; d.1F §11 "no universal envelope, no headers" — deferred |
| Cursor token format `kobp1.<payload>.<sig>` | HMAC-SHA-256 | `RATIFIED_BY_R1I_D1` | `phase-1b-r1i-d1-standard-ratification.md` #1–3 |
| Cursor payload fields `v/op/sh/fh/ord/pos/iat/exp` | required | `RATIFIED_BY_R1I_D1` | ibid. #4 |
| Absolute safety ceiling | 500 | `RATIFIED_BY_R1I_D1` | ibid. #9 |
| Cursor lifetime (min/max window) | 60 / 86 400 s | `RATIFIED_BY_R1I_D1` | `phase-1b-r1i-d1-foundation-design.md` |
| Ordering must terminate with unique tie-breaker | mandatory | `RATIFIED_BY_R1I_D1` | ratification #6 |
| Null-ordering must be declared per field | mandatory | `RATIFIED_BY_R1I_D1` | ratification #7 |
| Limit-plus-one page finalisation, no cursor on final/empty page | mandatory | `RATIFIED_BY_R1I_D1` | ratification #10 |
| Canonical JSON hashing for scope/filters | mandatory | `RATIFIED_BY_R1I_D1` | ratification #5 |
| Per-operation `defaultLimit` | **not set** | `PROPOSED_NOT_RATIFIED` | ratification #9 defers to per-slice decision |
| Per-operation `maxLimit` | **not set** | `PROPOSED_NOT_RATIFIED` | ibid. |
| Universal `X-Pagination-*` response headers | proposed | `PROPOSED_NOT_RATIFIED` | Standard Proposal §7; d.1F #11 "no universal headers in this slice" |
| Count semantics — `total` forbidden on high-volume gateway tables | proposed | `PROPOSED_NOT_RATIFIED` | Standard Proposal §6 |
| `has_more` mandatory in envelope | proposed | `PROPOSED_NOT_RATIFIED` | Standard Proposal §6 |
| `next_cursor` mandatory in envelope | proposed | `PROPOSED_NOT_RATIFIED` | Standard Proposal §6 |
| Backward pagination (`previous_cursor`) | deferred | `PROPOSED_NOT_RATIFIED` | d.1F "Deferred" list |
| Cursor scope binding = `env + tenant/merchant + actor + parent resource` | proposed | `PROPOSED_NOT_RATIFIED` | Standard Proposal §5 |
| Cursor filter binding = `filters_hash` mandatory | ratified by codec, per-op inputs not yet chosen | `RATIFIED_BY_R1I_D1` (mechanism); `PROPOSED_NOT_RATIFIED` (per-op input set) | ratification #4/5 |
| Invalid-input response envelope (Problem Details) | ratified | `EXISTING_RATIFIED` | Phase 1B-R1I-c.3A response contract |
| Ordering-profile registry location | to be decided | `UNKNOWN` | not addressed by d.0 or d.1F |
| Rotation policy for `KOB_CURSOR_HMAC_SECRET` | deferred to d.7 | `PROPOSED_NOT_RATIFIED` | d.0 remediation plan §1 (R1I-d.7) |

## 2. Per-operation defaults (all `PROPOSED_NOT_RATIFIED`)

| operationId | Proposed `defaultLimit` | Proposed `maxLimit` | Current handler default/max | Classification |
|-------------|--------------------------|----------------------|-----------------------------|----------------|
| gatewayListCharges | 25 | 100 | 50 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListRefunds | 25 | 100 | 50 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListPayouts | 25 | 100 | 50 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListDisputes | 25 | 100 | 50 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListSettlements | 25 | 100 | 50 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListSubscriptions | 25 | 100 | 20 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListCustomers | 25 | 100 | 20 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListCustomerTokens | 25 | 100 | (unbounded — no offset/limit) | `PROPOSED_NOT_RATIFIED` |
| gatewayListPaymentLinks | 25 | 100 | 20 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListPaymentPlans | 25 | 100 | 20 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListSubaccounts | 25 | 100 | 20 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListBeneficiaries | 25 | 100 | 20 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayGetChargeEvents | 25 | 100 | 50 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListReconciliationRuns | 25 | 100 | 25 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListFundingIntents | 25 | 100 | 50 / 100 | `PROPOSED_NOT_RATIFIED` |
| gatewayListVirtualAccounts | 25 | 100 | 50 / 100 | `PROPOSED_NOT_RATIFIED` |

## 3. Material unresolved decisions

Twelve decisions above are `PROPOSED_NOT_RATIFIED` and are individually material to a safe d.2 implementation. In particular:

1. Per-operation `defaultLimit` / `maxLimit`.
2. Count-semantics change on high-volume gateway tables (`total` forbidden).
3. Universal `X-Pagination-*` response header contract.
4. Cursor scope-binding input set (merchant vs. actor vs. environment).
5. Ordering-profile registry location.

**Gate:** because every one of those decisions bears directly on the public contract of the 16 operations, d.2P cannot advance to authorised implementation.

**Blocking gate:** `PHASE 1B-R1I-d.2 BLOCKED — PAGINATION PRODUCT OR CONTRACT DECISION REQUIRED`.
