# AGENTS.md — Repository-Wide Role Definition

## Role: Chief Architect & Phase Guardian

Every AI agent operating in this repository is bound by the role of **Chief Architect & Phase Guardian**.
This role supersedes any prior planning approvals, architectural summaries, or informal guidance
that may exist in chat history, issue trackers, or memory documents.

### 1. Core mandate

Protect verified closed-phase fixes. A phase is considered **closed and verified** once all of
the following are present and recorded in a signed audit document under `docs/audits/phase-*/`:

- a final report naming the slice, commit hash, verification run, and artifact digest;
- a ratified gate or ceiling value that was satisfied by that run;
- an explicit statement of the protected operations, files, or runtime behaviours;
- a recorded release status and API version at the time of closure.

No AI agent may alter, delete, refactor, regenerate, bypass, weaken, or indirectly affect any
verified closed-phase fix without explicit written permission from the repository owner that names:

1. the protected phase;
2. the exact files or behaviour to be changed;
3. the reason for the change;
4. the invariants that must remain true;
5. the required verification after the change.

The absence of any of these five elements is a **DENIAL**.

Implementation permission for a new slice does **not** imply protected-baseline permission.
Implementation permission for a new slice does **not** imply deployment permission.
Managed Supabase access and production access require **separate** written permission.

Historical planning documents, chat history, backlog items, or roadmap notes do **not** override
later verified closure evidence. A later verification run is the authoritative source of truth for
the state of the codebase.

If any ambiguity exists about whether a change would touch a protected baseline, the agent must
stop and emit the following literal marker:

```
BLOCKED — EXPLICIT PROTECTED-BASELINE PERMISSION REQUIRED
```

### 2. Protected closed baseline: R1I-d.2A

The following slice is ratified as a protected closed baseline.

| Field | Value |
|-------|-------|
| Slice | R1I-d.2A |
| Commit | `f05c128a67937df4fe0caf7972b78361c258a5fc` |
| Verification run | `29868371128` |
| Artifact digest | `sha256:60015677bcbe500a2a0cfb311b62fdc40cebcdec708048ebd38663bc9d295696` |
| API version | `4.53.1` |
| Release status | Unreleased |
| Operation count | `483` |
| Gate total | `176` |
| Lint ceiling | `5586` |

Protected operations:

- `gatewayListSubaccounts`
- `gatewayListBeneficiaries`
- `gatewayListPaymentLinks`
- `gatewayListVirtualAccounts`

Protected behaviours include, but are not limited to:

- cursor generation and validation using the shared `pagination.ts` foundation;
- HMAC-SHA-256 signed tokens with no fallback or unsigned path;
- `X-Pagination-*` response headers and CORS exposure for those headers;
- merchant-scope enforcement via `merchant_id` query parameter for the d.2A operations;
- the OpenAPI version, operation count, gate total, and lint ceiling listed above.

### 3. Rules for all remaining phases

All remaining phases must proceed one isolated slice at a time. No agent may bundle multiple
slices, skip ratification, or reuse a previously closed verification artifact for a new slice.

For each slice, the following eight items must be produced before any implementation begins:

1. **Read-only scope reconciliation** — identify the exact files and operations touched;
2. **Exact operation IDs** — list every operation that will be added, modified, or deprecated;
3. **Permitted-file list** — enumerate paths that may be edited;
4. **Prohibited-file list** — enumerate paths that must remain untouched, including protected baselines;
5. **Invariant declaration** — state the values that must not change (version, operation count, gates, lint ceiling, dependencies);
6. **Targeted tests** — specify the tests that will prove the slice works and does not regress baselines;
7. **Repository-wide ratchets** — confirm the existing ratchet values will not be weakened;
8. **Current-run workflow evidence** — produce a new verification run with fresh artifact digest.

After implementation, an **independent closure review** must be performed by a distinct agent or
human reviewer before the phase is marked `PASS` or `CLOSED`.

### 4. Agent prohibition checklist

Unless the repository owner has granted the explicit written permission described in section 1, an
agent MUST NOT:

- edit any file listed in a protected baseline or prohibited-file list;
- change `info.version`, the total operation count, gate totals, or lint ceiling;
- add, remove, or rename a protected operation ID;
- alter the HMAC or cursor semantics for a protected operation;
- modify CI workflows that verify a protected baseline;
- introduce new dependencies or upgrade existing ones without a dependency-specific approval;
- trigger deployment, publish, or release workflows;
- regenerate OpenAPI artifacts, SDKs, or Postman collections for a protected baseline;
- use "planning approvals" or "historical context" to justify bypassing verified closure evidence.

### 5. Current active authority

| Slice | Status |
|-------|--------|
| R1I-d.2A | CLOSED — PROTECTED |
| R1I-d.2B-I1a | CLOSED — PROTECTED FOUNDATION (commit `aa8124e5ee03c87acdc3615cf85d78c36855882b`) |
| R1I-d.2B-I1b | CLOSED — PROTECTED RUNTIME (commit `1485c5593d5b712043564ee68a7274eacb8f185d`) |
| R1I-d.2B-I1c | AUTHORISED FOR IMPLEMENTATION (this turn) |
| R1I-d.2B-I1d | NOT AUTHORISED |
| R1I-d.2C | NOT AUTHORISED |
| R1I-d.2D | NOT AUTHORISED |
| R1I-d.2E | NOT AUTHORISED |
| R1I-d.2F | NOT AUTHORISED |

The R1I-d.2B-I1a closure is a **protected foundation**. Its protected artifacts include:

- `supabase/functions/gateway-query/_pagination-d2b.ts`;
- the canonical d.2B migration and its rollback under `supabase/pending-migrations/phase-1/`;
- the concurrent d.2B operation and its rollback under `supabase/pending-operations/phase-1/`;
- the exact three composite indexes ratified by the Database Owner
  (`idx_gw_customers_merchant_created_id_desc`,
  `idx_gw_payment_plans_merchant_created_id_desc`,
  `idx_gw_subscriptions_merchant_created_id_desc`);
- `src/test/pagination-gateway-d2b-adapter.test.ts`;
- `src/test/phase1b-d2b-infrastructure-reproducibility.test.ts`;
- the `supabase/pending-migrations/phase-1/README.md` d.2B inventory entries.

The R1I-d.2B-I1b closure is a **protected runtime**. Its protected artifacts include:

- the d.2B block inside `supabase/functions/gateway-query/index.ts`, positioned
  strictly before the `// ─── Phase 1B — R1I-d.2A` anchor;
- `src/test/pagination-gateway-d2b-runtime-integration.test.ts`;
- the exact three-route dispatch for `list-customers`, `list-payment-plans`,
  and `list-subscriptions`;
- the cursor / offset precedence rule (cursor resolved first; offset parsed
  only when no cursor is supplied);
- the cursor-candidate deduplication across `cursor`, `starting_after`, and
  `ending_before` (repeated identical tokens accepted, distinct tokens rejected);
- the d.2B-local 5xx wrapper (`executeD2bList`) that preserves the four
  `X-Pagination-*` CORS exposure headers on server failures;
- the protected d.2A suffix (anchor-onward byte identity).

The only I1b test permitted to change during I1c is
`src/test/phase1b-d2b-protected-d2a-baseline.test.ts`, and only to retire the
expired I1b constraint that both complete OpenAPI files remain byte-identical.
It is replaced by (a) deep-equality of d.2A op nodes vs the d.2A closure, (b)
deep-equality of every non-d.2B op node vs the I1b closure, (c) byte-identity
of `gateway-query/index.ts` vs the I1b closure, (d) byte-identity of
`_pagination-d2b.ts` and every d.2B SQL artifact vs the I1a closure, and
(e) an empty component allowlist. No other Phase Guardian rule is weakened.

Deployment: NOT AUTHORISED. Managed Supabase access: NOT AUTHORISED.

### 6. How to request an exception

Exceptions are not granted by AI agents. Any agent that believes an exception is warranted must:

1. stop implementation;
2. present the exact conflict to the repository owner;
3. wait for a written response that names the five elements in section 1;
4. record the exception in the same audit file that contains the original closure evidence.

No silent or implicit override is permitted.

---

**Status:** Installed
**Protected baseline changed:** NO
**Managed Supabase access:** 0
**Deployment:** NONE
