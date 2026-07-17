# Phase 1B — R1I-d.2B — Scope Reconciliation (read-only)

**Purpose:** Reconcile the four candidate resources named informally in the d.2A implementation note (`charges`, `refunds`, `payouts`, `charge-events`) against the ratified six-slice programme in `phase-1b-r1i-d2s-operation-groups.md` §2.

## 1. Ratified d.2B assignment (source of truth)

Per `phase-1b-r1i-d2s-operation-groups.md` §2, R1I-d.2B contains **exactly three operations**:

| # | operationId | Method | Public path | Table |
|---|-------------|--------|-------------|-------|
| 1 | gatewayListCustomers | GET | /v1/gateway/customers | gateway_customers |
| 2 | gatewayListPaymentPlans | GET | /v1/gateway/payment-plans | gateway_payment_plans |
| 3 | gatewayListSubscriptions | GET | /v1/gateway/subscriptions | gateway_subscriptions |

## 2. Candidate-vs-assignment matrix

| Candidate operation | Assigned slice in d.2S | Eligible for d.2B |
|---------------------|------------------------|-------------------|
| gatewayListCharges | **R1I-d.2E** (high-volume, count-drop) | No |
| gatewayListRefunds | **R1I-d.2E** (high-volume, count-drop) | No |
| gatewayGetChargeEvents | **R1I-d.2E** (high-volume child) | No |
| gatewayListPayouts | **R1I-d.2F** (provider branch, atypical) | No |

The informal "four possible d.2B resources" listed in the d.2A implementation report were not ratified d.2B members. They belong to d.2E and d.2F. The ratified assignment is **not altered** by this reconciliation.

## 3. Six-slice consistency check

| Slice | Ratified ops | Verified |
|-------|-------------:|:--------:|
| d.2A | 4 | ✓ |
| d.2B | 3 | ✓ |
| d.2C | 3 | ✓ |
| d.2D | 1 | ✓ |
| d.2E | 3 | ✓ |
| d.2F | 2 | ✓ |
| **Total** | **16** | ✓ |

No slice claims four operations for d.2B; the six-slice operation-count ratification is internally consistent. The BLOCK gate `PHASE 1B-R1I-d.2B BLOCKED — SIX-SLICE OPERATION-COUNT RATIFICATION INCONSISTENT` does **not** apply.

## 4. Outcome

- Ratified d.2B operation IDs: `gatewayListCustomers`, `gatewayListPaymentPlans`, `gatewayListSubscriptions`.
- No d.2B implementation performed in this slice (prohibition honoured).
- Reconciliation recorded; no changes to the ratified programme.
