# Phase 1B — R1I-d.2B-I1c-X1 — Pagination-Coverage Forensic Inventory

**Status:** READ-ONLY forensic inventory. No implementation is authorised by
this document. No OpenAPI, runtime, migration, SDK, workflow, or test file
was modified.

**Reviewed base commit:** `d68c8b48ec17ce063280bc0520feef33374f16b8`

**Scope (fixed):** the five endpoints currently failing
`src/test/openapi-pagination-coverage.test.ts`:

1. `GET /v1/merchants/qr-directory`
2. `GET /v1/webhooks/dlq`
3. `GET /v1/agents`
4. `GET /v1/agents/{agentId}/transactions`
5. `GET /v1/remittance/cemac/corridors`

No other endpoint is inventoried. No protected d.2A / I1a / I1b / I1c artifact
is touched.

---

## 1. Executive conclusion

The five coverage failures are **not one homogeneous defect**. They fall into
four distinct classifications, three of which have materially different
security boundaries. Satisfying the ratchet by mechanically wrapping each 200
schema in `PaginatedResponse` would produce an OpenAPI contract that does not
match runtime behaviour and would in one case (`/v1/webhooks/dlq`) advertise
a runtime that does not currently exist.

- 1 endpoint is a **CONTRACT_ONLY_DEFECT** — runtime already returns a
  cursor-paginated envelope compatible with `PaginatedResponse`, but the
  schema is inlined and does not `$ref` the canonical component.
- 2 endpoints are **RUNTIME_AND_CONTRACT_DEFECT** — runtimes return
  `{ data, count }` with a hard `limit` clamp, no cursor, no keyset ordering,
  and no unique tie-breaker.
- 1 endpoint is a **BOUNDED_COLLECTION_CANDIDATE** — CEMAC has 6 member
  states, so origin×destination is provably ≤ 36 rows and the response is
  today declared as a plain array. Bounded-exemption ratification is a
  separate architectural decision under d.0 §9 and is **not** requested here.
- 1 endpoint is not implemented at runtime at all (`/v1/webhooks/dlq`). The
  OpenAPI operation `listWebhookDlq` declares cursor pagination against a
  handler that does not exist in `supabase/functions`. This is both a runtime
  gap and a contract defect and must **not** be closed by editing OpenAPI in
  isolation.

The coverage ratchet must therefore be resolved as **three independent
authorised slices** plus one bounded-exemption decision, not one cross-cutting
patch. See §8.

**No new failure was introduced by I1c.** All five failures are present at
the I1b baseline (commit `1485c559...`) and predate the d.2B program.

---

## 2. Five-endpoint inventory table

| # | Path | operationId | Tags | Runtime function | Route in function | Data source | Auth | Current 200 shape | Ordering | Tie-breaker | Limit clamp | Cursor | Offset | Total | Class |
|---|------|-------------|------|------------------|-------------------|-------------|------|-------------------|----------|-------------|-------------|--------|--------|-------|-------|
| 1 | `/v1/merchants/qr-directory` | `merchantsQrDirectoryList` | Payments | `merchants-qr-directory` | `Deno.serve` root | view `public.merchant_qr_directory` (filtered by `verified=true`) | Public (anon key) | `{ object:'list', data:[...], has_more, next_cursor }` inline | `merchant_id ASC` | `merchant_id` (UUID, unique) | 1–100, default 25 | UUID token bound to `merchant_id` | none | absent | **A — CONTRACT_ONLY_DEFECT** |
| 2 | `/v1/webhooks/dlq` | `listWebhookDlq` | Webhooks | **no matching handler** (no `Deno.serve` route implements `GET /v1/webhooks/dlq`) | — | table `public.webhook_inbox_dlq` (referenced only by `admin-webhook-dlq-replay` and `webhook-inbox-retry-worker`) | `bearerAuth` (spec) | Spec: `{ data:[{}], has_more }`. Runtime: N/A | N/A | N/A | spec: `limit` 1..? | spec: `cursor` | none | absent | **B — RUNTIME_AND_CONTRACT_DEFECT** (runtime missing) |
| 3 | `/v1/agents` | `agentList` | Agents | `agent-banking` | `GET .../agents` (tail length 1) | table `public.agents` | Public (anon key; no `security` on op) | `{ data:[...], count }` | none (no `.order()` clause) | none | 1–200, default 50 | none (spec advertises `CursorParam`/`StartingAfter`/`EndingBefore` but runtime ignores them) | none | `count` = current page length (not exact total) | **B — RUNTIME_AND_CONTRACT_DEFECT** |
| 4 | `/v1/agents/{agentId}/transactions` | `agentTransactionList` | Agents | `agent-banking` | `GET .../agents/:agentId/transactions` (tail length 3) | table `public.agent_cash_transactions` | Public (anon key on op; runtime does not enforce tenant scoping beyond `agent_id` filter) | `{ data:[...], count }` | `created_at DESC` | none (no `id` tie-breaker) | 1–200, default 50 | none | none | `count` = current page length | **B — RUNTIME_AND_CONTRACT_DEFECT** |
| 5 | `/v1/remittance/cemac/corridors` | `cemacCorridorsList` | CEMAC Remittance | no dedicated function; closest is `remittance-outbound` `get_corridors` action returning `{ corridors:[...] }` from `public.remittance_corridors` | POST action, not a `GET /corridors` route | table `public.remittance_corridors` (filtered by partner status) | Public (no `security` on op) | Spec: plain `array` of `CemacCorridor` | not documented; runtime returns partner join order | none | not declared in spec | spec declares `CursorParam`/`StartingAfter`/`EndingBefore`/`LimitParam` but response is a bare array (envelope-less) | none | absent | **C — BOUNDED_COLLECTION_CANDIDATE** (max 6×6=36 rows by CEMAC membership) |

Operation IDs resolved: **5/5**. Runtime handlers resolved: **5/5** (one
resolved as *missing*). Actual response shapes resolved: **5/5**.

---

## 3. Contract / runtime mismatch analysis

### 3.1 `/v1/merchants/qr-directory` — A

Runtime shape today:

```json
{ "object": "list", "data": [...], "has_more": true, "next_cursor": "<uuid>" }
```

This is a valid cursor-paginated envelope. It fails the coverage ratchet only
because the OpenAPI 200 schema is inlined (`type:object, properties:{data,has_more,next_cursor,object}`)
instead of referencing `#/components/schemas/PaginatedResponse`. Runtime
requires no change to satisfy §2 (limit 1..100, default 25), §5 (cursor is
opaque, bound to primary sort column), §6 (`has_more` mandatory, no `total`).

Remaining runtime debt independent of the coverage ratchet:

- cursor is a **raw `merchant_id` UUID**, not an HMAC-signed token per d.1F
  invariant 2. It is not tamper-resistant.
- ordering key is `merchant_id ASC`, not `(created_at DESC, id DESC)` per
  d.2S §4. This is acceptable for a static-ish directory but inconsistent
  with the d.2 program's universal ordering profile.
- no `X-Pagination-*` response headers.

Contract-only remediation closes the ratchet; runtime hardening (HMAC cursor,
canonical ordering, response headers) is a separate d.2C-class slice.

### 3.2 `/v1/webhooks/dlq` — B (runtime missing)

`grep -rn` across `supabase/functions` finds no `Deno.serve` route that
matches `GET /v1/webhooks/dlq`. The only functions that reference
`webhook_inbox_dlq` are:

- `admin-webhook-dlq-replay/index.ts` — POST-only, requeues one entry.
- `webhook-inbox-retry-worker/index.ts` — background worker.

The OpenAPI operation is therefore **advertising a listing endpoint that does
not exist**. Editing the 200 schema to `PaginatedResponse` would deepen the
mismatch. This endpoint requires:

1. new admin-scoped runtime that lists `webhook_inbox_dlq` under RLS with
   admin-role assertion (per `admin-webhook-dlq-replay` precedent);
2. cursor pagination on `(inserted_at DESC, id DESC)` bound to admin scope;
3. filter hash over `source`, `provider`, `event_type`, `dlq_reason` if those
   filters are exposed;
4. OpenAPI update to reference the real response schema.

Until a runtime exists, the contract is defective by definition.

### 3.3 `/v1/agents` — B

Runtime returns `{ data, count }` with no ordering, no cursor, and no unique
tie-breaker. `count` today is *page length*, not exact-count. The OpenAPI
already declares `CursorParam`, `StartingAfter`, `EndingBefore` but the
handler ignores every one of them. `agents.status='active'` is the only
implicit filter; `country_code` and `region` are optional.

Coverage ratchet cannot be satisfied without runtime work: the 200 payload is
not a `PaginatedResponse` envelope (no `pagination`, no `meta`, no cursor
emission), and no cursor query param is honoured. `count` MUST be removed or
recast — under d.0 §6, exact totals are prohibited on unbounded operational
listings.

### 3.4 `/v1/agents/{agentId}/transactions` — B

Same shape as §3.3 but scoped to one `agentId`. Ordering is `created_at DESC`
without an `id` tie-breaker, so keyset pagination is unsafe: two transactions
with identical `created_at` values would either be skipped or duplicated
across pages. OpenAPI does not even declare a cursor-style parameter today
(`hasCursor=false` in the ratchet report), unlike `agentList`.

Security boundary is materially different from `agentList`: this returns
**agent financial movements**. It currently authenticates on the anon key and
performs no verification that the caller is entitled to see a given agent's
transactions. Any cursor design MUST bind `scope_hash` to `(caller_id,
agent_id)` and require an authenticated caller, not just an anon fetch of a
UUID path parameter. This is a security-tenancy concern independent of the
ratchet.

### 3.5 `/v1/remittance/cemac/corridors` — C

Response is a plain JSON array of `CemacCorridor` objects. Schema constrains
`origin_country` and `destination_country` to the six CEMAC ISO codes
(`CM, GA, CG, TD, CF, GQ`), giving an **enforced upper bound of 6×6 = 36
distinct corridors** (fewer once same-country pairs and inactive corridors
are excluded). This qualifies under d.0 §9 items (1)–(3) if — and only if —
the seed / database enforces the enumeration.

Note: **no dedicated `GET /v1/remittance/cemac/corridors` runtime exists.**
The closest producer is `remittance-outbound`'s POST action `get_corridors`,
which returns `{ corridors: [...] }` from `remittance_corridors` filtered on
`remittance_partners.status='active'`. Either:

1. a dedicated public `GET` route is added and marked
   `x-bounded-collection: { max_items: 36, justification: "CEMAC =
   6 member states; enumeration enforced by enum on origin/destination" }`;
   OR
2. the endpoint is retracted (`deprecated: true`) in favour of a
   `POST /v1/remittance/quote`-style action.

The coverage ratchet **cannot** be satisfied for this endpoint by wrapping
the array in `PaginatedResponse` without contradicting d.0 §9's stated intent
that bounded collections stay as plain arrays. The correct fix requires
architectural ratification, not a contract-only patch.

---

## 4. Security and tenancy analysis

| Endpoint | Auth today | Tenant boundary | Cursor scope-hash inputs required | Filter-hash inputs required |
|----------|------------|-----------------|-----------------------------------|-----------------------------|
| qr-directory | Anonymous (public directory by policy P1/P3) | none — global | `env` + `verified=true` invariant | `country`, `category` (MCC) |
| webhooks/dlq | `bearerAuth` in spec, admin role required (per `admin-webhook-dlq-replay` precedent) | admin-only (workspace-wide) | `env` + `caller_id` + `role=admin` | `source`, `provider`, `event_type`, `dlq_reason`, `inserted_at` window |
| agents | Anon today (should be at minimum bearer-scoped; admin/institution scope for non-active agents) | none today; MUST become tenant-scoped for merchant/institution callers | `env` + `caller_id` + `institution_id?` | `country_code`, `region`, `status` |
| agents/{id}/transactions | Anon today (security defect) | must become `(caller ∈ agent owners OR admin)` | `env` + `caller_id` + `agent_id` | none currently exposed; add `type`, `from`, `to` if surfaced |
| cemac/corridors | Anon (developer-facing reference data) | none — public reference | n/a (bounded) | n/a (bounded) |

The **`agents/{id}/transactions` anon exposure** is a security finding
independent of the pagination ratchet and should be raised through the
security workflow, not folded into a coverage patch.

---

## 5. Pagination-model recommendation

| # | Endpoint | Model | Default limit | Max limit | Ordering tuple | Cursor lifetime | Exact total? |
|---|----------|-------|---------------|-----------|----------------|-----------------|--------------|
| 1 | qr-directory | **cursor** (harden existing raw-UUID cursor to HMAC-signed per d.1F) | 25 | 100 | `(created_at DESC, merchant_id DESC)` or retain `(merchant_id ASC)` as a stable primary+tie-breaker if directory ordering must remain lexical | 1800 s | prohibited |
| 2 | webhooks/dlq | **cursor** | 25 | 100 | `(inserted_at DESC, id DESC)` | 1800 s | prohibited (per d.0 §6) |
| 3 | agents | **cursor** | 25 | 100 | `(created_at DESC, id DESC)` (canonical d.2S profile) | 1800 s | prohibited; drop `count` |
| 4 | agents/{id}/transactions | **cursor** | 25 | 100 | `(created_at DESC, id DESC)` | 1800 s | prohibited (financial listing per d.0 §6 forbidden-total list); drop `count` |
| 5 | cemac/corridors | **bounded-exemption** (subject to §11 ratification) | n/a | max_items = 36 | `(origin_country ASC, destination_country ASC)` | n/a | plain array with `Cache-Control: public, max-age=3600` |

Response headers required by d.0 §7 on every non-bounded endpoint:
`X-Pagination-Mode`, `X-Pagination-Has-More`, `X-Pagination-Next-Cursor`,
`X-Pagination-Limit`, and their CORS exposure via `Access-Control-Expose-Headers`.

---

## 6. Required indexes and migrations

Independent per endpoint; each must be delivered as an isolated concurrent
migration under `supabase/pending-operations/phase-1/` following the d.2A /
d.2B pattern (composite index, `indisvalid`/`indisready` guard, rollback
file, README inventory entry).

| Endpoint | Table | Required index | Rationale |
|----------|-------|----------------|-----------|
| qr-directory | `merchant_qr_directory` (view) — underlying table `merchants` | If retaining `merchant_id ASC`: existing PK is sufficient. If moving to `(created_at DESC, merchant_id DESC)`: `CREATE INDEX CONCURRENTLY idx_merchants_verified_created_id_desc ON public.merchants (verified, created_at DESC, id DESC) WHERE verified = true;` | Keyset scan |
| webhooks/dlq | `webhook_inbox_dlq` | `CREATE INDEX CONCURRENTLY idx_webhook_inbox_dlq_inserted_id_desc ON public.webhook_inbox_dlq (inserted_at DESC, id DESC);` plus optional `(source, provider, event_type, inserted_at DESC, id DESC)` if filters land in the runtime | Keyset scan; admin listing |
| agents | `agents` | `CREATE INDEX CONCURRENTLY idx_agents_status_created_id_desc ON public.agents (status, created_at DESC, id DESC);` (+ optional `(country_code, region, status, created_at DESC, id DESC)` if that filter combination dominates) | Filtered keyset scan |
| agents/{id}/transactions | `agent_cash_transactions` | `CREATE INDEX CONCURRENTLY idx_agent_cash_tx_agent_created_id_desc ON public.agent_cash_transactions (agent_id, created_at DESC, id DESC);` | Per-agent keyset scan |
| cemac/corridors | `remittance_corridors` | none required (bounded); optional `(origin_country, destination_country)` unique constraint to *enforce* the bound | Ratifies §9 (1)–(2) |

None of these indexes are created by this document. They are proposed for
their respective future slices.

---

## 7. Backward-compatibility assessment

| Endpoint | Breaking? | Deprecation surface | SDK impact |
|----------|-----------|---------------------|------------|
| qr-directory | Non-breaking. Envelope shape is unchanged; only the OpenAPI `$ref` changes. If cursor moves from raw UUID to HMAC-signed opaque string, that IS breaking for any client that decoded the cursor — but no published SDK does (Node/Python/PHP SDKs treat it opaquely per `packages/sdk-php/src/Resources/QRDirectoryResource.php` line 65–71). Requires a 4.54.0 minor. | Node/Python/PHP: opaque cursor consumers only — no source change required |
| webhooks/dlq | Non-breaking (endpoint is currently non-functional). Introducing a working runtime is additive. New OpenAPI must retain the declared 400/401/409/422/429 error surface. | No SDK exposure today |
| agents | **Breaking on `count` field removal.** `count` is currently declared and returned. Removal is a MAJOR ratchet under Guardian Standing Order 6 unless retained as `count: page length` with an added `pagination` block, and clients are steered to `has_more`. Recommend the additive path: keep `count` marked `deprecated: true` for one minor. | SDK `AgentsResource.list` returns object with `data`/`count`; needs `pagination`/`has_more`/`next_cursor` fields added; `count` kept and marked deprecated |
| agents/{id}/transactions | Same as agents. Plus a **security boundary change** (anon → bearer required) that is by itself a breaking change and must be gated on a separate authorisation. | SDK `AgentsResource.transactions` same treatment |
| cemac/corridors | Non-breaking if the endpoint stays a plain array and adds only `x-bounded-collection` metadata and `Cache-Control`. Breaking if wrapped in an envelope. Ratchet exemption resolves without breaking clients. | None (endpoint is developer reference, low SDK usage) |

Any breaking change requires a **minor or major `info.version` bump** and a
CHANGELOG entry per Guardian Standing Orders 1, 6, and P10. This document
does not authorise a version bump.

---

## 8. Recommended implementation slices

Prefer **four independent slices** over one cross-cutting sweep. The
runtimes belong to different domains (Payments, Webhooks/Admin, Agents,
CEMAC Remittance) and have different security boundaries, blast radii, and
review chains.

| Order | Proposed slice | Endpoints | Class | Depends on |
|-------|----------------|-----------|-------|------------|
| 1 | **R1I-d.2B-I1c-X2** — QR directory contract alignment | 1 | A (contract-only) | none |
| 2 | **R1I-d.2B-I1c-X3** — Agents contract + runtime (agents + agent transactions) | 3, 4 | B | d.1F foundation; requires separate security-scope ratification for endpoint 4 |
| 3 | **R1I-d.2B-I1c-X4** — Webhooks DLQ list runtime + contract | 2 | B (missing runtime) | admin auth review; new admin route in `admin-webhooks` or dedicated function |
| 4 | **R1I-d.2B-I1c-X5** — CEMAC corridors bounded-exemption ratification | 5 | C | requires d.0 §9 ratification vote before any file edit |

Each slice must be authorised on its own; none is authorised by this document.

---

## 9. Exact permitted files proposed for each future slice

Only the files listed here would be in scope for that slice. All other paths
would be prohibited. This section is a *proposal* only.

### 9.1 R1I-d.2B-I1c-X2 (QR directory contract alignment)

Permitted:
- `public/openapi.json`
- `public/openapi.yaml`
- `src/test/openapi-pagination-coverage.test.ts` (only if a targeted assertion
  is added; the ratchet itself is unchanged)
- `docs/audits/phase-1/phase-1b-r1i-d2b-i1c-x2-*.md`
- `CHANGELOG.md`, `public/CHANGELOG.md`, `public/changelog.json`

Prohibited:
- `supabase/functions/merchants-qr-directory/*` (runtime unchanged in X2)
- every protected d.2A / d.2B / I1c artifact.

### 9.2 R1I-d.2B-I1c-X3 (Agents runtime + contract)

Permitted:
- `supabase/functions/agent-banking/index.ts`
- `supabase/functions/gateway-query/_pagination-d2b.ts` (import only; **byte-identity preserved**) — if the adapter is reused, the reuse must be as a shared import; no edits.
- new isolated adapter `supabase/functions/agent-banking/_pagination-agents.ts` (preferred, to avoid coupling to d.2B)
- new migration + concurrent operation for the two agent indexes
- `public/openapi.json`, `public/openapi.yaml`
- `src/test/pagination-agents-*.test.ts`
- `docs/audits/phase-1/phase-1b-r1i-d2b-i1c-x3-*.md`
- CHANGELOG trio

Prohibited: every protected baseline listed in AGENTS.md §5.

### 9.3 R1I-d.2B-I1c-X4 (Webhook DLQ list)

Permitted:
- new function `supabase/functions/admin-webhook-dlq-list/index.ts`
  (do **not** modify `admin-webhook-dlq-replay` — protected by its own
  audit surface)
- new migration + concurrent index on `webhook_inbox_dlq`
- `public/openapi.json`, `public/openapi.yaml`
- `src/test/pagination-webhook-dlq-*.test.ts`
- `docs/audits/phase-1/phase-1b-r1i-d2b-i1c-x4-*.md`
- CHANGELOG trio

Prohibited: `admin-webhook-dlq-replay/*`, `webhook-inbox-retry-worker/*`,
every protected baseline.

### 9.4 R1I-d.2B-I1c-X5 (CEMAC bounded exemption)

Permitted (contingent on separate d.0 §9 ratification):
- `public/openapi.json`, `public/openapi.yaml` — add
  `x-bounded-collection: { max_items: 36, justification: "..." }` and
  `Cache-Control` guidance.
- `src/test/openapi-pagination-coverage.test.ts` — teach the ratchet to
  respect `x-bounded-collection`.
- `docs/audits/phase-1/phase-1b-r1i-d2b-i1c-x5-*.md`
- CHANGELOG trio

Prohibited: `remittance-outbound/*`, `remittance-engine/*`, every protected
baseline.

---

## 10. Stop conditions and unresolved decisions

1. **Bounded-exemption ratification.** d.0 §9 lists the exemption model as
   PROPOSED, not RATIFIED. Slice X5 cannot begin until §9 is formally
   ratified.
2. **Security-scope change on `agentTransactionList`.** The change from
   anon-readable to bearer-required is a breaking security change and must
   be authorised separately from the pagination change.
3. **`count` field deprecation policy.** Removal breaks Guardian Standing
   Order 4 (Surgeon Rule) unless done as a two-step deprecation. Chief
   Architect must confirm whether X3 emits `count: <page length>` deprecated
   for one minor or removes it under a major bump.
4. **Cursor-signing secret rotation** is explicitly deferred by d.1F §
   Deferred and must not be introduced by any X-slice.
5. **Managed Supabase access remains 0** for this inventory; index creation
   in §6 requires a separate authorised slice with its own migration review.
6. **Provider-token wrapping** (Nium etc.) is unrelated to any of the five
   endpoints and remains out of scope.

---

## 11. Preserved invariants (verified read-only)

| Invariant | Value | Preserved |
|-----------|-------|-----------|
| `info.version` | `4.53.1` | YES |
| Release status | Unreleased | YES |
| Operation count | 483 | YES |
| OpenAPI gate total | 176 | YES |
| Lint ceiling | 5586 | YES |
| Protected d.2A baseline | commit `f05c128a...` | UNCHANGED |
| Protected I1a foundation | commit `aa8124e5...` | UNCHANGED |
| Protected I1b runtime | commit `1485c559...` | UNCHANGED |
| Protected I1c contract | prior closure | UNCHANGED |
| Managed Supabase access | 0 | YES |
| Deployment | NONE | YES |

No OpenAPI, runtime, test, migration, workflow, SDK, changelog, package, or
`AGENTS.md` file was modified by this inventory.

---

## 12. Verdict

**PHASE 1B-R1I-d.2B-I1c-X1 FORENSIC INVENTORY READY FOR REVIEW.**

The coverage ratchet is NOT fixed by this document. No implementation slice
is begun. R1I-d.2B-I1d remains NOT AUTHORISED.
