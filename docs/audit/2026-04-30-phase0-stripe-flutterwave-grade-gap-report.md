# KOB Platform — Phase 0 Gap Report
## Stripe / Flutterwave-grade Integration Standards Audit

**Audit date:** 2026-04-30
**Auditor:** Lovable (Phase 0, read-only)
**Scope:** Deployed spec at `https://kangopenbanking.com` vs repo `public/openapi.json` (v4.26.7), plus public developer portal route reachability.
**Standing Orders honored:** 1 (Lock), 2 (Ratchet), 3 (Audit Trail), 4 (Surgeon — additive only), P1 (Public First), P2 (Zero-404), P4 (Open Spec).

> Phase 0 = **diagnose only**. No specs, code, DB, routes or dashboards were modified.

---

## 1. Executive summary

| Area | Status | Notes |
|---|---|---|
| Spec deployment parity | ✅ **PASS** | Deployed `openapi.json` v4.26.7 is byte-equivalent in structure to repo (same paths, schemas, components, x-extensions). |
| OpenAPI quality gates G1–G5 | ✅ **PASS** | `scripts/openapi-quality-gates.mjs` reports 0 failures across 391 operations. |
| Public developer routes (Order P1/P2) | ✅ **PASS (with note)** | All 7 sampled `/developer/*` URLs resolve to HTTP 200 after benign trailing-slash 301s (CDN normalization). No homepage redirects detected. |
| OpenAPI public download (Order P4) | ✅ **PASS** | `/openapi.json` (2.8 MB) and `/openapi.yaml` (2.0 MB) served unauthenticated, valid content-type. |
| Changelog (Order P7) | ✅ **PASS** | `/changelog.json` head entry matches `info.version` 4.26.7 (CI gate enforces this). |
| Stripe/Flutterwave-grade table-stakes | ⚠️ **3 GAPS** | See §3. None are spec-breaking; all are additive fixes. |
| OpenAPI 3.1 `webhooks` block | ⚠️ **GAP** | Runtime webhook receivers exist + are signature-verified, but the spec's top-level `webhooks: {}` is empty (0 entries). Swagger-UI cannot render a webhook tab. Already noted in `docs/audit/2026-04-28-international-standards-e2e-audit.md` §"Remaining recommendations". |
| Cursor pagination on legacy list endpoints | ⚠️ **GAP** | 31 `GET /...list` operations still use `offset/limit` only. `x-pagination` advertises cursor as the standard for new endpoints; migration is non-breaking via additive `starting_after`. |

**Bottom line:** the platform is at international/Stripe-grade for the **mandatory** gates (security schemes referenced on every op, RFC 7807 errors, 4xx coverage, idempotency parameter defined and used on financial mutations, rate-limit headers, SLA published, sandbox magic data published, SDKs published). The 3 gaps in §3 are quality-of-life additions, not compliance failures.

---

## 2. Spec parity (deployed vs repo)

```
DEPLOYED https://kangopenbanking.com/openapi.json
REPO     public/openapi.json

version            4.26.7  ==  4.26.7
title              same
paths              333     ==  333
schemas            59      ==  59
reusable responses 4       ==  4   (NotModified, TooManyRequests, Unauthorized, Forbidden)
reusable params    9       ==  9   (incl. IdempotencyKey, CursorParam, X-FAPI-*)
security schemes   3       ==  3   (bearerAuth, mtls, oauth2)
servers            api.kangopenbanking.com/v1, sandbox-api.kangopenbanking.com/v1   (both)
x-extensions       x-api-standards, x-pagination, x-error-catalog, x-deprecation-policy,
                   x-rate-limits, x-sla, x-sandbox, x-sdks, x-webhook-policy, x-webhook-events
paths-only-deployed: 0
paths-only-repo    : 0
schemas-only-*     : 0 / 0
```

**Verdict:** No drift. Standing Order 1 (The Lock) and Order P4 (Open Spec) are intact.

---

## 3. Stripe / Flutterwave-grade gaps (additive fixes, no breakage)

### Gap A — No `apiKey` security scheme declared
**Observed:** `components.securitySchemes` exposes `bearerAuth` (Bearer JWT), `mtls`, `oauth2` — but no `apiKey` scheme for `Authorization: Bearer sk_live_…` style server-to-server keys. Stripe / Flutterwave both publish an `apiKey` scheme alongside Bearer.
**Impact:** Generated SDKs and Postman collections cannot describe the `sk_live_*` / `sk_test_*` flow as a first-class auth method. Today it gets bundled under `bearerAuth` which is correct at runtime but misleading in tooling.
**Severity:** Low (cosmetic / DX).
**Justification standard:** Stripe API reference §"Authentication" — distinct `apiKey` scheme; OpenAPI 3.1 §4.8.27.
**Proposed fix (Phase 1, additive):** add `apiKey` scheme name `secretKey` with `in: header, name: Authorization, description: "Bearer sk_live_/sk_test_ secret key"`. Reference it on existing operations alongside `bearerAuth` (additive — does not remove `bearerAuth`). Patch bump 4.26.7 → 4.26.8.

### Gap B — Empty OpenAPI 3.1 `webhooks` block
**Observed:** `s.webhooks` has 0 entries even though `x-webhook-events` lists 22 event types and runtime schemas exist in `src/lib/webhook-event-schemas.ts`. Already flagged in 2026-04-28 audit.
**Impact:** Swagger-UI / ReDoc cannot render an interactive Webhooks tab. Stripe and Flutterwave both ship populated `webhooks` blocks.
**Severity:** Medium (DX — visible to every integrator using ReDoc).
**Justification standard:** OpenAPI 3.1 §4.8.10 (Webhooks Object).
**Proposed fix (Phase 1, additive):** populate `webhooks` from the existing `src/lib/webhook-event-schemas.ts` source-of-truth. Patch bump.

### Gap C — Cursor pagination missing on 31 legacy list endpoints
**Observed:** `x-pagination` advertises cursor (`starting_after` / `ending_before`) as the standard, but 31 list endpoints (mostly under `/v1/gateway/*` and `/v1/aisp/*`) still expose only `offset` / `limit`. Already flagged in 2026-04-28 audit §"Remaining recommendations" item 1.
**Impact:** Stripe-style cursor pagination is the de-facto standard. Offset pagination on long-tail merchant data will eventually exhibit duplicates/drops on writes.
**Severity:** Medium.
**Justification standard:** Stripe API "Pagination" §; KOB `x-pagination` self-published contract.
**Proposed fix (Phase 1, additive):** add `starting_after` and `ending_before` query parameters **alongside** existing `offset` (no removal — Standing Order 1). Document both, mark `offset` as `deprecated: false` with a `description` pointer to the cursor approach. Minor bump 4.26.7 → 4.27.0 (new parameters on existing ops are additive but feature-level).

---

## 4. Items that look like gaps but are NOT (do not "fix")

| Item | Why it's fine |
|---|---|
| 83 write ops without `Idempotency-Key` parameter | Audited the list — all 83 are auth/security flows (`oauth/token`, `auth/phone/send-otp`, `pin/set`, `sca/initiate`, `captcha/verify`, etc.) where idempotency keys are inappropriate (replay protection comes from nonces, OTP TTL, or PKCE). All **financial-mutation** write ops correctly reference `#/components/parameters/IdempotencyKey`. Standing Order 2 (Ratchet) preserved. |
| 1 op missing 2xx/4xx | `GET /v1/.well-known/jwks.json` — public RFC 7517 endpoint. Always returns 200 by spec; 4xx is not part of the JWKS contract. Acceptable. |
| 55 ops "missing error ref" | False positive in my scanner — these reference `Error` schema inline rather than via `#/components/responses/*`. Schema is identical. Could be tightened in a later pass for DRYness, not a compliance miss. |
| Trailing-slash 301s on `/developer*` | Benign CDN canonicalization; final URL is 200 with full content. Order P2 (Zero-404) satisfied. |

---

## 5. Public developer portal reachability (Order P1, P2, P6)

| URL | Final status | Final size | Verdict |
|---|---|---|---|
| `/openapi.json` | 200 | 2,870,484 B | ✅ |
| `/openapi.yaml` | 200 | 2,011,950 B | ✅ |
| `/changelog.json` | 200 | 71,638 B | ✅ |
| `/developer/` | 200 (after 301) | 10,417 B | ✅ |
| `/developer/api-explorer/` | 200 (after 301) | 10,855 B | ✅ |
| `/developer/guides/sdks/` | 200 (after 301) | 10,383 B | ✅ |
| `/developer/examples` | 200 | 9,517 B | ✅ |
| `/developer/examples/real-world/` | 200 (after 301) | 10,747 B | ✅ |
| `/developer/standards` | 200 | 9,517 B | ✅ |
| `/developer/changelog/` | 200 (after 301) | 9,302 B | ✅ |

No homepage redirect, no 404, no auth wall. All Phase 0 reachability checks pass.

---

## 6. Recommended next steps (require explicit approval per turn)

Per the user's pre-approval ("additive + version bump pre-approved"), the following are queued but **not executed in Phase 0**:

1. **Phase 1A** — fix Gap A (`apiKey` scheme), patch bump → 4.26.8. Estimated blast radius: spec-only.
2. **Phase 1B** — fix Gap B (populate `webhooks` block from `webhook-event-schemas.ts`), patch bump → 4.26.9. Spec-only.
3. **Phase 1C** — fix Gap C (additive cursor params on 31 list endpoints), minor bump → 4.27.0. Spec + per-endpoint Edge Function support for `starting_after` (not breaking — `offset` remains).
4. **Phase 1D** — extend `e2e/` and `src/test/` suites with one assertion per fix (Ratchet).
5. **Phase 1E** — changelog entries within 48 h (Order P7); Postman regen via existing `scripts/regen-postman.mjs`.

Each phase will land as its own turn so reviewers can audit one diff at a time (Surgeon Rule).

---

## 7. Evidence files produced this turn

- `docs/audit/2026-04-30-phase0-stripe-flutterwave-grade-gap-report.md` (this file)

No other files were created or modified in Phase 0.
