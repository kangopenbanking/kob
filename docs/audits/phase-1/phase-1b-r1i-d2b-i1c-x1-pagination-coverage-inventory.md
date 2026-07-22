# Phase 1B — R1I-d.2B-I1c-X1 — Pagination-Coverage Forensic Inventory

**Status:** READ-ONLY forensic inventory (corrected under R1I-d.2B-I1c-X1-R1).
No implementation is authorised by this document. No OpenAPI, runtime,
migration, SDK, workflow, or test file was modified.

**Reviewed base commit (X1):** `d68c8b48ec17ce063280bc0520feef33374f16b8`
**Correction base commit (X1-R1):** `215e9e7b1fa53e74b5c7bb981e54f8ca5f421ef7`


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

**Corrected in R1I-d.2B-I1c-X1-R1.** All five endpoints are reclassified as
**RUNTIME_AND_CONTRACT_DEFECT**. The prior draft's "contract-only" and
"bounded-collection candidate" classifications were incorrect: neither the QR
directory runtime envelope nor CEMAC's cardinality argument satisfy the
canonical `PaginatedResponse` contract or d.0 §9's evidentiary bar.

Corrected executive totals:

| Metric | Value |
|--------|-------|
| Endpoint inventory | 5/5 |
| Operation IDs resolved | 5/5 |
| Exact GET runtime handlers found | 3/5 |
| Missing exact GET runtimes | 2/5 (`GET /v1/webhooks/dlq`, `GET /v1/remittance/cemac/corridors`) |
| Exact runtime response shapes resolved | 3/5 |
| Contract-only defects | 0 |
| Runtime-and-contract defects | 5 |
| Ratified bounded collections | 0 |
| False-list classifications | 0 |
| Security-blocked operations | 1 (`agentTransactionList`) |

The `remittance-outbound` POST `get_corridors` action is **not** the runtime
for `GET /v1/remittance/cemac/corridors`. It is recorded only as the nearest
existing producer, never as endpoint runtime.

The coverage ratchet must be resolved as **five independent slices**, none of
which is authorised by this document. A contract-only OpenAPI change cannot
close the ratchet for any of these endpoints.

**No new failure was introduced by I1c.** All five failures are present at
the I1b baseline (commit `1485c559...`) and predate the d.2B program.


---

## 2. Five-endpoint inventory table

| # | Path | operationId | Tags | Runtime function | Route in function | Data source | Auth | Current 200 shape | Ordering | Tie-breaker | Limit clamp | Cursor | Offset | Total | Class |
|---|------|-------------|------|------------------|-------------------|-------------|------|-------------------|----------|-------------|-------------|--------|--------|-------|-------|
| 1 | `/v1/merchants/qr-directory` | `merchantsQrDirectoryList` | Payments | `merchants-qr-directory` | `Deno.serve` root | view `public.merchant_qr_directory` (filtered by `verified=true`) | Public (anon key) | `{ object:'list', data:[...], has_more, next_cursor }` inline — **does not satisfy `{ data, pagination, meta }`** | `merchant_id ASC` | `merchant_id` (UUID, unique) | 1–100, default 25 | raw UUID token bound to `merchant_id` (not HMAC-signed) | none | absent | **B — RUNTIME_AND_CONTRACT_DEFECT** |
| 2 | `/v1/webhooks/dlq` | `listWebhookDlq` | Webhooks | **no matching handler** (no `Deno.serve` route implements `GET /v1/webhooks/dlq`) | — | table `public.webhook_inbox_dlq` (referenced only by `admin-webhook-dlq-replay` and `webhook-inbox-retry-worker`) | `bearerAuth` (spec) | **N/A — advertised GET runtime absent** | N/A | N/A | spec: `limit` 1..? | spec: `cursor` | none | absent | **B — RUNTIME_AND_CONTRACT_DEFECT** (runtime missing) |
| 3 | `/v1/agents` | `agentList` | Agents | `agent-banking` | `GET .../agents` (tail length 1) | table `public.agents` | Public (anon key; no `security` on op) | `{ data:[...], count }` | none (no `.order()` clause) | none | 1–200, default 50 | none (spec advertises `CursorParam`/`StartingAfter`/`EndingBefore` but runtime ignores them) | none | `count` = current page length (not exact total) | **B — RUNTIME_AND_CONTRACT_DEFECT** |
| 4 | `/v1/agents/{agentId}/transactions` | `agentTransactionList` | Agents | `agent-banking` | `GET .../agents/:agentId/transactions` (tail length 3) | table `public.agent_cash_transactions` | Public (anon key on op; runtime does not enforce tenant scoping beyond `agent_id` filter) | `{ data:[...], count }` | `created_at DESC` | none (no `id` tie-breaker) | 1–200, default 50 | none | none | `count` = current page length | **B — RUNTIME_AND_CONTRACT_DEFECT — BLOCKED ON SECURITY-SCOPE RATIFICATION** |
| 5 | `/v1/remittance/cemac/corridors` | `cemacCorridorsList` | CEMAC Remittance | **no dedicated GET runtime.** Nearest existing producer (not endpoint runtime): `remittance-outbound` POST action `get_corridors` returning `{ corridors:[...] }` from `public.remittance_corridors` | — | table `public.remittance_corridors` (filtered by partner status) | Public (no `security` on op) | **N/A — advertised GET runtime absent** | N/A | N/A | not declared in spec | spec declares `CursorParam`/`StartingAfter`/`EndingBefore`/`LimitParam` but response is a bare array (envelope-less) | none | absent | **B — RUNTIME_AND_CONTRACT_DEFECT** (bounded-exemption eligibility UNPROVEN) |

Corrected totals: **operation IDs 5/5, exact GET runtime handlers 3/5,
missing GET runtimes 2/5 (`/v1/webhooks/dlq`, `/v1/remittance/cemac/corridors`),
exact runtime response shapes 3/5.**


---

## 3. Contract / runtime mismatch analysis

### 3.1 `/v1/merchants/qr-directory` — B (corrected)

Runtime shape today:

```json
{ "object": "list", "data": [...], "has_more": true, "next_cursor": "<uuid>" }
```

This envelope **does not satisfy** the canonical `{ data, pagination, meta }`
contract required by d.0 §1 and the `PaginatedResponse` component. A
contract-only `$ref` swap would produce an OpenAPI response schema that does
not match the wire response. The prior draft's Class A classification is
withdrawn.

Full list of runtime changes required by the eventual X2 slice:

- adopt the canonical `{ data, pagination, meta }` envelope;
- emit `pagination.mode` (cursor);
- emit `pagination.has_more`;
- emit `pagination.next_cursor`;
- emit `pagination.limit`;
- emit `meta` object (observability data only, no authoritative totals);
- emit all four `X-Pagination-*` response headers
  (`Mode`, `Has-More`, `Next-Cursor`, `Limit`);
- expose those headers via `Access-Control-Expose-Headers`;
- replace the raw `merchant_id` UUID cursor with an HMAC-SHA-256 signed
  cursor per d.1F foundation;
- bind cursor to scope (`env`, `verified=true`) and filter hash
  (`country`, `category`);
- adopt deterministic keyset ordering with a unique final tie-breaker
  (see §5 for the exact recommended tuple);
- adopt limit+1 look-ahead finalisation for `has_more`;
- honour `limit` bounds 1..100, default 25.

Contract-only remediation **cannot** close the ratchet for this endpoint.

Available columns on `public.merchant_qr_directory` (from
`supabase/migrations/20260506234614_*.sql` and the runtime `.select(...)`):
`merchant_id`, `name`, `environment`, `status`, `mcc`, `country`, `logo_url`,
`verified`, `created_at`, `kob_wallet_id`, `wallet_currency`. `merchant_id`
is the underlying `gateway_merchants.id` (UUID, unique). `created_at` is
inherited from `gateway_merchants` via `security_invoker` view.


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

### 3.4 `/v1/agents/{agentId}/transactions` — B — BLOCKED ON SECURITY-SCOPE RATIFICATION

Same runtime shape as §3.3 but scoped to one `agentId`. Ordering is
`created_at DESC` without an `id` tie-breaker, so keyset pagination is unsafe:
two transactions with identical `created_at` values would either be skipped or
duplicated across pages. OpenAPI does not declare a cursor-style parameter
today (`hasCursor=false` in the ratchet report), unlike `agentList`.

**Implementation status: BLOCKED ON SECURITY-SCOPE RATIFICATION.** This
endpoint returns agent financial movements under anonymous access today. It
is not optional follow-up debt: the future implementation slice MUST NOT
proceed to runtime pagination or OpenAPI implementation until a binding
security decision closes covering all of:

- authenticated subject requirements (bearer/OIDC/API-key contract);
- agent-self access (may an agent read their own transactions?);
- institution administrator access (scope resolution rules);
- platform administrator access (admin role assertion);
- ownership resolution (`agent_id → institution_id`, `caller_id →
  institution_id`);
- masked 404 vs 403 for unowned `agent_id` (per d.2A precedent);
- RLS expectations on `public.agent_cash_transactions`;
- service-role restrictions (which callers, if any, may bypass RLS);
- audit-event emission requirements on read;
- cursor scope-hash inputs — MUST bind at minimum
  `(env, caller_id, agent_id, role)`.

Neither runtime pagination nor OpenAPI contract implementation may proceed
before this decision is ratified and recorded.

### 3.5 `/v1/remittance/cemac/corridors` — B (corrected; bounded-exemption UNPROVEN)

Response is declared as a plain JSON array of `CemacCorridor` objects.
**No dedicated `GET /v1/remittance/cemac/corridors` runtime exists** —
`remittance-outbound`'s POST action `get_corridors` is recorded here only as
the nearest existing producer and is **not** the endpoint runtime.

The prior draft's Class C classification is withdrawn. `6 × 6 = 36` is a
theoretical domain cardinality drawn from CEMAC membership; it is **not** an
enforceable database maximum. Bounded-exemption eligibility is UNPROVEN.

Evidence required before Class C may be ratified under d.0 §9 (all items
must be present and verified in writing):

1. exact column types on `public.remittance_corridors`
   (`origin_country`, `destination_country`, active flag, partner join key);
2. any `CHECK` constraints or database enum types restricting country codes;
3. an origin/destination uniqueness constraint (composite `UNIQUE` or PK);
4. partner/provider cardinality — whether one corridor row exists per partner
   or per (origin, destination) tuple;
5. duplicate-row possibility across active partners;
6. active/inactive record multiplicity;
7. the exact query projection the dedicated GET runtime would use;
8. the exact dedicated GET runtime implementation (does not exist today);
9. explicit maximum enforcement in schema/seed (not derived from ISO 3166);
10. a test proving the response can never exceed the proposed `max_items`.

Until every item above is present and verified, `max_items=36` MUST NOT be
claimed and `x-bounded-collection` MUST NOT be applied. Endpoint remains
classified **B — RUNTIME_AND_CONTRACT_DEFECT**; disposition (bounded GET,
paginated GET, or deprecation) is deferred to slice X5-D0.


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
| 1 | qr-directory | **cursor** (HMAC-signed per d.1F; raw-UUID cursor retired) | 25 | 100 | `(merchant_id ASC)` — single-column deterministic profile; `merchant_id` is the unique PK of the underlying `gateway_merchants` row surfaced by `public.merchant_qr_directory` and is its own final tie-breaker. `created_at` on the view is inherited via `security_invoker` and is not guaranteed non-null across historic rows, so it is unsuitable as a primary sort. Required index: existing PK on `gateway_merchants(id)` is sufficient; no new migration required for this ordering. | 1800 s | prohibited |
| 2 | webhooks/dlq | **cursor** | 25 | 100 | `(inserted_at DESC, id DESC)` | 1800 s | prohibited (per d.0 §6) |
| 3 | agents | **cursor** | 25 | 100 | `(created_at DESC, id DESC)` (canonical d.2S profile) | 1800 s | prohibited; drop `count` |
| 4 | agents/{id}/transactions | **cursor** | 25 | 100 | `(created_at DESC, id DESC)` | 1800 s | prohibited (financial listing per d.0 §6 forbidden-total list); drop `count` |
| 5 | cemac/corridors | **cursor** (default until X5-D0 ratifies boundedness) | 25 | 100 | `(origin_country ASC, destination_country ASC, id ASC)` where `id` is the unique tie-breaker on `public.remittance_corridors` | 1800 s | prohibited until bounded-exemption evidence is present |


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

The coverage ratchet must be resolved as seven ordered slices. Two are
read-only decision slices (`X2-D0`, `X5-D0`); the remainder are
implementation slices. **None is authorised by this document.**

| Order | Slice | Type | Endpoints | Class | Blocks / Depends on |
|-------|-------|------|-----------|-------|---------------------|
| 1 | **R1I-d.2B-I1c-X2-D0** — Agent transaction access-control ratification | Read-only security decision | 4 | B | Blocks X3; no runtime changes |
| 2 | **R1I-d.2B-I1c-X2** — QR directory runtime and contract canonicalisation | Runtime + contract (not contract-only) | 1 | B | d.1F foundation |
| 3 | **R1I-d.2B-I1c-X3** — Agent listings runtime, security, and contract implementation | Runtime + contract | 3, 4 | B | May begin only after X2-D0 closes |
| 4 | **R1I-d.2B-I1c-X4** — Webhook DLQ admin runtime and contract implementation | Runtime + contract | 2 | B (missing runtime) | admin auth review; new function; no edits to `admin-webhook-dlq-replay` |
| 5 | **R1I-d.2B-I1c-X5-D0** — CEMAC endpoint disposition and boundedness decision | Read-only decision | 5 | B | Decides between bounded GET, paginated GET, or deprecation/retraction |
| 6 | **R1I-d.2B-I1c-X5** — CEMAC implementation | Scope determined by X5-D0 | 5 | B | X5-D0 |
| 7 | **R1I-d.2B-I1d** — complete d.2B isolated verification | Verification | — | — | Only after the coverage ratchet is green |

Each slice must be authorised on its own; none is authorised by this
document. In particular this audit does not authorise `X2-D0`, `X2`, `X3`,
`X4`, `X5-D0`, `X5`, or `I1d`.


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

**PHASE 1B-R1I-d.2B-I1c-X1-R1 INVENTORY CORRECTION READY FOR REVIEW.**

The coverage ratchet is NOT fixed by this document. No implementation slice
is begun. `X2-D0`, `X2`, `X3`, `X4`, `X5-D0`, `X5`, and `I1d` all remain
NOT AUTHORISED.

