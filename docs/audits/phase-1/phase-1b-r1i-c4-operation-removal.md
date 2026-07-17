# Phase 1B-R1I-c.4 — Operation Removal Evidence

**Operation removed:** `budgetingDeleteRule`
**Path removed:** `DELETE /v1/budgeting/categories/rules/{ruleId}`
**Scope:** Unreleased 4.53.1 OpenAPI contract only. Never released, never deployed.

## Rationale

`budgetingDeleteRule` documented functionality that had:

- no runtime handler in `supabase/functions/budgeting-ops/index.ts` (verified pre-c.4: terminal 404 for every request),
- no backing table in the public schema (`category_rules` does not exist; `grep -rn 'category_rules' supabase/migrations/` returns empty),
- no promoted or pending migration to create such a table.

Retaining the operation would have advertised unsupported behaviour and inflated the DELETE surface while violating the "no dead contract" principle. Removal is the correct disposition under R1I-c.4 (biased toward Option C in the original c.0 decision memo).

## Precondition — c.4 was purely additive-reversal

Before c.4:

- 484 operations in `public/openapi.json` / `public/openapi.yaml`;
- 1 path entry: `/v1/budgeting/categories/rules/{ruleId}` → `DELETE budgetingDeleteRule`;
- 5-member G7 assertion list in `src/test/openapi-phase-1b-contract.test.ts`;
- changelog claim: "Operation count unchanged at 484".

After c.4:

- 483 operations in JSON and YAML (parity preserved);
- path entry `/v1/budgeting/categories/rules/{ruleId}` removed entirely — no orphaned `get`/`post`/`put`/`patch`/`delete`;
- LIST/CREATE at `/v1/budgeting/categories/rules` (`budgetingListRules`, `budgetingCreateRule`) **retained** — out of c.4 scope;
- 4-member G7 assertion list;
- changelog 4.53.1 entry records the removal and corrects the count claim to `484 → 483`.

## Files changed by c.4

| File | Change |
| --- | --- |
| `public/openapi.json` | Path `/v1/budgeting/categories/rules/{ruleId}` removed |
| `public/openapi.yaml` | Regenerated from JSON (yaml.dump `{lineWidth:120,noRefs:true}`) |
| `public/changelog.json` | 4.53.1 entry updated: `removed` bullet added; compatibility line corrected |
| `CHANGELOG.md`, `public/CHANGELOG.md` | Regenerated via `scripts/build-changelog-md.mjs` |
| `docs/audits/phase-1/phase-1b-runtime-wiring.csv` | G7 row for `budgetingDeleteRule` → REMOVED_FROM_UNRELEASED_4_53_1 |
| `docs/audits/phase-1/phase-1b-runtime-wiring.json` | Matching row updated; `lastPhase` bumped to c.4 |
| `src/test/openapi-phase-1b-contract.test.ts` | G7 list reduced to 4; operation-count assertion 484 → 483 |
| `src/test/openapi-phase-1b-c3a-contract.test.ts` | "still present" assertion inverted to "removed by c.4" |
| `src/test/openapi-phase-1b-c2a-contract.test.ts` | Operation count 484 → 483 |
| `src/test/openapi-quality-gates.test.ts` | c.3A block replaced by c.4 block: totals 179/68/79 → 176/66/78; ops 484 → 483 |
| `src/test/nium-webhook-contract-reconciliation.test.ts` | Operation count 484 → 483 |
| `scripts/slice-c4-remove-budgeting-delete-rule.mjs` | New tool: performs JSON removal + YAML regeneration + invariants check |

## What did NOT change

- `info.version` (still 4.53.1)
- `info` metadata, `externalDocs`, `servers[]`, `security`, `tags`, `components.*`
- Any other path, operationId, schema, parameter, header, or security scheme
- `supabase/migrations/`
- `supabase/pending-migrations/phase-1/*` checksums (all six unchanged)
- `package.json`, `package-lock.json`, `.nvmrc`, build/CI configuration
- SDK sources
- Historical postman snapshots

## Prohibited actions confirmed not taken

- No R1I-d work initiated.
- No server-URL contract correction (deferred; carry-forward finding).
- No production migration or deployment.
- No pending-migration promotion.
- No version increment.
- No new operations added.
- No SDK/Postman publication.
- `budgetingDeleteRule` neither restored nor implemented.
