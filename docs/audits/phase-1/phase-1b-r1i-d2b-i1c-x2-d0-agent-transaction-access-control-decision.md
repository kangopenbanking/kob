# Phase 1B — R1I-d.2B-I1c-X2-D0 — Agent Transaction Access-Control Decision

**Scope:** Binding, read-only access-control ratification for exactly one
operation:

| Field | Value |
|-------|-------|
| Method + path | `GET /v1/agents/{agentId}/transactions` |
| operationId | `agentTransactionList` |
| Runtime | `supabase/functions/agent-banking/index.ts` |
| Primary data source | `public.agent_cash_transactions` |
| Ownership source | `public.agents.user_id` (nullable UUID, no institution linkage present) |
| Active API version | `4.53.1` (Unreleased) |
| Base commit | `e5d7440e4bfc46d6bec393a74c433c3497113e51` |

No runtime, OpenAPI, migration, RLS, test, workflow, or dependency file is
modified by this document. This is a read-only decision record.

---

## 1. Repository inventory

### 1.1 Runtime evidence — `supabase/functions/agent-banking/index.ts`

- **Router match (lines 335–348).** The transactions route is matched by
  `req.method === "GET" && tail.length === 3 && tail[2] === "transactions"`.
  It validates `agentId` as UUID with `UUID_RE`, parses `limit` capped at 200,
  runs the collection query, and returns `{ data, count }`.
- **Supabase client construction (lines 61–64).** A single client is created
  with `SUPABASE_SERVICE_ROLE_KEY`. There is no caller-scoped client. The
  runtime never falls back to the anon key.
- **Anonymous access is currently allowed on this route.** The block at
  lines 66–73 only sets `userId` if a bearer token is present; it is never
  consulted before the transactions query. The route reaches the collection
  query with `userId === null` when the caller sends no `Authorization`
  header.
- **Agent filtering.** `.eq("agent_id", agentId)` is the only scope predicate.
  There is no ownership check against `public.agents`, no institution check,
  no admin check, no customer-of-record check.
- **Response shape.** `{ data: AgentCashTransaction[], count: integer }`.
  No pagination envelope (`pagination`, `meta`, `X-Pagination-*`), no cursor,
  no `has_more`. This matches the X1 inventory reclassification (Class B —
  RUNTIME_AND_CONTRACT_DEFECT).
- **Error handling.** Only `500 TX_LIST_FAILED` (query error) and the outer
  `500 INTERNAL` catch. No `401`, no `403`, no `404` on this route.
- **Logging.** No structured audit or security log for the read.
- **CORS.** `corsHeaders` with `Access-Control-Allow-Origin: *` and permissive
  `Authorization, apikey, content-type` allow-list. `OPTIONS` returns 200.

### 1.2 OpenAPI evidence — `public/openapi.json` lines 166052–166123

- Path key `/v1/agents/{agentId}/transactions`.
- `operationId: agentTransactionList`.
- Parameters: `agentId` (path, uuid), `limit` (query, 1..200 default 50),
  `Accept-Language` (header, optional). No pagination parameters, no
  filter parameters.
- **`security` block is absent on the operation and there is no
  document-global `security`.** In this specification's convention (see
  `src/test/openapi-security-declared.test.ts`) the absence of both is a
  security ratchet violation, but the operation currently ships that way.
  The effective declared posture is *no authentication required*.
- Only response defined: `200`. No `400`, no `401`, no `403`, no `404`,
  no `500`. No `X-Pagination-*` headers.

### 1.3 Identity and role sources present in the repository

| Source | Evidence | Usable for this endpoint |
|--------|----------|--------------------------|
| Supabase JWT via `supabase.auth.getUser(bearer)` | agent-banking `index.ts` lines 69–73 | Yes — establishes `auth.uid()` |
| `public.user_roles` + `public.has_role(_user_id, _role)` (SECURITY DEFINER) | Referenced by `agents` RLS "Admins manage all agents" | Yes — platform admin |
| `public.agents.user_id` (nullable UUID) | `supabase/migrations/20260529025727_...sql` line 12 and `idx_agents_user_id` | Yes — agent self |
| `public.agent_cash_transactions.customer_user_id` | Same migration, line 87; policy "Customers view their own agent transactions" | Yes — customer of record |
| `identity_memberships` | Cited in `docs/identity/security-posture.md`; unused by `agents` schema | **No linkage to `public.agents`** |
| `institutions`, `staff_assignments` | Referenced by other domains | **No linkage to `public.agents`** |
| API clients / OAuth scopes | `oauth-token`, `api_clients`, `credit_api_clients` | **Not wired to this route** |

**Conclusion.** The repository binds an agent to exactly one authenticated
subject through `agents.user_id`. There is no institution, branch, merchant,
or operator column on `public.agents`. Any decision that authorises
"institution staff" or "API client acting for an institution" on this
endpoint requires a schema linkage that does not exist today.

### 1.4 Agent ownership model resolution

- Present: `agents.user_id` (nullable), `agents.status`
  (`pending|active|suspended|terminated`), `agents.approved_at`,
  `agents.approved_by`.
- Absent: `institution_id`, `branch_id`, `merchant_id`, `operator_id`,
  `owner_user_id` (distinct from `user_id`).
- Mapping `agentId → authorised caller`: only through
  `agents.user_id = auth.uid()` or `has_role(auth.uid(), 'admin')`.

### 1.5 Database policies on `public.agent_cash_transactions`

- RLS **enabled** (migration line 108).
- SELECT policies (authenticated only):
  1. `"Admins view all agent transactions"` — `has_role(auth.uid(), 'admin')`.
  2. `"Agents view their own transactions"` — `EXISTS (SELECT 1 FROM
     public.agents a WHERE a.id = agent_cash_transactions.agent_id AND
     a.user_id = auth.uid())`.
  3. `"Customers view their own agent transactions"` —
     `auth.uid() = customer_user_id`.
- Grants: `SELECT` to `authenticated`; `ALL` to `service_role`. No grant
  to `anon`.
- Indexes: `idx_agent_cash_tx_agent_id`, `idx_agent_cash_tx_customer`,
  `idx_agent_cash_tx_created_at (DESC)`, `idx_agent_cash_tx_status`.
- Foreign key: `agent_id → public.agents(id) ON DELETE RESTRICT`.
- No views, no RPCs, no SECURITY DEFINER functions expose this table.

RLS is well-formed. It is bypassed today only because the edge function
holds a `service_role` client.

---

## 2. Current anonymous financial-data exposure

**Verified: YES.** An unauthenticated caller who guesses or enumerates a
valid `agentId` UUID currently receives the full transaction list including
`customer_msisdn`, `customer_user_id`, `amount`, `currency`,
`commission_amount`, `tx_type`, `status`, `idempotency_key`, and `reference`.
No credential is required. This exposure must be closed before X3.

---

## 3. Threat model

| # | Threat | Rating | Required control |
|---|--------|--------|------------------|
| T1 | Anonymous enumeration of agent transactions | **CRITICAL** | Bearer authentication required; 401 for missing/invalid credentials |
| T2 | Horizontal read across agents by an authenticated user | **HIGH** | Ownership check on `agents.user_id = auth.uid()` before collection query |
| T3 | Cross-institution read | HIGH → **UNRESOLVED** | Institution model is absent; institutional access is not authorised in this decision |
| T4 | Read from a suspended / terminated agent | MEDIUM | Deny reads when `agents.status ∈ {suspended, terminated}` for non-admin callers |
| T5 | Platform-admin misuse | MEDIUM | Restrict to `has_role(auth.uid(), 'admin')`; audit every admin read |
| T6 | Service-role bypass via unauthenticated public route | **CRITICAL** | Runtime must not perform the collection query on behalf of an unauthenticated caller (Model B in §7) |
| T7 | Cursor replay / leak | MEDIUM | Signed cursor with scope binding (§9) |
| T8 | Timing-oracle for agent existence | MEDIUM | Uniform 404 masking for non-existent, foreign, and unauthorised-known agents (§6) |
| T9 | Excessive metadata exposure | MEDIUM | Response schema tightening deferred to X3; do not add fields in D0 |
| T10 | Bulk-read abuse | MEDIUM | `limit` cap 200 (unchanged) plus rate limiting per §11 |
| T11 | Log leakage of cursor / bearer / service key | HIGH | Log allow-list in §10 |
| T12 | Stale role or membership after revocation | MEDIUM | Cursor invalidation on role change (§8) |
| T13 | Deleted or transferred agent | LOW | `ON DELETE RESTRICT` on FK; 404-mask when `agents` row missing |
| T14 | Cursor issued for agent A replayed on agent B | HIGH | `agentId` in cursor scope tuple (§8) |
| T15 | Cursor issued in sandbox replayed against production | HIGH | `environment` in cursor scope tuple (§8) |

---

## 4. Binding access matrix

Every caller category is resolved. No category is left conditional on
future work except where the repository lacks the linkage to bind a rule
safely; those cases are documented as **DENY (repository does not support
authorisation)** rather than "conditional".

| # | Caller category | Decision | Relationship required |
|---|-----------------|----------|-----------------------|
| 1 | Anonymous | **DENY** | 401 with `WWW-Authenticate: Bearer` |
| 2 | Authenticated ordinary user (no relationship to `agentId`) | **DENY** | Masked 404 |
| 3 | Agent reading their own transactions | **CONDITIONAL — ALLOW** | `EXISTS (SELECT 1 FROM public.agents a WHERE a.id = :agentId AND a.user_id = auth.uid() AND a.status = 'active')` |
| 4 | Another agent (authenticated but not linked to `agentId`) | **DENY** | Masked 404 |
| 5 | Institution staff member | **DENY (repository does not support authorisation)** | No `institution_id` column on `public.agents`; no `staff_assignments` linkage to agents. Authorising this category requires a new schema linkage which is out of scope for D0 and X2. |
| 6 | Institution administrator | **DENY (repository does not support authorisation)** | Same as row 5 |
| 7 | Platform administrator | **CONDITIONAL — ALLOW** | `has_role(auth.uid(), 'admin')` verified through the existing SECURITY DEFINER `public.has_role` |
| 8 | Internal worker / service account | **DENY on the public endpoint** | Service-role must not be reachable via the public HTTP route. Internal workloads that need this data must use a dedicated internal function, not `agentTransactionList` |
| 9 | API client acting for an institution | **DENY (repository does not support authorisation)** | Same as row 5; no OAuth scope currently maps to agent transactions and no institution linkage exists |
| 10 | Suspended / disabled caller | **DENY** | If the authenticated subject has `status = 'suspended'` on the underlying agent row, deny with masked 404 |

Categories 5, 6, and 9 are **not** deferred to X3; they are denied by this
decision. They may be revisited in a separately authorised slice that first
introduces the required schema linkage.

---

## 5. Recommended minimum security posture — ratified

- **Authentication (RATIFIED).** Bearer authentication required. Anonymous
  access denied. Caller identity is taken only from a JWT verified by
  `supabase.auth.getUser(bearer)` or from a first-party API credential
  bound to a Supabase user. `agentId` in the path is never treated as
  authority.
- **Agent-self access (RATIFIED).** Allowed only when
  `agents.user_id = auth.uid()` and `agents.status = 'active'`.
- **Institution access (REJECTED for this slice).** Repository lacks the
  linkage. Do not infer institution authority from JWT claims.
- **Platform administrator (RATIFIED).** Allowed via `has_role(auth.uid(),
  'admin')` only. A `service_role` key alone must not establish human
  admin authority.
- **Internal workers (REJECTED on the public endpoint).** No generic
  service-role access through `agentTransactionList`.

---

## 6. Existence masking — ratified matrix

Exactly one matrix is bound.

| Condition | Status |
|-----------|--------|
| No bearer / invalid bearer / expired bearer | **401** with `application/problem+json` and `WWW-Authenticate: Bearer` |
| Syntactically invalid `agentId` (non-UUID) | **400 `INVALID_AGENT_ID`** (preserves current behaviour) |
| Well-formed `agentId`, agent does not exist | **404 `AGENT_NOT_FOUND`** (masked) |
| Well-formed `agentId`, agent exists but caller has no relationship | **404 `AGENT_NOT_FOUND`** (masked; identical body to previous row) |
| Caller is a linked agent but agent status ∈ {`pending`,`suspended`,`terminated`} | **404 `AGENT_NOT_FOUND`** (masked) |
| Caller is authenticated, denied by explicit platform policy unrelated to resource ownership (e.g. globally revoked role) | **403 `FORBIDDEN`** |
| Caller succeeds all checks | **200** with paginated envelope (defined in X2) |

"404 or 403 unresolved" is closed. The default denial is **404 masked**;
`403` is reserved for platform-policy denial that is not tied to resource
ownership.

---

## 7. Selected enforcement model

**Model B — Runtime performs an explicit ownership check; the collection
query runs under a tightly controlled server credential.**

Rationale:
- Model A (RLS-authoritative under a caller-scoped client) is architecturally
  clean but requires refactoring `agent-banking` to construct a
  per-request client from the caller JWT, which touches five other routes
  in the same file (float top-up/withdraw, cash-in, cash-out, single-agent
  read). D0 must not force that scope onto X2.
- Model C (SECURITY DEFINER RPC) requires a new database function and a
  migration. D0 must not create migrations.
- Model B preserves the existing service-role runtime pattern for
  agent-banking, requires **no migration**, and closes the anonymous
  exposure with a bounded runtime change confined to
  `agentTransactionList`.

### 7.1 Ownership check (specified for X2, not implemented in D0)

Before any query against `agent_cash_transactions`, X2 must execute
exactly one authorised-ownership resolution:

```
authorised :=
  has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = :agentId
      AND a.user_id = auth.uid()
      AND a.status = 'active'
  )
```

If `authorised` is false, return the masked 404 defined in §6 **without
issuing any query against `agent_cash_transactions`**.

### 7.2 Defence in depth

- Preserve RLS as-is. Do not add a `service_role` USING/WITH CHECK policy.
  Do not weaken existing policies.
- The service-role collection query in X2 must include a redundant
  `.eq("agent_id", agentId)` predicate (already present) and must never
  omit the ownership pre-check.
- The runtime must never accept `X-User-Id`, `X-Agent-Id`, or any
  caller-supplied identity header.

### 7.3 Role grants (no change required for Model B)

| Role | Current | Required |
|------|---------|----------|
| `anon` | no grant | no grant |
| `authenticated` | `SELECT` on `agent_cash_transactions` | unchanged |
| `service_role` | `ALL` | unchanged |

### 7.4 Test obligations (test plan in §14)

Model B requires that X2 tests explicitly assert:
- no `agent_cash_transactions` SELECT is executed when ownership fails;
- the runtime does not read `service_role` collection data through the
  public route for anonymous or unauthorised callers.

---

## 8. Cursor security binding

**Canonical scope tuple (ordered):**

```
(environment, operationId, authenticatedSubjectId, authenticatedRole, targetAgentId)
```

- `environment` — `sandbox` | `production` (existing d.2B convention).
- `operationId` — literal string `agentTransactionList`.
- `authenticatedSubjectId` — `auth.uid()` of the caller who issued the
  cursor.
- `authenticatedRole` — the caller's effective role at issuance:
  `admin` | `agent_self`. Institutional roles are not included because
  they are denied by §4.
- `targetAgentId` — the `agentId` path parameter as issued.

`institutionId` and `apiClientId` are **excluded** because institution and
API-client authorisation are denied by §4. Adding them now would encode
authority the runtime does not honour.

**Filter hash tuple:** `EMPTY`. The endpoint currently has no filter
parameters. Adding hypothetical filters is out of scope for D0 (per §9 of
the prompt).

**Invalidation.** Any mismatch between a cursor's canonical scope tuple
and the current request context returns
`400 PAGINATION_CURSOR_SCOPE_MISMATCH`, per the shared d.2B pattern.
Specifically:
- role change (admin ↔ agent_self) invalidates;
- subject change invalidates;
- target agent change invalidates;
- environment change invalidates.
Institution change is not a factor because institution is not in the tuple.

---

## 9. Status and lifecycle rules

| Condition | Access to historical transactions |
|-----------|-----------------------------------|
| Agent `pending` | Denied for agent-self (masked 404). Allowed for admin. |
| Agent `active` | Allowed per §4. |
| Agent `suspended` | Denied for agent-self (masked 404). Allowed for admin. |
| Agent `terminated` | Denied for agent-self (masked 404). Allowed for admin. |
| Agent row deleted | 404 `AGENT_NOT_FOUND`. `ON DELETE RESTRICT` on the FK means the row cannot be deleted while transactions exist, so this case is protected today. |
| Institution suspended | Not applicable — institutional access is denied by §4. |
| Institution-agent membership expired | Not applicable — no institutional access. |
| Caller's admin role revoked | Effective immediately at the next `has_role` call. Cursors issued under `authenticatedRole = admin` become invalid because the current caller no longer resolves to that role. |

---

## 10. Audit logging — ratified

Every successful and denied read of this endpoint must emit exactly one
security audit event to `security_audit_logs`.

| Event name | Emitted when |
|------------|--------------|
| `agent_transaction_list.read` | 200 response |
| `agent_transaction_list.denied` | 401, 403, or 404 (masked) responses |

Fields (allow-list):
- `event_name`
- `actor_user_id` (nullable when the request is anonymous)
- `target_agent_id`
- `institution_id` — always `NULL` for this operation
- `outcome` — `allowed` | `denied`
- `denial_reason_category` — one of `unauthenticated`,
  `agent_not_found_or_unowned`, `agent_status_ineligible`,
  `platform_policy`, `cursor_scope_mismatch`
- `request_id` / `x-fapi-interaction-id`
- `timestamp`
- `pagination_mode` — `cursor` | `offset_deprecated`
- `cursor_present` — boolean
- Cursor values are **excluded** from logs.
- Retention: standard security audit retention (existing policy on
  `security_audit_logs`); no PII beyond the target `agentId`.

Explicit prohibitions:
- Never log full cursor tokens.
- Never log cursor HMAC signatures.
- Never log transaction payloads (`amount`, `customer_msisdn`,
  `customer_user_id`, `idempotency_key`).
- Never log bearer tokens or service-role keys.

---

## 11. Rate limiting and abuse controls — required for X3

Not implemented in D0. X3 must ship the following:

- Per-subject limit: `120 requests / minute` on `agentTransactionList`.
- Per-institution limit: **not applicable** for this operation because
  institutional callers are denied.
- `limit` parameter maximum: **200** (unchanged from OpenAPI).
- Enumeration protection: masked 404 (§6) combined with per-subject rate
  limit; consider a lower **denial-rate** threshold (e.g. 30 denials/min
  per subject) to trip an alert.
- Monitoring thresholds: alert when a single subject exceeds 300
  distinct `agentId` denials in any 5-minute window.
- Rate-limit exhaustion response: `429 Too Many Requests` with
  `Retry-After`, following the existing gateway convention.

---

## 12. RLS decision

**Selected: Model B (see §7).**

- Fit: preserves the current service-role runtime pattern of
  `agent-banking/index.ts` and confines the change to
  `agentTransactionList`. Model A would require refactoring five sibling
  routes; Model C would require a new SECURITY DEFINER function and
  migration; both are out of scope for D0.
- Future migration or policy changes required: **none.** RLS on
  `agent_cash_transactions` remains as-is.
- Role grants: unchanged (§7.3).
- Service-role restrictions: the service-role collection query is guarded
  by an explicit ownership pre-check in the runtime and is not reachable
  by an unauthenticated caller.
- Defence in depth: preserve RLS unchanged; redundant `.eq("agent_id", …)`
  in the collection query; reject caller-supplied identity headers.
- Test obligations: §14.

---

## 13. API compatibility

- Current declared posture: **anonymous** (no `security` on the operation,
  no global `security`).
- Published SDKs: Node/Python/PHP clients follow whatever the OpenAPI
  declares. Since the operation currently declares no security, some
  clients may not attach credentials.
- Requiring bearer authentication **is a contract-tightening change** for
  callers who currently call the endpoint without credentials. Under the
  active `4.53.1` **Unreleased** status, correcting this is permitted
  without a version increment because no released contract has yet been
  published with the anonymous declaration.
- No version change is prescribed. `info.version` remains `4.53.1`.
  A deprecation window is not required because the current posture is a
  security defect, not a supported contract.

Compatibility treatment: **CORRECT UNDER UNRELEASED STATUS**. X2 declares
bearer authentication, adds 400/401/403/404/500 responses, and the
paginated envelope. No SDK republish required until the next scheduled
release.

---

## 14. Required future X3 test matrix (specification only)

X2 or X3 (per the eventual slice split) must add tests covering:

1. Missing bearer token → `401`, no DB query executed.
2. Invalid / expired bearer token → `401`.
3. Malformed `agentId` (non-UUID) → `400 INVALID_AGENT_ID`, no DB query
   against `agent_cash_transactions`.
4. Non-existent `agentId` (UUID valid, no agent row) → masked `404`.
5. Foreign agent (caller authenticated, no linkage) → masked `404`
   with **identical body** to the non-existent case (parity test).
6. Agent self-access (caller = `agents.user_id`, status `active`) →
   `200` with paginated envelope; ownership check invoked exactly once.
7. Agent self-access when `agents.status ∈ {pending,suspended,terminated}`
   → masked `404`.
8. Same-institution "authorised" staff → masked `404` (institutional
   access is denied by §4; this test asserts the denial).
9. Same-institution "unauthorised" staff → masked `404` (same).
10. Cross-institution administrator → masked `404` (institutional
    access denied).
11. Platform administrator (`has_role admin`) reading any agent → `200`.
12. Suspended platform administrator (role revoked) → masked `404`.
13. Revoked institutional membership → masked `404` (denial by §4).
14. Ownership-query failure (simulated DB error) → `500`, no collection
    query executed.
15. Collection-query failure (simulated after successful ownership) →
    `500`, no data leakage in the error body.
16. Assertion: no `agent_cash_transactions` SELECT is executed for any
    401/403/404 path (spy on the client).
17. Cursor scope mismatch after role change (admin → agent_self) →
    `400 PAGINATION_CURSOR_SCOPE_MISMATCH`.
18. Cursor scope mismatch after subject change → same.
19. Cursor scope mismatch across environments → same.
20. Cursor for `agentId=A` replayed with `agentId=B` → same.
21. Service-role misuse: the public route must reject any request that
    lacks a valid caller JWT even if the caller possesses the
    service-role key.
22. Audit event emission: exactly one `security_audit_logs` row per
    request, with the allow-list fields from §10 and no cursor tokens
    or signatures logged.
23. Rate-limit exhaustion → `429` with `Retry-After`.
24. No cursor value in any log line (grep assertion in test output).

This is a plan. No tests are created in D0.

---

## 15. Binding decision record

- **Authentication:** Bearer required; anonymous denied.
- **Authorised caller categories:** (a) agent-self linked via
  `agents.user_id = auth.uid()` with `agents.status = 'active'`;
  (b) platform administrator via `has_role(auth.uid(), 'admin')`. All
  others denied.
- **Agent-self rule:** ALLOW when `agents.user_id = auth.uid()` and
  `agents.status = 'active'`.
- **Institution rule:** DENY. Repository does not link agents to
  institutions.
- **Platform-admin rule:** ALLOW when `has_role(auth.uid(), 'admin')`.
- **Internal-service rule:** DENY on the public endpoint. Internal
  workloads must not use `agentTransactionList`.
- **Ownership source:** `public.agents.user_id` (plus `agents.status`
  gate); admin path uses `public.user_roles` via `public.has_role`.
- **Existence masking:** 401 unauthenticated · 400 malformed UUID ·
  404 masked for non-existent, foreign, unowned, and status-ineligible ·
  403 only for platform-policy denial unrelated to resource ownership.
- **Selected RLS/runtime model:** **B** — runtime ownership pre-check +
  service-role collection query; RLS unchanged.
- **Cursor scope tuple:** `(environment, operationId,
  authenticatedSubjectId, authenticatedRole, targetAgentId)`.
- **Filter hash tuple:** `EMPTY`.
- **Agent lifecycle rule:** Historical reads denied for agent-self when
  status ∈ {pending, suspended, terminated}. Admin retains access at all
  statuses.
- **Institution lifecycle rule:** Not applicable — institutional access
  denied.
- **Audit events:** `agent_transaction_list.read` (200);
  `agent_transaction_list.denied` (401/403/404). Fields per §10.
- **Rate-limit requirement:** 120 req/min per subject; 429 with
  `Retry-After` on exhaustion. Implemented in X3.
- **Compatibility treatment:** Correct under `4.53.1` Unreleased status;
  no version change; no SDK republish required until next scheduled
  release.
- **X3 implementation permitted after this decision:** **YES** — the
  runtime scope is bindable with the current repository; X2 remains the
  next authorised step under the sequence in the accepted X1 inventory.
- **Unresolved prerequisites:** NONE for the ratified access matrix.
  Institutional / API-client authorisation for this endpoint is
  explicitly denied by this decision and is not a prerequisite for X2 or
  X3; it would require a separately authorised slice that first adds an
  agent-institution linkage to `public.agents`.

---

## 16. Invariants preserved

| Invariant | Value | State |
|-----------|-------|-------|
| API version | 4.53.1 | unchanged |
| Release status | Unreleased | unchanged |
| Operation count | 483 | unchanged |
| OpenAPI gate total | 176 | unchanged |
| Lint ceiling | 5586 | unchanged |
| Protected d.2A baseline | intact | unchanged |
| Protected d.2B-I1a foundation | intact | unchanged |
| Protected d.2B-I1b runtime | intact | unchanged |
| Managed Supabase access | 0 | none performed |
| Deployment | none | none performed |

---

**Status:** PHASE 1B-R1I-d.2B-I1c-X2-D0 SECURITY DECISION READY FOR REVIEW
