
# KOB Compliance & Production-Readiness Remediation — Execution Plan

This is a **multi-week, multi-phase** remediation. I will execute it strictly in order, stop at every decision gate, and never mark a phase complete without evidence (diffs, test output, or quoted removed text). Nothing existing will be renamed, removed, or reshaped.

---

## Guardrails I will enforce on every change

1. **Additive only.** No renames, no removed operationIds/schemas/fields/endpoints. If a fix would break shape, I stop and flag `BREAKING — REQUIRES HUMAN APPROVAL`.
2. **No fabricated compliance claims.** Any "COBAC compliant", "BEAC compliant", "100/100", "financial-grade", "certifiable", "secure by default" language gets hedged to factual status ("designed with X requirements in mind; licensing in progress").
3. **No self-referential changelog narration** in public surfaces. "Guardian", "Standing Order", "The Lock", per-version self-grading get moved out of `openapi.*` `info.description` and any rendered public doc into an internal `CHANGELOG_INTERNAL.md`.
4. **No AI-assistant filler.** Merge markers, "Here is your fully polished…", placeholder badge/star requests get deleted.
5. **Spec must match implementation.** If a feature is described but not actually wired end-to-end, the doc gets relabeled `Planned — not yet implemented` rather than the spec being "made true" by writing more prose.
6. **Preserve sandbox contracts.** Before any auth/webhook/schema work in Phase 2+, I will produce a frozen inventory of every currently-shipping endpoint + field so we can confirm nothing changed shape.

---

## Phase 1 — Trust & Truthfulness Pass (no code logic changes)

Scope is documentation + spec metadata + README text only. No runtime behavior changes.

Deliverables:

- `TRUTH_AUDIT.md` at repo root with a single table:
  `Claim | Location (file:line) | Status (Implemented / Partial / Planned / Not Started) | Evidence | Recommended Hedge`
- Rewritten `public/openapi.json` + `public/openapi.yaml` `info.description` — factual, no Guardian/Standing Order/score language. Operations, paths, schemas, components, security: **untouched**.
- Internal-only `CHANGELOG_INTERNAL.md` holding the moved narration (so nothing is lost).
- Sweep of every SDK README (`packages/sdk-node`, `sdk-python`, `sdk-php`, `sdk-go`, `sdk-java`, plus `public/sdk-downloads/*README*`) for: AI artifacts, "secure by default", "financial-grade", unverified auth claims. Replaced with per-SDK status block (what auth actually works today, what is stubbed).
- Sweep of landing page + `/developer` portal copy for "COBAC & BEAC compliant" → hedged language.
- A short `PHASE_1_REPORT.md` with: files changed, **explicit list of files NOT changed and why**, and direct before/after quotes for every removed compliance claim.

I will not start Phase 2 until you review `TRUTH_AUDIT.md` and `PHASE_1_REPORT.md`.

---

## Phase 2 — Authentication Reality Check (DECISION GATE before starting)

Before I touch auth code I need three answers from you (see Open Questions). Then:

- Produce a frozen `SANDBOX_CONTRACT_FREEZE.md` listing every currently-callable endpoint + every field shape, so any later change can be diffed against it.
- Inventory what actually exists today in the auth edge functions for: `authorization_code`, PKCE, refresh-token rotation, refresh-token reuse detection, mTLS client auth, `private_key_jwt`, `token_endpoint_auth_method=none`.
- Mark each as Implemented / Partial / Not Started with code references.
- Add integration tests for the ones that already work (expired token rejection, replayed auth code rejection, reused refresh token → full session revoke).
- For each that does not work end-to-end: either implement it for real, or relabel its public docs `Not yet implemented`. No silent "spec says yes, code says no".
- Resolve `token_endpoint_auth_method=none` contradiction with one consistent, documented policy.

---

## Phase 3 — Scope Containment (additive `x-maturity` flag)

- Add OpenAPI vendor extension `x-maturity: ga | beta | experimental | not-licensed` per tag.
- `ga`: AISP, PISP only.
- `not-licensed` / `experimental`: Loans, Savings, Ledger, Issuing/Virtual Cards, Interbank/ISO 20022, Credit Scoring, Escrow, Custodial Wallets.
- Add a sandbox-only guard: production API keys calling a `not-licensed` route return a structured `403 not_licensed_in_production` (additive — no existing 2xx becomes a 4xx for sandbox keys).
- Update `/developer` copy to reflect honest availability.

---

## Phase 4 — PCI / Card Data Boundary

- Produce internal architecture doc tracing every code path that could touch a raw PAN.
- If KOB never touches raw PAN (Kora tokenizes upstream): add the guarantee to spec + add a CI log-scan that fails on PAN-shaped strings in logs/stored fields.
- If KOB does touch raw PAN anywhere: stop and flag `BREAKING — REQUIRES HUMAN APPROVAL — PCI SAQ D SCOPE`.

---

## Phase 5 — Consistency & Hygiene

- Keep all deprecated float/PascalCase fields untouched; ensure **new** examples in docs use only canonical snake_case + string-minor-unit.
- One money-consistency test per money-returning endpoint.
- Verify rate-limit, webhook-retry, idempotency-key middleware match the spec with one test per claim.
- Run Spectral against `openapi.json`, attach raw output. FAPI conformance suite only if Phase 2 confirmed an FAPI-eligible auth surface.

---

## Technical notes (for the engineer reading this)

- All `openapi.*` edits go through additive JSON patching; `paths`, `components.schemas`, `components.securitySchemes`, `security`, `tags` arrays are not reordered or removed.
- Moved narration lands in `CHANGELOG_INTERNAL.md` (not served, not linked from `/developer`, added to any docs allowlist as excluded).
- SDK README rewrites do not touch package.json/version/exports — text only.
- `x-maturity` is a vendor extension; no tool in the current pipeline rejects unknown `x-*` keys (verified before merging Phase 3).
- Sandbox-only guard in Phase 3 is implemented in the existing edge-function request pipeline, not in client SDKs.

---

## Open Questions (need answers before Phase 2; Phase 1 can start now)

1. **Licensing reality** — Confirm in writing: are COBAC / BEAC licenses (a) granted, (b) applied for, or (c) not yet applied? I will hedge to whichever you confirm. Default if no answer: "licensing in progress".
2. **FAPI target** — Is FAPI 1.0 Advanced the actual target for v1, or is baseline OAuth2 + PKCE sufficient for the first production cut? This decides whether `token_endpoint_auth_method=none` must be removed everywhere or is allowed for specific public clients.
3. **PCI scope** — Best knowledge today: does any KOB-owned service ever receive a raw PAN, or is it 100% Kora-tokenized at the edge? (If you don't know, I will assume "must verify" and Phase 4 starts with a code trace, not a claim.)
4. **Phase 1 authorization** — OK to proceed immediately with Phase 1 (docs/spec-description/README text only, zero runtime change) while you answer 1–3?

---

## Recommended defaults if you don't want to decide each question

- Q1: Hedge everything to "licensing in progress with COBAC/BEAC".
- Q2: Target baseline OAuth2 + PKCE + refresh rotation for v1; mark FAPI 1.0 Advanced as `Planned`. This is the lowest-risk honest position.
- Q3: Assume "must verify via code trace" and treat any PAN handling as a stop-and-escalate.
- Q4: Yes, start Phase 1 now.

If you reply "go with recommended defaults", I will start Phase 1 immediately and return with `TRUTH_AUDIT.md` + `PHASE_1_REPORT.md` for review before touching anything else.
