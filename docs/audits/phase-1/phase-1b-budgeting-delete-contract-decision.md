# Phase 1B-R1I-c.0 — Budgeting Deletion: Contract Disposition (RECOMMENDED)

**Status:** PROPOSED — awaits API Product Owner selection per operation.
**No OpenAPI modification is performed in this slice.**

## Decision matrix

| Operation | Recommended disposition | Contract impact | Approver |
|---|---|---|---|
| `budgetingDeleteBudget` | **Option B — change semantics before release** | Retain in 4.53.1; keep DELETE method; retitle to "Archive budget" (already present at line 160121); add `404`, `409` responses; retain `Idempotency-Key` header parameter | API Product Owner |
| `budgetingDeleteCategory` | **Option B** | Retain DELETE; add `409` for active-reference; document optional `?reassign_to={categoryId}` query param OR request body carrying reassignment target | API Product Owner |
| `budgetingDeleteRule` | **Option C — remove from unreleased contract** | Delete the operation, delete the path (if only DELETE exists), regenerate operation count (484 → 483), regenerate SDKs/Postman, note in changelog. No table backs this operation; implementing it would require a new rules subsystem. | API Product Owner + Budgeting Domain Owner |
| `budgetingDeleteGoal` | **Option B** | Retain DELETE; document as "Archive savings goal"; add `404`, `409`; require cascading round-up disable | API Product Owner |
| `budgetingDisableRoundUp` | **Option A — implement as documented** | Contract already correct (DELETE returning `204`, semantically a disable). Only response set additions needed (`404` for missing goal, `409` for idempotency conflict). | API Product Owner |

## Standing Order interactions

- **SO1 (Lock):** Options B and C both modify the unreleased 4.53.1 contract. Because the release status is `Unreleased`, this is permitted without a major version bump, but each Option B / C decision must be formally approved by the API Product Owner and cited in the change log for that version.
- **SO2 (Ratchet):** All proposed changes are additive to the response set. No `required[]`, `enum[]`, response code, or security declaration is removed except the removal of the `budgetingDeleteRule` operation itself (Option C).
- **SO4 (Surgeon):** Option C requires explicit Guardian approval — the operation removal is a modification of an existing documented element.
- **SO5 (Dead Code):** removing `budgetingDeleteRule` also permits removing any orphaned rule-related components; none are currently referenced by other operations (spot check pending contract slice).
- **SO6 (Version Gate):** All changes remain inside 4.53.1 while `Unreleased`. Once the release status flips, subsequent modifications require a version increment.

## Operation-count impact

| Scenario | Final operation count |
|---|---|
| All four retained (Options A + B) plus rule removal (Option C) | **483** |
| All five retained (any combination of A/B) | **484** (unchanged) |
| All five removed (Option C ×5) | **479** |

**Selection is deferred to the API Product Owner.** No count change is executed in this slice.

## Documentation deliverables (deferred to c.1+)

If the recommended dispositions are accepted:

- `public/openapi.json` — per-operation edits (response additions, optional query param on category)
- `public/openapi.yaml` — mirror
- `public/openapi-history/openapi-4.53.1.{json,yaml}` regeneration
- SDK regeneration (`packages/sdk-node`, `packages/sdk-python`, `packages/sdk-php`, `packages/sdk-go`, `packages/sdk-java`)
- Postman collection regeneration
- Changelog entry in `docs/developer-portal/changelog/*`
- Developer portal reference page updates
