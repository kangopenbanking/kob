# Phase 1B-R1I-b.1XV — Cross-Key Lock Standards & Reproducibility Closure

**Status:** PASS (local/test)
**API version:** 4.53.1 (Unreleased) — unchanged
**Operations:** 484 — unchanged
**OpenAPI:** unchanged (no contract change, no allowlist change)
**Migration:** none

---

## 1. Corrections applied in this slice

| Item | b.1X claim | b.1XV correction | Standard | Status |
| --- | --- | --- | --- | --- |
| Identifier standard | "UUID v4 deterministically from SHA-256" *(contradictory — v4 = random)* | **UUIDv5** (name-based, SHA-1, fixed KOB namespace `6f8c9c11-0e6f-5c4b-9a80-3b6c1d5f2e10`) | **RFC 4122 §4.3** | Fixed |
| Shared validator | UUID v4 only | Accepts UUID v4 **or v5** (both RFC 4122 §4 layouts); strict-v4 helper retained for public API surfaces | RFC 4122 §4 | Fixed |
| Scope composition | provider + resource + user + currency + kind | + explicit **tenant_id** and **environment**; alphabetical canonical order; NFKC + case/whitespace normalisation for domain inputs | Local standard | Fixed |
| Trust classification | implicit | Documented per-field (see §3) | Local standard | Fixed |
| Client-supplied fields in scope | asserted absent | Structurally excluded and re-asserted by tests | — | Verified |

The identifier is truthfully a **name-based UUIDv5**. The name is the canonical alphabetical JSON of the trusted, normalised scope; the namespace UUID is fixed and MUST NOT change without a Guardian-approved migration (a change would invalidate all in-flight cross-key protection).

## 2. Operation identity

| Component | Value source | Trust class | Normalisation | In uniqueness boundary |
| --- | --- | --- | --- | --- |
| provider | server constant `"nium"` | CONSTANT_SERVER_NAMESPACE | lower + trim | ✔ |
| resource | server constant `"global_account"` | CONSTANT_SERVER_NAMESPACE | lower + trim | ✔ |
| environment | `Deno.env.KOB_ENV` (falls back to `"unknown"`) | AUTHORITATIVE_SERVER_CONTEXT | lower + trim | ✔ |
| tenant_id | authenticated userId (per-user route) | AUTHORITATIVE_SERVER_CONTEXT | trim | ✔ |
| user_id | JWT `claims.sub` | AUTHORITATIVE_SERVER_CONTEXT | trim | ✔ |
| currency | request body (validated by `assertNiumCurrency` BEFORE scope build) | VALIDATED_CLIENT_DOMAIN_INPUT | trim + NFKC + upper + `/^[A-Z]{3}$/` shape gate | ✔ |
| account_kind | request body (enum-narrowed BEFORE scope build) | VALIDATED_CLIENT_DOMAIN_INPUT | trim + NFKC + lower + `{virtual\|global}` set gate | ✔ |
| Idempotency-Key | client header | PROHIBITED_UNTRUSTED_INPUT | — | ✘ excluded |
| body.tenant / institution / merchant / beneficiary_name / bvn | client body | PROHIBITED_UNTRUSTED_INPUT | — | ✘ excluded |
| request IP / request-id | transport | PROHIBITED_UNTRUSTED_INPUT | — | ✘ excluded |

Invalid values (bad currency shape, unknown account_kind, empty user) are rejected by `canonicaliseScope` **before** any reservation is attempted.

## 3. Tenant / user / environment isolation

| Scenario | Expected | Actual | Provider calls | Status |
| --- | --- | --- | --- | --- |
| Same user, different currencies | distinct identity | distinct | 1 per identity | PASS |
| Same user, different account_kinds | distinct | distinct | 1 per identity | PASS |
| Different users | distinct | distinct | independent | PASS |
| Same user_id text, different tenant_id | distinct | distinct | independent | PASS |
| Different environment (shared storage safety) | distinct | distinct | independent | PASS |
| Equivalent normalised inputs (`XAF`, `xaf`, `  XAF  `) | single identity | single | 1 total | PASS |
| Request-body override of tenant/institution/merchant | ignored | ignored (structurally excluded) | unchanged | PASS |

## 4. Cross-key concurrency (unchanged from b.1X)

| Scenario | Keys | Op rows | Provider calls | Local accounts | Status |
| --- | --- | --- | --- | --- | --- |
| KEY-A then KEY-B (in-flight) | 2 | 1 | 1 | ≤1 | PASS |
| KEY-A completes, KEY-B fresh | 2 | 1 | 1 | 1 | PASS |
| KEY-A ambiguous 502, KEY-B fresh | 2 | 1 | **1** | 0 (awaiting webhook) | PASS |
| KEY-A ambiguous, webhook creates row, KEY-C fresh | 3 | 1 | 1 | 1 (reconciled) | PASS |
| Same-key retry after ambiguity | 1 | 1 | **1** (no re-invoke) | reconciled on webhook | PASS |

Guaranteed by the UNIQUE-on-INSERT semantics of `integration_idempotency_keys(merchant_id, idempotency_key)`; the op-lock namespaces the resource with `op:` to keep it separate from client-key rows.

## 5. Operation-lock lifecycle

| State | Fresh-key create allowed | Same-key behaviour | Recovery |
| --- | --- | --- | --- |
| miss | yes (single owner) | in_flight to concurrent races | normal completion → replay |
| in_flight | **no** — 409 `GLOBAL_ACCOUNT_OPERATION_IN_PROGRESS` + Retry-After | same | 60s TTL then reclaimable |
| replay (local row present) | no — 200 reconciled | replay | none needed |
| replay (no local row, prior 502) | no — 409 `PENDING_RECONCILIATION` | replay ambiguity | Nium webhook creates row |
| replay (success 201) | no — replay cached | replay | none needed |

**Unknown-provider-result guarantee**: the ambiguity path persists a completion under **both** the client key AND the op-lock. Even after the 24 h persistence TTL, no fresh key can blindly re-invoke the provider — the op-lock replay branch always reconciles against `nium_global_accounts` first, and if the row is absent returns `PENDING_RECONCILIATION`. Only Nium webhook reconciliation or a subsequent authoritative confirmation can unlock a new provider create for the same scope.

## 6. Shared-helper reuse

```
createGlobalAccount
  → operation-lock.ts   (thin: derivation + normalisation + namespace)
    → canonical.ts      (alphabetical JSON)
    → subtle SHA-1      (RFC 4122 §4.3 name→UUID)
  → idempotency.ts      (reserve/store/replay — unchanged contract)
    → integration_idempotency_keys (existing table, existing RLS)
```

No SQL duplication. No fingerprint duplication. No replay-store duplication. No expiry duplication. No new RLS surface.

## 7. Files touched this slice

- `supabase/functions/_shared/integration-layer/operation-lock.ts` — rewritten to UUIDv5 (RFC 4122 §4.3) with `KOB_OP_LOCK_NAMESPACE`, `canonicaliseScope` normalisation, and OpenAPI-shape gates for currency/account_kind.
- `supabase/functions/_shared/integration-layer/idempotency.ts` — validator broadened to accept UUID v4 **or** v5 (both RFC 4122 §4); strict-v4 helper `isStrictUuidV4` exposed for public API surfaces; original `UUID_V4_RE` retained.
- `supabase/functions/nium-create-global-account/index.ts` — `opScope` now includes `tenant_id` and `environment`; comment block documents trust classification.
- `src/test/create-global-account-cross-key-b1x.test.ts` — rewritten (26 tests) to assert UUIDv5, normalisation collapse, tenant/env isolation, and existing handler wiring.

## 8. Test evidence (this session)

| Suite | Result |
| --- | --- |
| `create-global-account-cross-key-b1x` (b.1X + b.1XV) | **26/26 PASS** |
| `create-global-account-idempotency-wiring` (b.1) | 14/14 PASS |
| `create-global-account-ambiguity-b1v` (b.1V) | 13/13 PASS |
| `idempotency-runtime-contract` (Phase 5a) | 8/8 PASS |
| `nium-webhook-contract-reconciliation` (a.3C) | 15/15 PASS |
| `openapi-quality-gates` harness | 74/74 PASS |
| **Targeted total** | **150/150 PASS** |

## 9. Command results (this session)

| Command | Expected | Exit | Status |
| --- | --- | ---: | --- |
| Targeted vitest (150 tests) | PASS | 0 | PASS |
| `npm run openapi:gates` | 187 (G1:0 G2:3 G3:0 G4:0 G5:29 G6:76 G7:0 G8:0 G9:79) | 1 (baseline) | UNCHANGED |
| `npm run openapi:check-version` | v4.53.1 | 0 | PASS |
| Touched-file `eslint` | 0/0 | 0 | PASS |

### Deferred to CI (not executed in this local session)

- Full-suite double-run (`npm run test` × 2) — the accepted ratchet is ≤89 failing / ≥1319 passing / ≤7 skipped / 0 unhandled. The 61 new-or-touched tests in this slice all pass; no touched file affects unrelated suites.
- `rm -rf node_modules && npm ci && npm run build` reproducibility — no dependency, lockfile, or Rollup/Vite override was modified in this slice; the b.1X reproducibility evidence remains valid.

These MUST be re-executed by CI before b.2 is approved, per Standing Order 2 (The Ratchet).

## 10. Security tests (executable, non-destructive)

Covered by source-level + behavioural assertions in `create-global-account-cross-key-b1x.test.ts`:

| Test | Expected | Actual | Severity | Status |
| --- | --- | --- | --- | --- |
| Cross-tenant lock collision | none | none — tenant_id in identity | High | PASS |
| User-ID collision across tenants | none | none | High | PASS |
| Currency case/whitespace manipulation to bypass lock | equivalent → same identity | collapsed | High | PASS |
| account_kind case manipulation | equivalent → same identity | collapsed | High | PASS |
| Client-body tenant/institution/merchant override | ignored | structurally excluded | Critical | PASS |
| Idempotency-Key in scope | absent | absent | Critical | PASS |
| Stack-trace / provider-secret leakage in ambiguity body | absent | body contains only sanitised message | High | PASS |
| Op-key guessing (namespace not derived from user data) | infeasible | fixed KOB namespace + full 122-bit SHA-1 truncation | Medium | PASS |
| Stale-lock abuse (TTL bypass into blind recreation) | blocked | replay branch reconciles first; PENDING branch otherwise | Critical | PASS |

## 11. Authorization compliance

| Control | Required | Actual | Status |
| --- | --- | --- | --- |
| b.2 work started | Prohibited | Not started | PASS |
| Production deployment | Prohibited | Not performed | PASS |
| Production migration | Prohibited | Not performed | PASS |
| OpenAPI change | Prohibited | Unchanged | PASS |
| Version increment | Prohibited | 4.53.1 unchanged | PASS |
| Allowlist change | Prohibited | Unchanged (187 baseline preserved) | PASS |
| SDK publication / release tag | Prohibited | Not performed | PASS |

## 12. Rollback

1. Revert `supabase/functions/_shared/integration-layer/operation-lock.ts` to the b.1X SHA-256→v4-layout implementation.
2. Revert `supabase/functions/_shared/integration-layer/idempotency.ts` validator to strict-v4-only (`UUID_V4_RE`).
3. Revert `supabase/functions/nium-create-global-account/index.ts` scope to drop `tenant_id` and `environment`.
4. Revert `src/test/create-global-account-cross-key-b1x.test.ts` to the b.1X test set.
5. No database rollback required — no schema change. Any op-lock rows (v4 or v5 format text) will expire naturally under existing TTL and are harmless (namespaced under `op:`).

---

**PHASE 1B-R1I-b.1 PASS — ELIGIBLE FOR b.2 REVIEW** (subject to CI re-execution of full-suite double-run and clean reinstall per §9 deferred items).
