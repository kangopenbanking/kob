# PHASE 1B-R1I-c.0A — Budgeting Deletion Role-Ratification Package

**Status:** RATIFIED — ALL SIX ROLES APPROVED WITH CONDITIONS
**Authorization:** DESIGN + LOCAL/TEST MIGRATION PREPARATION ONLY. Runtime implementation, contract modification, production database migration and production action remain NOT AUTHORIZED pending a new Chief Architect authorization to open R1I-c.1.
**API version:** 4.53.1 (Unreleased) — unchanged
**Operation count:** 484 — unchanged (reduction to 483 pre-approved for R1I-c.4 execution, not applied here)
**Production gate total:** 187 — unchanged


## 1. Purpose

This package records the decisions that must be approved before implementation of the five budgeting DELETE operations may begin.

No approval is implied by repository documentation alone. A single person may approve more than one role only when they explicitly confirm that they hold, or have been delegated, each named role.

## 2. Chief Architect recommendation

### 2.1 `budgetingDeleteBudget`

- **Operation:** `DELETE /v1/budgeting/budgets/{budgetId}`
- **Recommended disposition:** RETAIN — CHANGE SEMANTICS BEFORE RELEASE
- **Recommended mutation:** ARCHIVE / SOFT_DELETE
- **Hard deletion:** PROHIBITED
- **Financial-history deletion:** PROHIBITED

Behaviour:

- Preserve budget record for historical reporting.
- Preserve prior budget periods, allocations, analytics and audit history.
- Prevent archived budget from accepting new allocations or active-period changes.
- Existing transaction and category associations remain intact.
- Repeated deletion / archival is idempotent.
- No transaction, ledger record or historical allocation is cascade-deleted.

Additive fields: `status`, `archived_at`, `archived_by`.

Existing documented response semantics should be preserved where compatible. Any response change requires API Product Owner approval.

### 2.2 `budgetingDeleteCategory`

- **Operation:** `DELETE /v1/budgeting/categories/{categoryId}`
- **Recommended disposition:** RETAIN — CHANGE SEMANTICS BEFORE RELEASE
- **Recommended mutation:** SOFT_DELETE
- **System categories:** PROTECTED — CANNOT BE DELETED
- **Hard deletion:** PROHIBITED WHEN REFERENCED

Behaviour:

- Only user-created categories may be removed.
- Protected/system categories cannot be removed.
- Historical transaction assignments remain unchanged.
- Deleted categories cannot receive new transactions, rules or budget allocations.
- Existing transaction history continues to display the historical category.
- Active rules referencing the category must be disabled, reassigned or rejected.
- Active budgets referencing the category must not be silently corrupted.
- No transaction record is cascade-deleted.

Additive fields: `is_system`, `deleted_at`, `deleted_by`, `status`.

Dependency rule: if actively referenced, REJECT_WITH_CONFLICT unless an explicit reassignment workflow is supplied.

### 2.3 `budgetingDeleteRule`

- **Operation:** `DELETE /v1/budgeting/categories/rules/{ruleId}`
- **Current backing resource:** NONE
- **Current table:** NONE
- **Recommended disposition:** REMOVE OR DEFER FROM 4.53.1

**Chief Architect recommendation:** OPTION C — REMOVE THE OPERATION FROM THE UNRELEASED CONTRACT.

Reasons:

- No database table backs the resource.
- No runtime handler exists.
- No approved rule-domain lifecycle exists.
- Implementing it would require designing a new budgeting-rules subsystem, not merely adding a DELETE handler.
- Leaving it documented would falsely advertise functionality.

Consequences of approval:

- Remove the operation from the unreleased OpenAPI contract.
- Recalculate operation count from 484 to 483.
- Recalculate production gate baselines.
- Update changelog, developer documentation, SDK-generation inputs and Postman-generation inputs.
- Keep version 4.53.1 Unreleased unless release governance requires otherwise.
- Do not publish regenerated assets during Phase 1B.

Alternative: DEFER REMOVAL AND BUILD A CATEGORY-RULES DOMAIN — requires separate product specification, table design, RLS model, rule evaluator and implementation programme. Not recommended inside R1I-c.

### 2.4 `budgetingDeleteGoal`

- **Operation:** `DELETE /v1/budgeting/goals/{goalId}`
- **Recommended disposition:** RETAIN — CHANGE SEMANTICS BEFORE RELEASE
- **Recommended mutation:** ARCHIVE / STATUS_TRANSITION
- **Hard deletion:** PROHIBITED

Behaviour:

- Preserve the goal and its historical progress.
- Preserve all contributions, roundup transactions, events and audit history.
- Disable future contributions and roundups.
- Prevent archival while an associated transfer, settlement or contribution is pending.
- Do not delete completed, failed or pending financial records.
- Existing reporting remains available.
- Repeated archival is idempotent.

Additive fields: `status`, `archived_at`, `archived_by`.

Candidate states: `active`, `paused`, `completed`, `archived`. The Budgeting Domain Owner must approve the exact state model.

### 2.5 `budgetingDisableRoundUp`

- **Operation:** `DELETE /v1/budgeting/goals/{goalId}/round-up`
- **Recommended disposition:** RETAIN — DOCUMENT AS A DISABLE ACTION
- **Recommended mutation:** DISABLE_FLAG
- **Hard deletion:** PROHIBITED

Behaviour:

- Set the current roundup configuration to disabled.
- Preserve the configuration record.
- Preserve all previous roundup transactions and events.
- Stop creation of new roundup instructions.
- Define how already-pending roundup instructions are handled.
- Record who disabled the feature and when.
- Repeated disable requests are idempotent.
- Re-enablement must use a separate authorised update or enable flow.

Additive fields where absent: `enabled`, `disabled_at`, `disabled_by`, `updated_at`.

## 3. Financial safety decisions

The following records are classified NEVER_DELETE:

- `roundup_transactions`
- `roundup_events`
- completed goal contributions
- ledger entries
- payment or settlement records
- reconciliation records
- regulatory audit records
- immutable financial-event records

Permitted operations are limited to preserving, correcting through authorised compensating records, status transitions, and legally approved retention expiry processes.

No budgeting DELETE handler may directly or indirectly cascade-delete these records.

## 4. Cascade-policy recommendation

| Parent resource | Dependent resource | Recommended policy |
|---|---|---|
| Budget | Historical allocations | Preserve |
| Budget | Reporting records | Preserve |
| Budget | Future scheduled actions | Cancel future only |
| Category | Historical transaction assignments | Preserve |
| Category | New transaction assignment | Block |
| Category | Active category rules | Disable, reassign or reject deletion |
| Category | Active budget references | Reject unless reassigned |
| Goal | Contributions | Never delete |
| Goal | Roundup transactions | Never delete |
| Goal | Roundup events | Never delete |
| Goal | Roundup configuration | Disable |
| Goal | Pending financial operations | Reject archival until resolved |
| Roundup configuration | Historical transactions | Preserve |
| Roundup configuration | Pending instructions | Follow approved cancellation/settlement policy |

No `ON DELETE CASCADE` should be introduced for financial or historical records.

## 5. Idempotency-retention recommendation

The generic idempotency retention period may remain 24 hours only where the underlying resource remains available through SOFT_DELETE / ARCHIVE / DISABLE_FLAG / STATUS_TRANSITION.

Because the recommended models preserve the row or a durable state, replay security does not depend exclusively on the generic idempotency record.

For any future hard-delete operation:

- a 24-hour generic record is not sufficient by itself;
- a durable tombstone or immutable deletion audit record is required;
- replay authorization must remain tenant and actor scoped;
- expiry must not permit an unauthorised or duplicate destructive action.

| Operation | Persistent row retained | Generic 24h record sufficient |
|---|---|---|
| Budget archive | Yes | Yes, with persistent archived state |
| Category soft delete | Yes | Yes, with persistent deleted state |
| Goal archive | Yes | Yes, with persistent archived state |
| Roundup disable | Yes | Yes, with persistent disabled state |

## 6. Ownership and authorization recommendation

Every retained operation must require:

- authenticated actor
- authoritative environment
- authoritative tenant or institution
- resource ownership or delegated permission
- operation-specific role/scope

Client-supplied tenant or institution identifiers must not control authorization. Required checks must occur before mutation and before creating a new idempotency reservation.

| Operation | Permitted actor |
|---|---|
| Archive budget | Budget owner or explicitly delegated budgeting administrator |
| Delete user category | Category owner or delegated budgeting administrator |
| Archive goal | Goal owner; institutional actor only with explicit delegated authority |
| Disable roundup | Goal owner or authorised financial-preference administrator |

System categories, financial-history records and records belonging to another tenant must be inaccessible.

## 7. Schema recommendation

Subject to Database Owner approval, prepare an additive migration for:

- `budgets`: `status`, `archived_at`, `archived_by`
- `budget_categories`: `is_system`, `status`, `deleted_at`, `deleted_by`
- `savings_goals`: `status`, `archived_at`, `archived_by`
- `roundup_settings`: confirm or add `enabled`, `disabled_at`, `disabled_by`, `updated_at`

Migration rules:

- additive only
- no destructive column changes
- no financial-data backfill without a reviewed plan
- no broad `ON DELETE CASCADE`
- indexes for active/non-archived queries where justified
- RLS updated to prevent access across ownership boundaries
- service-role access retained only where operationally required
- production migration separately authorised

## 8. Contract recommendation

Subject to API Product Owner approval:

| Operation | Recommended disposition |
|---|---|
| `budgetingDeleteBudget` | Retain path; document archive semantics |
| `budgetingDeleteCategory` | Retain path; document protected soft-delete semantics |
| `budgetingDeleteRule` | Remove from unreleased contract |
| `budgetingDeleteGoal` | Retain path; document archive/status-transition semantics |
| `budgetingDisableRoundUp` | Retain path; document disable-state semantics |

The contract must not describe physical deletion where the runtime performs archival or disabling.

Removal of `budgetingDeleteRule` will require operation count 484 → 483. Permitted while 4.53.1 remains Unreleased, subject to API Product Owner approval and complete contract-regression validation.

## 9. Required role approvals

### API Product Owner

Must approve: retention of four operations; removal or deferral of `budgetingDeleteRule`; public semantics; response statuses; operation-count change; documentation wording.

```
API PRODUCT OWNER DECISION:
[APPROVED / REJECTED / APPROVED WITH CONDITIONS]

Approved contract dispositions:
- budgetingDeleteBudget:
- budgetingDeleteCategory:
- budgetingDeleteRule:
- budgetingDeleteGoal:
- budgetingDisableRoundUp:

Approved response semantics:
[details]

Approver:
Date:
Conditions:
```

### Budgeting Domain Owner

Must approve: archive, soft-delete and disable models; protected system categories; dependency handling; goal state model; pending-roundup behaviour; sequential business rules.

```
BUDGETING DOMAIN OWNER DECISION:
[APPROVED / REJECTED / APPROVED WITH CONDITIONS]

Budget semantics:
Category semantics:
Goal semantics:
Roundup-disable semantics:
Dependency policy:
Pending-operation policy:

Approver:
Date:
Conditions:
```

### Database Owner

Must approve: additive fields; indexes; constraints; absence of cascades; RLS design; migration and rollback strategy; retention implementation.

```
DATABASE OWNER DECISION:
[APPROVED / REJECTED / APPROVED WITH CONDITIONS]

Approved schema additions:
Approved constraints/indexes:
Approved RLS changes:
Approved retention model:
Production migration authorised:
NO — separate release authorization required

Approver:
Date:
Conditions:
```

### Security Officer

Must approve: ownership model; replay after archive or deletion; cross-tenant isolation; idempotency scoping; protection against reservation poisoning; audit security.

```
SECURITY OFFICER DECISION:
[APPROVED / REJECTED / APPROVED WITH CONDITIONS]

Ownership boundary:
Idempotency scope:
Replay policy:
RLS/security conditions:
Required security tests:

Approver:
Date:
Conditions:
```

### Compliance and Data Protection Officer

Must approve: preservation of financial history; deletion restrictions; audit retention; personal-data treatment in archived records; retention expiry outside these handlers.

```
COMPLIANCE AND DATA PROTECTION DECISION:
[APPROVED / REJECTED / APPROVED WITH CONDITIONS]

Financial retention:
Audit retention:
Personal-data handling:
Records classified NEVER_DELETE:
Approved archival policy:

Approver:
Date:
Conditions:
```

### Payments and Ledger Owner

Required for goal and roundup operations. Must confirm: no ledger or balance deletion; no pending transfer is orphaned; no completed contribution is removed; disable behaviour for pending roundup instructions; reconciliation remains intact.

```
PAYMENTS AND LEDGER OWNER DECISION:
[APPROVED / REJECTED / APPROVED WITH CONDITIONS]

Goal archival financial safety:
Roundup-disable financial safety:
Pending instruction policy:
Ledger and reconciliation impact:

Approver:
Date:
Conditions:
```

## 10. Implementation authorization after approval

Implementation may begin only when all required approvals are recorded.

**R1I-c.1 — additive schema and RLS preparation**
Required approvals: Database Owner, Security Officer, Compliance and Data Protection Officer.
Scope: local/test migration; indexes and constraints; RLS; migration tests; rollback; no production application.

**R1I-c.2 — budgets and categories**
Scope: budget archive handler; category protected soft-delete handler; authorization; dependency checks; idempotency; tests; contract reconciliation.

**R1I-c.3 — goals and roundup**
Scope: goal archive/status-transition handler; roundup-disable handler; pending financial-operation protections; idempotency; tests; contract reconciliation.

**R1I-c.4 — combined closure**
Scope: cross-operation isolation; cascade-safety tests; security tests; full-suite regression; clean build; quality gates; SDK/Postman drift assessment; final Phase 1B runtime-wiring update.

`budgetingDeleteRule` must not be implemented unless the API Product Owner rejects removal and separately authorises a category-rules product and data model.

## 11. Current gate

```
AUTHORIZATION STATUS:
PENDING MULTI-ROLE APPROVAL

IMPLEMENTATION:
NOT AUTHORIZED

CONTRACT MODIFICATION:
NOT AUTHORIZED

DATABASE MIGRATION:
NOT AUTHORIZED

PRODUCTION ACTION:
PROHIBITED
```

Final result:

```text
PHASE 1B-R1I-c.0 BLOCKED — REQUIRED ROLE DECISIONS OUTSTANDING
```
