# Phase 1B-R1I-a.1 — Nium Webhook Runtime Forensic Report

Read-only forensic assessment. No source or contract changed.

## 1. Baseline

| Item | Value | Evidence |
|---|---|---|
| Branch | `edit/edt-90a0fd35-31ec-4743-9cdd-4dc901b82762` | `git rev-parse --abbrev-ref HEAD` |
| Commit SHA | `00682347064d84c5d63a37dd0d72f7d85519e2af` | `git rev-parse HEAD` |
| Working tree | clean (untracked audit files only) | `git status --short` |
| Node | v22.22.0 | `node -v` |
| npm | 10.9.4 | `npm -v` |
| `package.json` sha256 | `490aa19793418ce9f3603db26f270568362c0b2d8786fd19cc4f0cdeca49acd3` | sha256sum |
| `package-lock.json` sha256 | `137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5` | sha256sum |
| `public/openapi.json` sha256 | `5b5db5d6b67829c130aa8f7e0883dd666ebf69eb60b7d7cab574909f0f0e5305` | sha256sum |
| `public/openapi.yaml` sha256 | `3828a0904ff7a3b6c1c5e6e48a1bff525755d8eea5abc64bbd6ee12b6bbe038c` | sha256sum |
| `scripts/openapi-quality-gates.mjs` sha256 | `529ca795459f11aebb13b8b2407694609c92d3e3d6dc0ddde0ebdfa9c15cbbd5` | sha256sum |
| `src/test/openapi-quality-gates.test.ts` sha256 | `e64b27065dc0190e5fdc0a853ba5ea48c7812ac91776df69c44921e947ae0c84` | sha256sum |
| API version | 4.53.1 | `openapi.json/info.version` |
| Operation count | 484 | node script over `paths` |
| Release status | Unreleased | Phase 1B-R1I baseline |
| Rollup override | 4.44.2 | `package.json/overrides` (Phase 1B-R build root-cause report) |

### Baseline commands executed this slice

| Command | Exit | Result | Evidence |
|---|---|---|---|
| `npm run openapi:gates` | 1 (expected) | G2=3, G5=29, G6=77, G9=79, G1/G3/G4/G7/G8=0, Total=188 | `/tmp/gates.out` this turn |
| `npm ci` | not re-executed this slice | last verified PASS | Phase 1A-I reproducible-install-report.md |
| `npm run build` | not re-executed this slice | last verified PASS | Phase 1B-R build root-cause report |
| `npm run openapi:gates:test` | not re-executed this slice | 35/35 PASS | Phase 1A-V/1B-R baselines |
| `npm run test` | not re-executed this slice | ≤86 fails, 0 unhandled | Phase 1B-R baseline |
| `npm run lint` | not re-executed this slice | baseline unchanged | Phase 1B-R baseline |
| `npm run openapi:check-version`, `version:check-sync`, `version:print` | not re-executed this slice | 4.53.1 synced | Phase 1B-R1 |

a.1 is scoped read-only; the immutable file hashes above prove no drift versus the last verified baseline for the artifacts they cover.

## 2. Canonical OpenAPI declaration

| Field | Value |
|---|---|
| operationId | `niumIncomingWebhook` |
| method | `POST` |
| path | `/v1/gateway/global-accounts/webhook` |
| tag | `Gateway` |
| security | `[]` (public webhook) |
| required header | `x-nium-signature` |
| optional header | `$ref: #/components/parameters/IdempotencyKeyHeader` |
| request schema | `NiumWebhookEvent` |
| success | `200 { ok, status, payment_id?, duplicate? }` |
| errors | `401 Invalid signature`, `404 Unknown account` |
| provider event doc | described in prose only (`Idempotent on transactionId`, `HMAC-SHA256 signed via header x-nium-signature`) |
| replay-window doc | absent |
| deduplication doc | prose only (`Idempotent on transactionId`) |
| machine-readable extension | absent (no `x-kob-idempotency`) |

**Contract vs runtime drift**: contract advertises the generic `IdempotencyKeyHeader`; runtime never reads it (see §14).

## 3. Runtime route

| Layer | File | Symbol | Evidence | Status |
|---|---|---|---|---|
| Public URL | `POST /functions/v1/nium-webhook` | — | Deno function slug matches directory | CONFIRMED |
| Edge Function | `supabase/functions/nium-webhook/index.ts` | `Deno.serve` (default export) | file present, 313 lines, sha256 `bc51a9de4fd4059c368bfaa499f782a3de3c810086e62730103dc4488b91bee4` | CONFIRMED |
| Signature verifier | `supabase/functions/_shared/nium-client.ts` | `verifyWebhookSignature` (lines 245–271) | imported at index.ts:6 | CONFIRMED |
| Replay/dedup | `supabase/functions/_shared/webhook-replay-protection.ts` | `checkAndRegisterWebhook` | imported at index.ts:7, invoked at index.ts:74 | CONFIRMED |
| Dedup store | `public.webhook_inbox` | `UNIQUE(source, event_id)` | migration `20260216212726_e1343e45…sql:314–325` | CONFIRMED |
| Audit sink | `public.nium_webhook_audit` | INSERT-only | index.ts:39 | CONFIRMED |
| Domain services | `public.nium_incoming_payments`, `nium_payouts`, `nium_conversions`, `nium_rfi`, `nium_global_accounts` + `resolve_nium_routing` RPC | see index.ts:100–305 | CONFIRMED |

**Public-route mapping**: `CONFIRMED_RUNTIME_MAPPING`. The documented `/v1/gateway/global-accounts/webhook` is served by the API-gateway rewrite → `functions/v1/nium-webhook`. (Deployment status not re-probed live in a.1; verified previously in Phase 1B-R1 CSV.)

## 4. Signature verification

| Control | Implementation | Evidence | Status |
|---|---|---|---|
| Signature header | `x-nium-signature` (HMAC) and `x-nium-signature-key` (static shared secret) | `nium-client.ts:245–268`, `index.ts:53–54` | PROVEN |
| Algorithm | HMAC-SHA256 hex over raw body; static-secret compare fallback | `nium-client.ts:258–267` | PROVEN |
| Secret source | `Deno.env.get("NIUM_WEBHOOK_SECRET")` | `nium-client.ts:250` | PROVEN |
| Raw body captured | `req.text()` **before** JSON.parse | `index.ts:48` | PROVEN |
| Order (sig → parse → dedup → mutate) | verified in code | `index.ts:48→56→74→100+` | PROVEN |
| Timing-safe compare | `timingSafeEqual()` XOR loop, length-checked | `nium-client.ts:226–231` | PROVEN |
| Missing signature | returns 401 (`sigOk === false` because both headers null) | `index.ts:56–58` | PROVEN |
| Malformed/invalid sig | returns 401 | `index.ts:56–58` | PROVEN |
| Secret leakage | no signature echoed on failure; audit stores flags only | `index.ts:57` | PROVEN |
| Stub-mode bypass | if `NIUM_WEBHOOK_SECRET` unset AND `NIUM_MODE==='stub'` → accepts | `nium-client.ts:251` | PARTIAL — deliberate design; sandbox-only. Production risk depends on `NIUM_MODE` env in prod (not verifiable from source alone). |

Overall signature verification: **PROVEN** with one deliberate stub-mode bypass documented for sandbox use.

## 5. Event-ID identity

| Control | Implementation | Evidence | Status |
|---|---|---|---|
| Extraction | first non-empty of `eventId | event_id | transactionId | systemReferenceNumber | id` | `index.ts:68–70` | PROVEN |
| Normalisation | `String(...)`; no lowercasing/trim | `index.ts:68` | PARTIAL (case-sensitive; Nium IDs are opaque so acceptable) |
| Optional | if empty, dedup step is skipped (`if (eventId)`) | `index.ts:73` | PARTIAL — missing event-ID allows the domain mutation to proceed unguarded. Documented gap. |
| Scope | `(source='nium', event_id)` pair in `webhook_inbox` | `index.ts:74–76`, `webhook-replay-protection.ts:96–108` | PROVEN — cross-provider collisions cannot occur. |
| Tenant scope | not present at inbox level | `webhook_inbox` schema | PARTIAL — a Nium event-ID is provider-globally unique so cross-tenant collision is impossible in practice. Documented. |

## 6. Deduplication storage

| Control | Implementation | Evidence | Status |
|---|---|---|---|
| Table | `public.webhook_inbox` | migration `…20260216212726…sql:314–325` | PROVEN |
| Atomic key | `UNIQUE(source, event_id)` | migration line 324 | PROVEN |
| Insert path | SELECT-then-INSERT with `23505` fallback → returns `duplicate:true` | `webhook-replay-protection.ts:84–116` | PROVEN atomic (DB enforces uniqueness even under race) |
| TTL | 24h look-back window | `webhook-replay-protection.ts:29,92` | PROVEN |
| Storage classification | **DATABASE_ATOMIC** | | PROVEN |
| RLS | enabled; only `service_role` may read/write | `…20260216212726…sql:330–334`, tightened at `…20260308211903…sql:34–38` | PROVEN — no anon/authenticated client access |
| Secondary safety net | `nium_incoming_payments` SELECT-by-`nium_transaction_id` returns `{duplicate:true}` before insert | `index.ts:201–202` | PROVEN — best-effort, non-atomic; the authoritative barrier is `webhook_inbox` |

## 7. Concurrency

| Item | Verdict | Evidence |
|---|---|---|
| Reservation mechanism | DB unique index on `(source,event_id)` | migration 20260216212726 |
| Race between SELECT and INSERT | present, but caught by `23505` handler → `duplicate:true` | `webhook-replay-protection.ts:110–114` |
| Order (reserve → mutate) | reservation happens **before** domain mutation | `index.ts:74→100+` |
| Stuck-reservation risk | possible if the first request crashes between reserve and mutate (row is written to `webhook_inbox` with `is_processed=false`) — subsequent deliveries return `duplicate:true` and the mutation is never executed | `webhook-replay-protection.ts:105`, index.ts:80–83 |

Concurrency classification: **PROBABLY_ATOMIC** for the reservation itself; **RACE_CONDITION_PRESENT** for the "reserve-then-crash" case (no compensating retry/mark-failed-and-retry path found in a.1). Documented gap. Not fixable inside a.1 scope.

## 8. Payload consistency

| Scenario | Actual behaviour | Evidence | Risk |
|---|---|---|---|
| same event ID + same payload | 200 `{received:true, duplicate:true, event_id}` — no second mutation | `index.ts:80–83` | none |
| same event ID + changed payload | 200 `{received:true, duplicate:true, event_id}` — silently deduped; **no fingerprint comparison, no quarantine, no audit warning** | `webhook-replay-protection.ts:96–108`, `index.ts:80–83` | **MEDIUM — changed-payload replay is silently ignored rather than quarantined/flagged.** |

Payload-consistency classification: **PARTIAL** — dedup is correct; changed-payload detection is absent.

## 9. Replay window

| Control | Implementation | Evidence | Status |
|---|---|---|---|
| Timestamp header validation | none in Nium handler | `index.ts` search | MISSING |
| Age cap | none | | MISSING |
| Future tolerance | none | | MISSING |
| Effective replay ceiling | 24h TTL of `webhook_inbox` dedupe window (a duplicate delivered >24h later would replay) | `webhook-replay-protection.ts:29` | PARTIAL — TTL bounds dedup, not signature age |

Replay-window classification: **MISSING**. The handler relies on Nium sender authenticity (signature) and 24h dedupe TTL rather than an explicit timestamp check. Documented gap.

## 10. Domain-mutation trace

Handled event families (from `index.ts`):

| Event family | Table / RPC | Duplicate-safety |
|---|---|---|
| `payout*`, `transfer*` | `nium_payouts` UPDATE by `nium_transfer_id` | guarded by inbox dedup |
| `conversion*`, `fx*` | `nium_conversions` UPDATE by `nium_conversion_id` | guarded by inbox dedup |
| `rfi*`, `compliance_request*` | `nium_rfi` UPSERT `onConflict: nium_rfi_id` | intrinsically idempotent |
| `account.status*` | `nium_global_accounts` UPDATE | guarded by inbox dedup |
| `payment_incoming`, `*credit*` | `nium_incoming_payments` INSERT + downstream `gateway-create-payout` fetch | inbox dedup + secondary `nium_transaction_id` SELECT + downstream idempotency key `nium-${niumTxId}` |
| unknown | `{received:true, ignored_event}` — no mutation | safe |

## 11. Generic `Idempotency-Key` runtime check

| Question | Answer | Evidence |
|---|---|---|
| Does the Nium handler read `Idempotency-Key`? | **No.** | `rg 'Idempotency-Key' supabase/functions/nium-webhook/` returns only the outbound header to `gateway-create-payout` at `index.ts:279` |
| Does any middleware read it before this handler? | No. Edge functions run without a preceding shared middleware for this route. | function config; no wrapper `serve()` in shared/ |
| Would Nium fail without it? | No — Nium never sends it. | contract & runtime |
| Does its presence affect processing? | No. | not read |
| Conflict with provider-event dedup? | Yes — declaring a required or optional-and-enforced generic header would be dishonest and could confuse SDK generators. | contract inspection |

Classification: **NOT_USED**.

## 12. Existing test inventory

| Test file | Test name | Control | Assertion quality | Status |
|---|---|---|---|---|
| `supabase/functions/nium-webhook/index.test.ts` | rejects request with no signature | missing sig | MEDIUM (status only) | PRESENT |
| same | rejects wrong x-nium-signature-key | invalid static key | MEDIUM | PRESENT |
| same | rejects wrong HMAC x-nium-signature | invalid HMAC | MEDIUM | PRESENT |
| same | accepts valid x-nium-signature-key | positive static key | MEDIUM | PRESENT |
| same | accepts valid HMAC and blocks replay | positive HMAC + duplicate delivery | MEDIUM (response-only; no DB mutation-count assertion) | PRESENT |

| Gap | Missing |
|---|---|
| Raw-body preservation | ABSENT |
| Changed-payload same eventId | ABSENT |
| Concurrent duplicate delivery | ABSENT |
| Mutation-count DB assertion | ABSENT |
| Missing event ID | ABSENT |
| Stale/future timestamp | ABSENT (no runtime control to test) |
| Cross-tenant / cross-provider collision | ABSENT |
| Error-response secret leakage | ABSENT |
| Generic `Idempotency-Key` no-op behaviour | ABSENT |

## 13. Security findings

| ID | Finding | Severity | Evidence | Required action |
|---|---|---|---|---|
| NIUM-A1-01 | Contract advertises generic `Idempotency-Key` header the handler never reads | LOW (correctness / SDK-generator honesty) | contract vs runtime | Remove header from `niumIncomingWebhook` in a.3 (Model A) |
| NIUM-A1-02 | Changed-payload replay under the same `event_id` is silently deduped; no fingerprint / quarantine / audit escalation | MEDIUM | `webhook-replay-protection.ts` has no fingerprint compare | Design fingerprint + quarantine path; **out of scope for a.1** |
| NIUM-A1-03 | No timestamp/replay-window enforcement — relies on 24h `webhook_inbox` TTL | LOW-MEDIUM | `index.ts` search | Add `x-nium-timestamp` window check; **out of scope for a.1** |
| NIUM-A1-04 | Reserve-then-crash leaves an unprocessed `webhook_inbox` row; retries dedupe as "duplicate" without ever mutating | MEDIUM | `webhook-replay-protection.ts:105–108` | Add processed-flag / retry sweeper; **out of scope for a.1** |
| NIUM-A1-05 | Stub-mode signature bypass (`MODE==='stub'` + no secret) accepts unsigned webhooks | LOW (dev-only; guarded by two env vars) | `nium-client.ts:251` | Confirm production `NIUM_MODE!=='stub'`; keep documented |
| NIUM-A1-06 | Missing `event_id` skips dedup entirely; malformed sender could suppress replay protection | LOW-MEDIUM | `index.ts:73` | Require event ID for authoritative event types; **out of scope for a.1** |

No CRITICAL findings identified from source in this slice. This is a forensic inventory, not a penetration-test PASS.

## 14. Cross-references

- Wiring row updated in `phase-1b-runtime-wiring.csv` / `.json` (evidence-only column).
- Contract decision recorded in `phase-1b-nium-contract-decision.md`.
- Final gate in `phase-1b-r1i-a1-final-report.md`.
