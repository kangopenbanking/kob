# Phase 1B — R1I-d.2B-I1c-X2-D0 — Agent Transaction Access-Control Decision

**Revision:** R2 (admin existence and audit-RPC privilege decision repair)
**Base commit under review:** `a9232e4e7cf7f9a042d2d07167602b99b36ab853`

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

No runtime, OpenAPI, migration, RLS, test, workflow, or dependency file is
modified by this document. This is a read-only decision record.

**Programme sequence (binding).** The accepted ordering after this D0 is:

1. **X2 — QR directory runtime and contract canonicalisation (QR only).**
   X2 does not touch `agentTransactionList` in any way.
2. **X3 — `agentList` and `agentTransactionList` implementation.** All
   agent runtime, OpenAPI, pagination, audit, rate-limit and test
   obligations described in this document belong to X3.
3. Later checkpoints X4, X5-D0, X5, I1d remain NOT AUTHORISED.

**This decision (X2-D0) closes the security prerequisite for X3.** It does
not authorise X2, X3, or any implementation. X3 remains **NOT AUTHORISED**
until X2 is closed.

---

## 1. Repository inventory

### 1.1 Runtime evidence — `supabase/functions/agent-banking/index.ts`

- **Router match.** The transactions route is matched by
  `req.method === "GET" && tail.length === 3 && tail[2] === "transactions"`.
  It validates `agentId` as UUID with `UUID_RE`, parses `limit` capped at
  200 (default 50), runs the collection query, and returns `{ data, count }`.
- **Supabase client construction.** A single client is created with
  `SUPABASE_SERVICE_ROLE_KEY`. There is no caller-scoped client. The
  runtime never falls back to the anon key. The service-role client does
  **not** carry any caller identity; it holds no `auth.uid()` of its own.
- **Anonymous access is currently allowed on this route.** The bearer
  handling block only sets a local `userId` variable if a bearer token is
  present; it is never consulted before the transactions query. The route
  reaches the collection query with no caller identity when the request
  omits `Authorization`.
- **Agent filtering.** `.eq("agent_id", agentId)` is the only scope
  predicate. There is no ownership check against `public.agents`, no
  institution check, no admin check.
- **Response shape.** `{ data: AgentCashTransaction[], count: integer }`.
  No pagination envelope, no cursor, no `has_more`, no `X-Pagination-*`
  headers. Matches X1's Class B (RUNTIME_AND_CONTRACT_DEFECT) finding.
- **Error handling.** Only `500 TX_LIST_FAILED` and the outer `500 INTERNAL`
  catch. No `401`, `403`, `404`, `429` on this route.
- **Logging.** No structured audit or security log for the read.
- **CORS.** `corsHeaders` with `Access-Control-Allow-Origin: *` and a
  permissive `Authorization, apikey, content-type` allow-list.

### 1.2 OpenAPI evidence — `public/openapi.json`

- Path key `/v1/agents/{agentId}/transactions`.
- `operationId: agentTransactionList`.
- Parameters: `agentId` (path, uuid), `limit` (query, 1..200 default 50),
  `Accept-Language` (header, optional). No pagination parameters.
- No `security` block on the operation and no document-global `security`.
  The effective declared posture is *no authentication required*.
- Only response defined: `200`. No `400`, `401`, `403`, `404`, `429`, `500`.

### 1.3 Identity and role sources present in the repository

| Source | Evidence | Usable for this endpoint |
|--------|----------|--------------------------|
| Supabase user Bearer JWT via `supabase.auth.getUser(bearer)` | agent-banking `index.ts` | Yes — establishes `verifiedSubjectId` |
| `public.user_roles` + `public.has_role(_user_id, _role)` (SECURITY DEFINER) | Referenced by `agents` RLS "Admins manage all agents" | Yes — platform admin resolution |
| `public.agents.user_id` (nullable UUID) | `supabase/migrations/…agents…sql`; `idx_agents_user_id` | Yes — agent self |
| `public.agent_cash_transactions.customer_user_id` | Same migration; policy "Customers view their own agent transactions" | Yes — customer-of-record (RLS only; not exposed on this endpoint) |
| `identity_memberships` | Cited in `docs/identity/security-posture.md`; unused by `agents` schema | **No linkage to `public.agents`** |
| `institutions`, `staff_assignments` | Referenced by other domains | **No linkage to `public.agents`** |
| API clients / OAuth scopes | `oauth-token`, `api_clients`, `credit_api_clients` | **Not wired to this route and no user-Bearer coupling exists for this operation** |

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
  `owner_user_id` distinct from `user_id`.
- Mapping `agentId → authorised caller`: only through agent-self
  (`agents.user_id = verifiedSubjectId`) or platform admin
  (`has_role(verifiedSubjectId, 'admin')`).

### 1.5 Database policies on `public.agent_cash_transactions` (existing database-policy evidence)

The following policy expressions are quoted verbatim from the migration and
represent **database-side RLS**, evaluated only when the request is executed
under a caller-scoped Supabase JWT client. They are **not** invoked by the
Model B runtime pseudocode in §7, which runs under a service-role client.

- RLS enabled.
- SELECT policies (authenticated only):
  1. `"Admins view all agent transactions"` — `has_role(auth.uid(), 'admin')`.
  2. `"Agents view their own transactions"` — `EXISTS (SELECT 1 FROM
     public.agents a WHERE a.id = agent_cash_transactions.agent_id AND
     a.user_id = auth.uid())`.
  3. `"Customers view their own agent transactions"` —
     `auth.uid() = customer_user_id`.
- Grants: `SELECT` to `authenticated`; `ALL` to `service_role`; no grant
  to `anon`.
- Indexes: `idx_agent_cash_tx_agent_id`, `idx_agent_cash_tx_customer`,
  `idx_agent_cash_tx_created_at (DESC)`, `idx_agent_cash_tx_status`.
- Foreign key: `agent_id → public.agents(id) ON DELETE RESTRICT`.

RLS is well-formed. It is bypassed today only because the edge function
holds a `service_role` client and does not perform an equivalent
runtime-side ownership check.

---

## 2. Current anonymous financial-data exposure

**Verified: YES.** An unauthenticated caller who guesses or enumerates a
valid `agentId` UUID currently receives the full transaction list
including `customer_msisdn`, `customer_user_id`, `amount`, `currency`,
`commission_amount`, `tx_type`, `status`, `idempotency_key`, and
`reference`. No credential is required. This exposure must be closed by
X3.

---

## 3. Threat model

| # | Threat | Rating | Required control |
|---|--------|--------|------------------|
| T1 | Anonymous enumeration of agent transactions | **CRITICAL** | Bearer authentication required; 401 for missing/invalid credentials |
| T2 | Horizontal read across agents by an authenticated user | **HIGH** | Runtime ownership check on `agents.user_id = verifiedSubjectId` before the collection query |
| T3 | Cross-institution read | **HIGH — controlled by categorical denial** because no repository-backed institution-to-agent relationship exists | Institution categories denied per §4; may be revisited only in a separately authorised future slice |
| T4 | Read from a suspended / terminated agent | MEDIUM | Deny agent-self reads when `agents.status ≠ 'active'`; admin retains access |
| T5 | Platform-admin misuse | MEDIUM | Restrict to `has_role(verifiedSubjectId, 'admin')`; audit every admin read |
| T6 | Service-role bypass via unauthenticated public route | **CRITICAL** | Runtime must not perform the collection query on behalf of an unauthenticated caller |
| T7 | Cursor replay / leak | MEDIUM | Signed cursor with scope binding (§8) |
| T8 | Timing-oracle for agent existence | MEDIUM | Uniform 404 masking for non-existent, foreign, unowned, and status-ineligible agents |
| T9 | Excessive metadata exposure | MEDIUM | Response schema tightening deferred to X3 |
| T10 | Bulk-read abuse | MEDIUM | Contract page-size cap 100 (X3) plus rate limiting per §11 |
| T11 | Log leakage of cursor / bearer / service key | HIGH | Log allow-list in §10 |
| T12 | Stale role or membership after revocation | MEDIUM | Cursor invalidation on role change (§8) |
| T13 | Deleted or transferred agent | LOW | `ON DELETE RESTRICT` on FK; 404-mask when `agents` row missing |
| T14 | Cursor issued for agent A replayed on agent B | HIGH | `targetAgentId` in cursor scope tuple (§8) |
| T15 | Cursor issued in sandbox replayed against production | HIGH | `environment` in cursor scope tuple (§8) |

---

## 4. Binding access matrix

| # | Caller category | Decision | Relationship required |
|---|-----------------|----------|-----------------------|
| 1 | Anonymous | **DENY** | 401 with `WWW-Authenticate: Bearer` |
| 2 | Authenticated ordinary user (no relationship to `agentId`) | **DENY** | Masked 404 |
| 3 | Agent reading their own transactions | **ALLOW** | `agents.id = targetAgentId AND agents.user_id = verifiedSubjectId AND agents.status = 'active'` |
| 4 | Another agent (authenticated but not linked to `agentId`) | **DENY** | Masked 404 |
| 5 | Institution staff member | **DENY** | Repository does not support authorisation; no `institution_id` on `public.agents`; no `staff_assignments` linkage to agents |
| 6 | Institution administrator | **DENY** | Same as row 5 |
| 7 | Platform administrator | **ALLOW** | `has_role(verifiedSubjectId, 'admin')` |
| 8 | Internal worker / service account | **DENY on the public endpoint** | Service-role must not be reachable via the public HTTP route |
| 9 | Institution API client | **DENY** | Same as row 5; no OAuth scope maps to agent transactions and no institution linkage exists |
| 10 | Suspended / disabled caller | **DENY** | Masked 404 when the underlying agent row is not `active` (agent-self path) |

Categories 5, 6, and 9 are denied by this decision. They may be revisited
only in a separately authorised future slice that first introduces the
required schema linkage.

---

## 5. Recommended minimum security posture — ratified

- **Authentication (RATIFIED).** Supabase user Bearer JWT verified through
  `supabase.auth.getUser` **only**. API clients without a valid user
  Bearer JWT are denied. `agentId` in the path is never treated as
  authority.
- **Agent-self access (RATIFIED).** Allowed only when
  `agents.user_id = verifiedSubjectId` and `agents.status = 'active'`.
- **Institution access (REJECTED for this slice).** Repository lacks the
  linkage. Do not infer institution authority from JWT claims.
- **Platform administrator (RATIFIED).** Allowed via
  `has_role(verifiedSubjectId, 'admin')` only. A `service_role` key alone
  must not establish human admin authority.
- **Internal workers (REJECTED on the public endpoint).** No generic
  service-role access through `agentTransactionList`.

---

## 6. Existence masking — ratified matrix

| Condition | Status |
|-----------|--------|
| No bearer / invalid bearer / expired bearer | **401** with `application/problem+json` and `WWW-Authenticate: Bearer` |
| Syntactically invalid `agentId` (non-UUID) | **400 `INVALID_AGENT_ID`** |
| Well-formed `agentId`, agent does not exist | **404 `AGENT_NOT_FOUND`** (masked) |
| Well-formed `agentId`, agent exists but caller has no relationship | **404 `AGENT_NOT_FOUND`** (masked; identical body to previous row) |
| Caller is the linked agent but agent status ∈ {`pending`,`suspended`,`terminated`} | **404 `AGENT_NOT_FOUND`** (masked) |
| Cursor scope mismatch | **400 `PAGINATION_CURSOR_SCOPE_MISMATCH`** |
| Rate-limit exhaustion | **429** with `Retry-After` |
| Caller is authenticated, denied by explicit platform policy unrelated to resource ownership (e.g. globally revoked role) | **403 `FORBIDDEN`** |
| Caller succeeds all checks | **200** with paginated envelope (to be defined in X3) |

The default denial is **404 masked**; `403` is reserved for platform-policy
denial that is not tied to resource ownership.

---

## 7. Selected enforcement model

**Model B — Runtime performs an explicit ownership check using an
explicitly-carried `verifiedSubjectId`; the collection query then runs
under the existing service-role client, redundantly constrained by
`agent_id = targetAgentId`.**

The service-role client does not acquire the caller's `auth.uid()`
merely because `supabase.auth.getUser` validated a token. The runtime
MUST propagate the verified user ID as an explicit variable to every
authorisation check.

Rationale:
- Model A (RLS-authoritative under a caller-scoped client) would require
  refactoring five sibling routes in `agent-banking/index.ts`. Out of
  scope for D0.
- Model C (SECURITY DEFINER RPC) would require a new database function
  and migration. Out of scope for D0.
- Model B preserves the existing service-role runtime pattern for
  agent-banking and closes the anonymous exposure with a bounded X3
  change confined to `agentTransactionList`. Model B **requires no new
  agent-ownership relationship** and **no new `agent_cash_transactions`
  RLS policy**; existing RLS remains unchanged. Model B does, however,
  require two X3-scoped migrations that are inventoried in §7.4 below
  (an audit-RPC privilege-hardening migration and a pagination index on
  `public.agent_cash_transactions`). Neither is implemented in D0.

### 7.1 Ownership-resolution procedure (binding; to be implemented by X3)

```
1.  Require exactly one Authorization: Bearer <token> header.
    Missing/duplicate → 401 (denied audit).

2.  authResult := supabase.auth.getUser(bearerToken)
    If authResult.error OR authResult.user is null → 401 (denied audit).

3.  verifiedSubjectId := authResult.user.id
    (verifiedSubjectId is the only caller identity used from here on.)

4.  If not UUID_RE.test(targetAgentId) → 400 INVALID_AGENT_ID (denied audit).

5.  isAdmin := public.has_role(
        _user_id := verifiedSubjectId,
        _role    := 'admin'
    )  -- invoked through the existing RPC interface

6.  If not isAdmin:
        selfRow := SELECT 1 FROM public.agents
                    WHERE id = targetAgentId
                      AND user_id = verifiedSubjectId
                      AND status = 'active'
                    LIMIT 1
        If selfRow is empty → 404 AGENT_NOT_FOUND (masked; denied audit).

7.  If isAdmin:
        agentRow := SELECT 1 FROM public.agents
                    WHERE id = targetAgentId
                    LIMIT 1
        If agentRow is empty → 404 AGENT_NOT_FOUND (masked; denied audit).

8.  Only after ownership resolution succeeds:
        collection := SELECT … FROM public.agent_cash_transactions
                      WHERE agent_id = targetAgentId
                        AND <pagination predicates from X3 adapter>
                      ORDER BY created_at DESC, id DESC
                      LIMIT :effectiveLimit

9.  Emit exactly one read audit event on 200 (§10).
```

`verifiedSubjectId` is the sole caller-identity variable. The pseudocode
contains no `auth.uid()` reference (the service-role client has none);
no `agents.user_id = auth.uid()` predicate; and no `has_role(auth.uid(), …)`
call. Existing RLS policies quoted in §1.5 remain valid as database-side
evidence and are unaffected by this decision.

### 7.2 Defence in depth

- Preserve RLS as-is. Do not add a `service_role` USING/WITH CHECK policy.
  Do not weaken existing policies.
- The service-role collection query in X3 must include a redundant
  `.eq("agent_id", targetAgentId)` predicate and must never omit the
  ownership pre-check.
- The runtime must never accept `X-User-Id`, `X-Agent-Id`, or any
  caller-supplied identity header.

### 7.3 Role grants on `agent_cash_transactions` (no change required for Model B)

| Role | Current | Required |
|------|---------|----------|
| `anon` | no grant | no grant |
| `authenticated` | `SELECT` on `agent_cash_transactions` | unchanged |
| `service_role` | `ALL` | unchanged |

Model B does not add, weaken, or remove any RLS policy on
`public.agent_cash_transactions`. The `authenticated` `SELECT` grant is
mediated exclusively by the existing RLS quoted in §1.5.

### 7.4 Required X3 migrations (inventoried here; not implemented in D0)

Model B requires the following two X3-scoped migrations. Neither is
authored, staged, applied, or executed by D0. Exact filenames and
timestamps are assigned only when X3 is authorised.

**7.4.1 Audit-RPC privilege-hardening migration (X3, forward + rollback).**

Target function (complete signature):

```
public.log_security_event(
  UUID,
  TEXT,
  TEXT,
  INET,
  TEXT,
  JSONB
)
```

The forward migration MUST execute the equivalent of:

```sql
REVOKE EXECUTE ON FUNCTION
  public.log_security_event(UUID, TEXT, TEXT, INET, TEXT, JSONB)
FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION
  public.log_security_event(UUID, TEXT, TEXT, INET, TEXT, JSONB)
FROM anon;
REVOKE EXECUTE ON FUNCTION
  public.log_security_event(UUID, TEXT, TEXT, INET, TEXT, JSONB)
FROM authenticated;
GRANT EXECUTE ON FUNCTION
  public.log_security_event(UUID, TEXT, TEXT, INET, TEXT, JSONB)
TO service_role;
```

Binding requirements:

- Use the complete function signature above in every `REVOKE`/`GRANT`.
- Fail loudly if the expected function does not exist.
- Preserve `SECURITY DEFINER`; preserve the existing
  `SET search_path = public`; do not alter the function body.
- Do not grant execution to `PUBLIC`, `anon`, or `authenticated`.
- Do not weaken `public.security_audit_logs` RLS.
- Do not add a permissive client-facing audit RPC.

The paired rollback MUST never restore execution to `PUBLIC`, `anon`, or
`authenticated`. A rollback may remove the `service_role` grant only when
paired with an explicitly documented operational recovery procedure; it
must not restore the insecure public-execution state that existed prior
to hardening.

**7.4.2 Pagination index migration (X3, forward + rollback).**

Composite index on:

```
public.agent_cash_transactions (agent_id, created_at DESC, id DESC)
```

Consistent with the d.2B canonical ordering
`(created_at DESC, id DESC)`. Not implemented in D0.

---

## 8. Cursor security binding

**Canonical scope tuple (ordered):**

```
(environment, operationId, authenticatedSubjectId, authenticatedRole, targetAgentId)
```

- `environment` — `sandbox` | `production` (existing d.2B convention).
- `operationId` — literal string `agentTransactionList`.
- `authenticatedSubjectId` — the `verifiedSubjectId` at cursor issuance.
- `authenticatedRole` — the caller's effective role at issuance:
  `admin` | `agent_self`. Institutional roles are excluded because they
  are denied by §4.
- `targetAgentId` — the `agentId` path parameter as issued.

`institutionId` and `apiClientId` are **excluded** because those callers
are denied by §4.

**Filter hash tuple:** `EMPTY`. The endpoint has no filter parameters.

**Invalidation.** Any mismatch between a cursor's canonical scope tuple
and the current request context returns
`400 PAGINATION_CURSOR_SCOPE_MISMATCH`, per the shared d.2B pattern:
role change, subject change, target agent change, environment change.

---

## 9. Status and lifecycle rules

| Condition | Access to historical transactions |
|-----------|-----------------------------------|
| Agent `pending` | Denied for agent-self (masked 404). Allowed for admin. |
| Agent `active` | Allowed per §4. |
| Agent `suspended` | Denied for agent-self (masked 404). Allowed for admin. |
| Agent `terminated` | Denied for agent-self (masked 404). Allowed for admin. |
| Agent row deleted | 404 `AGENT_NOT_FOUND`. `ON DELETE RESTRICT` on the FK protects this today. |
| Institution suspended | Not applicable — institutional access denied by §4. |
| Caller's admin role revoked | Effective immediately at the next `has_role(verifiedSubjectId, 'admin')` call. Cursors issued under `authenticatedRole = admin` become invalid. |

---

## 10. Audit logging — ratified

All audit events are stored in `public.security_audit_logs` via the
existing SECURITY DEFINER function `public.log_security_event(_user_id,
_event_type, _event_category, _ip_address, _user_agent, _metadata)`.

**Physical column mapping:**

| `log_security_event` argument | Value |
|-------------------------------|-------|
| `_user_id` | `verifiedSubjectId`, or `NULL` when authentication did not resolve a user (anonymous, invalid/expired bearer) |
| `_event_type` | `agent_transaction_list.read` on success; `agent_transaction_list.denied` on any denial |
| `_event_category` | `data_access` |
| `_ip_address` | normalised caller IP obtained through the existing trusted-proxy model |
| `_user_agent` | bounded and sanitised `User-Agent` value |
| `_metadata` | JSON object with the logical fields below |

**`_metadata` JSON allow-list (logical fields — these are properties of the
JSON blob, not physical table columns):**

- `target_agent_id`
- `outcome` — `allowed` | `denied`
- `denial_reason_category` — one of `unauthenticated`,
  `invalid_agent_id`, `agent_not_found_or_unowned`,
  `agent_status_ineligible`, `platform_policy`, `cursor_scope_mismatch`,
  `rate_limit_exhausted`
- `request_id`
- `x_fapi_interaction_id`
- `pagination_mode` — `cursor` | `offset_deprecated`
- `cursor_present` — boolean
- `effective_role` — `admin` | `agent_self` | `none`

**Emission rules:**

- Exactly one `agent_transaction_list.read` event per successful `200`
  response, emitted **only after** the collection query and response
  finalisation have succeeded. A failed collection read is never logged
  as a successful read.
- Exactly one `agent_transaction_list.denied` event for each of:
  400 malformed `agentId`, 400 cursor scope mismatch,
  401 missing/invalid/expired bearer, 403 platform-policy denial,
  404 masked ownership/existence/status denial,
  429 rate-limit exhaustion.
- `500` responses are recorded through the existing operational error log
  path (not `security_audit_logs`); a failed database read is never
  silently classified as a successful read.

**Explicit exclusions (must never be logged):**

- cursor values;
- cursor HMAC signatures;
- bearer tokens;
- service-role keys;
- transaction data (`amount`, `currency`, `commission_amount`, `tx_type`,
  `status`, `reference`);
- `customer_msisdn`;
- `customer_user_id`;
- `idempotency_key`.

### 10.1 Current audit-RPC privilege state (inventoried)

Function: `public.log_security_event(UUID, TEXT, TEXT, INET, TEXT, JSONB)`.

Properties inventoried in the repository:

- Declared `SECURITY DEFINER`.
- Declared `SET search_path = public`.
- Writes to `public.security_audit_logs`.
- **No repository-level `REVOKE EXECUTE` on this function was found.**
- **No repository-level `service_role`-only `GRANT EXECUTE` on this
  function was found.**

Consequence: **the present repository does not prove that
`log_security_event` is restricted to trusted server callers.** Under the
default PostgreSQL grant, `EXECUTE` on a newly created function is
granted to `PUBLIC`. Combined with `SECURITY DEFINER`, that means an
anonymous or ordinary authenticated caller with network access to the
Data API today could invoke the audit RPC directly and insert forged
rows into `public.security_audit_logs`.

**Current server-only EXECUTE restriction: NOT PROVEN.** The audit path
must not be described as tamper-resistant until the §7.4.1 privilege
hardening is implemented and locally verified in X3.

### 10.2 Audit invocation model — ratified

- `agentTransactionList` invokes `log_security_event` **only through the
  service-role server client** inside the Edge Function; no browser,
  SDK, anonymous caller, or ordinary authenticated caller may invoke
  the audit RPC directly.
- The request's `verifiedSubjectId` is passed as `_user_id`. The
  `service_role` credential is transport authority only and is never
  recorded as the human actor.
- Every audit event remains mapped according to the §10 physical column
  mapping and `_metadata` allow-list above.

---

## 11. Rate limiting and abuse controls — required for X3

- Per-verified-subject limit: **120 requests / minute** on
  `agentTransactionList`. Independent of page size.
- Per-institution limit: **not applicable** — institutional callers are
  denied.
- Contract page size (X3): **default 25 / maximum 100**. The current
  legacy runtime and OpenAPI use `default 50 / maximum 200`; X3 corrects
  this to `default 25 / maximum 100`. D0 does not authorise
  implementation.
- Enumeration protection: masked 404 combined with the per-subject rate
  limit; a lower denial-rate alert threshold (e.g. 30 denials/min per
  subject) is recommended.
- Rate-limit exhaustion response: `429 Too Many Requests` with
  `Retry-After`, following the existing gateway convention, and one
  denied audit event per §10.

---

## 12. RLS decision

**Selected: Model B (see §7).**

- RLS on `agent_cash_transactions` remains unchanged.
- Role grants unchanged (§7.3).
- The service-role collection query is guarded by the explicit
  runtime ownership pre-check under `verifiedSubjectId` and is not
  reachable by an unauthenticated caller.

---

## 13. API compatibility

- Current declared posture: **anonymous** (no `security` on the
  operation, no global `security`).
- Requiring bearer authentication is a contract-tightening change for
  callers who currently call the endpoint without credentials. Under the
  active `4.53.1` **Unreleased** status, correcting this is permitted
  without a version increment because no released contract has been
  published with the anonymous declaration.
- No version change is prescribed. `info.version` remains `4.53.1`.
- Compatibility treatment: **CORRECT UNDER UNRELEASED STATUS.** X3
  declares bearer authentication, adds 400/401/403/404/429/500
  responses, corrects the page-size contract to 25/100, and adds the
  paginated envelope.

---

## 14. Required future X3 test matrix (specification only)

All implementation tests belong to **X3**. QR test files belong to X2 and
are outside the agent test scope. X3 must add tests covering at least:

1. Missing bearer → `401`; no `has_role` call, no `agents` query, no
   `agent_cash_transactions` query.
2. Invalid / expired bearer → `401`; `getUser` returns error; identical
   downstream assertions to test 1.
3. `verifiedSubjectId` provenance: assert the value used in every
   downstream authorisation call is the `user.id` returned by
   `supabase.auth.getUser`, not any header, JWT-claim shortcut, or
   database-derived `auth.uid()`.
4. Admin resolution: `has_role` is invoked with the explicit
   `verifiedSubjectId` (spy assertion on the RPC arguments).
5. Agent-self resolution: the `public.agents` lookup compares
   `agents.user_id` to `verifiedSubjectId` (not to `auth.uid()`).
6. Runtime does not rely on `auth.uid()` under the service-role client
   (source-level grep and RPC-argument assertions).
7. Malformed `agentId` (non-UUID) → `400 INVALID_AGENT_ID`; no
   `agents` or `agent_cash_transactions` query.
8. Non-existent `agentId` → masked `404`.
9. Foreign agent (authenticated, no linkage) → masked `404` with
   identical body to test 8 (parity).
10. Agent self-access, status `active` → `200`; ownership check
    invoked exactly once; collection query invoked exactly once.
11. Agent self-access, status ∈ {`pending`,`suspended`,`terminated`}
    → masked `404`; no collection query.
12. Institution staff / admin / API client callers → masked `404`
    (denied by §4); no collection query.
13. Platform administrator + **existing** agent (any status) → `200`
    with the canonical paginated response; the collection query is
    executed exactly once, constrained by `agent_id = targetAgentId`;
    exactly one `agent_transaction_list.read` audit event is emitted.
13a. Platform administrator + **non-existent** valid `agentId` → masked
    `404 AGENT_NOT_FOUND` with the identical body used in tests 8 and 9;
    **no** `agent_cash_transactions` query is executed; exactly one
    `agent_transaction_list.denied` audit event is emitted. Under no
    circumstance may an administrator receive `200` for a non-existent
    agent — administrators do not bypass resource existence validation.
14. Failed admin resolution AND failed agent-self resolution → masked
    `404`; **no** `agent_cash_transactions` SELECT executed.
15. Page-size contract: omitted `limit` → 25; `limit=100` accepted;
    `limit=101` rejected with `400`; no silent clamping.
16. Cursor scope mismatch (role, subject, target, environment; and
    agent-A cursor replayed on agent-B) → `400
    PAGINATION_CURSOR_SCOPE_MISMATCH` and one denied audit event.
17. Rate-limit exhaustion → `429` with `Retry-After` and one denied
    audit event.
18. API credential without a valid user Bearer JWT → `401` (API clients
    are denied).
19. Audit-event schema conformance: `event_type` ∈
    {`agent_transaction_list.read`,`agent_transaction_list.denied`};
    `event_category = 'data_access'`; `user_id = verifiedSubjectId` or
    `NULL`; `metadata` matches the §10 allow-list; no cursor values,
    signatures, bearer tokens, service-role keys, or transaction
    payload fields appear anywhere in log lines.
20. Denied audit events emitted for each of 400 malformed, 400 cursor
    mismatch, 401, 403, 404 (masked), 429.
21. Read audit event emitted only after the collection query and
    response finalisation succeed; simulated collection failure emits
    no read event.
22. Test scope isolation: the X3 test suite does not import, exercise,
    or assert on any X2 QR-directory files.

### 14.1 Required X3 audit-RPC privilege tests (specification only)

The following ten tests are prescribed for X3 to prove that §7.4.1 was
applied correctly. They are not created in D0.

1. `has_function_privilege('anon',
   'public.log_security_event(uuid,text,text,inet,text,jsonb)',
   'EXECUTE') = false`.
2. `has_function_privilege('authenticated',
   'public.log_security_event(uuid,text,text,inet,text,jsonb)',
   'EXECUTE') = false`.
3. `has_function_privilege('service_role',
   'public.log_security_event(uuid,text,text,inet,text,jsonb)',
   'EXECUTE') = true`.
4. `PUBLIC` has no `EXECUTE` privilege on the function (verified via
   `pg_proc.proacl` inspection; no `=X/…` ACL entry for `PUBLIC`).
5. Direct anonymous RPC invocation of `log_security_event` through the
   Data API is denied.
6. Direct authenticated RPC invocation of `log_security_event` through
   the Data API is denied.
7. The Edge Function server path can emit exactly one audit event
   through the `service_role` server client end-to-end against the
   local stack.
8. Denied endpoint requests cannot supply or overwrite `event_type`,
   `event_category`, `user_id`, `target_agent_id`, `outcome`, or
   `effective_role`; every field is populated by the server.
9. The paired rollback migration does not grant `EXECUTE` to `PUBLIC`,
   `anon`, or `authenticated` (verified by static SQL inspection and by
   applying the rollback in the local stack, then re-running tests 1,
   2, and 4).
10. No existing `public.security_audit_logs` RLS policy is weakened by
    the migration (verified against the pre-migration policy snapshot).

This is a plan. No tests are created in D0.

---

## 15. Binding decision record

- **Authentication:** Bearer JWT verified by `supabase.auth.getUser` only.
- **Authorised callers:** active agent-self and platform admin only.
- **Admin existing-agent rule:** **ALLOW**.
- **Admin non-existent-agent rule:** **MASKED 404**.
- **Runtime subject variable:** `verifiedSubjectId`
  (= `authResult.user.id` from `supabase.auth.getUser`).
- **Admin resolution:** `has_role(verifiedSubjectId, 'admin')`.
- **Agent-self resolution:**
  `agents.id = targetAgentId AND agents.user_id = verifiedSubjectId AND agents.status = 'active'`.
- **Institution / API-client access:** DENY.
- **Selected enforcement model:** **B** — runtime ownership pre-check
  under `verifiedSubjectId` + service-role collection query; RLS
  unchanged.
- **Existence masking:** 401 unauthenticated · 400 malformed UUID ·
  400 cursor scope mismatch · 404 masked (non-existent / foreign /
  unowned / status-ineligible, applied to every caller including
  platform admin) · 403 platform-policy only · 429 rate-limit.
- **Cursor scope tuple:** `(environment, operationId,
  authenticatedSubjectId, authenticatedRole, targetAgentId)`.
- **Filter hash tuple:** `EMPTY`.
- **Pagination:** default `25` / maximum `100` (to be enforced by X3;
  legacy 50/200 remains until X3 lands).
- **Rate limit:** `120 requests / minute` per verified subject;
  `429` with `Retry-After` on exhaustion.
- **Audit storage:** `public.security_audit_logs` via
  `public.log_security_event` with the mapping in §10.
- **Audit RPC current privilege status:** **NOT PROVEN SERVER-ONLY**
  (see §10.1).
- **Audit RPC required X3 privilege:** `service_role` `EXECUTE` only;
  `PUBLIC`, `anon`, and `authenticated` denied (see §7.4.1).
- **Ownership / RLS migration required:** **NO**.
- **Audit privilege migration required:** **YES** (§7.4.1).
- **Pagination index migration required:** **YES** (§7.4.2).
- **Compatibility treatment:** correct under `4.53.1` Unreleased; no
  version change; no SDK republish required until next scheduled release.
- **Programme sequence:** X2 QR first; X3 agents only after X2 closure.
- **X3 security prerequisite satisfied:** **YES**.
- **X2 authorised by this decision:** **NO**.
- **X3 authorised by this decision:** **NO**.
- **Unresolved decision fields:** **NONE**.

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

**Status:** PHASE 1B-R1I-d.2B-I1c-X2-D0-R2 SECURITY DECISION READY FOR FINAL REVIEW

