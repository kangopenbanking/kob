# Phase 1 — Trust & Truthfulness Pass: Closeout Report

**Date:** 2026-06-25
**Spec version:** 4.51.0 → 4.51.1 (patch; additive metadata only — Standing Order 6)
**Scope:** documentation, spec metadata, and customer-visible page copy only. **No runtime behaviour, no schemas, no operationIds, no security schemes, no SDK source code changed.**

This report is the evidence pack for Phase 1. It pairs with `TRUTH_AUDIT.md`. Phase 2 (Authentication Reality Check) is gated on your sign-off here and on the open questions in `.lovable/plan.md`.

---

## A. Files changed (and why)

| File | Change | Reason |
|---|---|---|
| `public/openapi.json` | `info.description` rewritten; `info.version` bumped to 4.51.1 | Removed "COBAC & BEAC compliant", Guardian/Standing-Order narration, "100/100" self-grading from the public surface (R1, C1–C4). |
| `public/openapi.yaml` | Same as above, in lockstep | Spec mirrors must agree (`scripts/check-openapi-version.mjs`). |
| `CHANGELOG_INTERNAL.md` | **New file** | Archives the original 9 998-char `info.description` verbatim so no engineering history is lost. Not served, not linked from `/developer`. |
| `src/config/version.ts` | `KOB_API_VERSION` and `KOB_POSTMAN_VERSION` bumped to 4.51.1 | Required by `scripts/check-version-sync.mjs`. |
| `public/changelog.json` | Added 4.51.1 entry; `apiVersion` field bumped | Required by `scripts/check-version-sync.mjs` and by the Vercel predeploy gate (`changelog.json has no entry for v…`). |
| `src/pages/Index.tsx` | 4 hedges (lines 113, 117, 457, 619, 898–899) | R2, R3, R4 — removed certification badge language. |
| `src/pages/About.tsx` | 4 hedges (lines 96–98, 110–112, 189–192, 199–227) | R6, R7, R9 — added explicit "no licence/certification held" disclaimer and reworded badges to control-objective language. |
| `src/pages/CompliancePage.tsx` | Top-of-page disclaimer card added; overview paragraph reworded | R8 — page now opens with a "designed to align with, not a statement of certifications held" disclaimer. Body of the page (specific regulation references) is preserved as a transparency artifact. |
| `src/pages/ForDevelopers.tsx` | 1 hedge (lines 335–338) | R5 — replaced "COBAC compliant, PCI-DSS certified" with the truthful, narrower "OAuth 2.0 + PKCE; tokenisation partner handles raw card data". |
| `scripts/phase1-truth-pass.mjs` | **New idempotent script** | Single source of truth for the spec rewrite; re-running it is a no-op once 4.51.1 is in place. Kept in `scripts/` so the audit step is reproducible. |
| `TRUTH_AUDIT.md` | **New file** | Claim-by-claim mapping per the spec in the prompt. |
| `PHASE_1_REPORT.md` | **This file** | Phase 1 closeout. |

## B. Direct before/after quotes (for the worst offenders)

**`public/openapi.json` info.description — first 250 chars**

> **Before:** "COBAC & BEAC compliant Open Banking API providing Account Information (AISP), Payment Initiation (PISP), Credit Scoring, Loans, Savings, Mobile Money, Double-Entry Ledger, Virtual Cards, Custodial Wallets, Escrow, Compliance Screening, SLA …"
>
> **After:** "Kang Open Banking (KOB) v1 API.\n\nProvides Account Information (AISP), Payment Initiation (PISP), Credit Scoring, Loans, Savings, Mobile Money, a double-entry Ledger, Virtual Card Issuing, Custodial Wallets, Escrow, Compliance Screening, SLA Monitoring, …"

**`public/openapi.json` info.description — removed self-grading text (excerpt)**

> **Before (now archived to `CHANGELOG_INTERNAL.md`):** "v4.5.0 (2026-03-27): Final compliance push — 100/100. N1: Standards-ISO 20022 tag declared. N2: nonce required=true. … Standing Orders 1, 2, 3, 6 honored — zero renames, zero removals, all changes additive. … Guardian invariants protected throughout."
>
> **After:** *(not present in public surface)* — replaced by: "Versioning and changelog: per-release notes live at https://kangopenbanking.com/changelog.json and are also rendered at /developer/changelog. Internal release narration (engineering rationale, governance citations, per-cut self-review) is kept in an internal-only document and is not published on this surface."

**`src/pages/Index.tsx:113`**

> **Before:** `<span>COBAC Compliant</span>`
> **After:** `<span>Designed for COBAC alignment</span>`

**`src/pages/Index.tsx:117`**

> **Before:** `<span>PCI-DSS Certified</span>`
> **After:** `<span>PCI-DSS scope via tokenisation partner</span>`

**`src/pages/Index.tsx:899`**

> **Before:** `{ icon: Lock, title: "Regulatory Compliant", desc: "Full COBAC & BEAC compliance with automated reporting and comprehensive audit trails." }`
> **After:** `{ icon: Lock, title: "Designed for COBAC & BEAC", desc: "Built against COBAC and BEAC requirements with audit trails and reporting templates. Licensing is in progress; no certification is claimed." }`

**`src/pages/ForDevelopers.tsx:337`**

> **Before:** "COBAC compliant, PCI-DSS certified with OAuth 2.0 authentication"
> **After:** "OAuth 2.0 Authorization Code with PKCE and rotating refresh tokens. Designed for COBAC alignment; KOB does not handle raw card PANs (tokenised via our partner)."

**`src/pages/About.tsx:206`**

> **Before:** "Fully compliant with Central African Banking Commission regulations governing payment services, data protection, and financial infrastructure."
> **After:** "Designed against the Central African Banking Commission regulations governing payment services, data protection, and financial infrastructure. Licence application in progress."

**`src/pages/About.tsx:221-223`**

> **Before:** `PCI-DSS Level 1 Certified / ISO 27001:2013 Certified / SOC 2 Type II Audited`
> **After:** `PCI-DSS controls (raw card data handled by tokenisation partner; KOB out of SAQ-D scope) / ISO 27001:2013 control objectives (certification: planned) / SOC 2 Type II (report: planned)`

**`src/pages/CompliancePage.tsx` (top of page, new card)**

> **After (new disclaimer):** "Important — read first: this page describes the regulatory framework Kang Open Banking is designed to align with. It is not a statement of certifications held or licences granted. KOB does not currently hold a COBAC or BEAC licence; licensing is in progress…"

## C. Files explicitly NOT changed (and why)

- All OpenAPI `paths`, `components.schemas`, `components.securitySchemes`, `tags`, `servers`, `security` — Standing Order 1/2 forbid removal/rename without a major-version bump, and the prompt explicitly says "no breaking changes".
- All operationIds, examples, request/response bodies — same reason.
- All SDK source code (`packages/sdk-*/src/**`, `public/sdk-downloads/*.{tar.gz,zip,whl,phar,jar}`) — Phase 2 territory.
- All SDK READMEs (`packages/sdk-*/README.md`, `public/sdk-downloads/sdk-*-README.md`) — they were grep-clean for the offending strings (see `TRUTH_AUDIT.md` §3). They will be re-checked against the actual auth surface in Phase 2.
- All `supabase/functions/**` edge functions — runtime; out of Phase 1 scope.
- `docs/audit/*`, `docs/audits/*`, `docs/governance/*`, `CHANGELOG.md`, migration SQL — internal artifacts; rewriting them would dilute the audit trail Phase 2+ needs.
- `public/sitemap.xml` — only contains COBAC in a URL slug; safe.

## D. Items I could NOT verify in Phase 1 (do not mark resolved)

- A1–A5 in `TRUTH_AUDIT.md` §4 — every authentication claim. Phase 2 work.
- Whether any KOB-owned service ever receives a raw PAN. Phase 4 work.
- Whether the `not-licensed` sandbox guard (Phase 3) is acceptable as the gate between sandbox-only and production-track modules; it is described in the plan but not implemented in Phase 1.

## E. Breaking-change candidates (none in Phase 1)

Nothing in Phase 1 changes shape. Spec version bumped patch (4.51.0 → 4.51.1) precisely because the change is additive metadata only.

## F. How to verify this report locally

```bash
# 1. Confirm spec scrub
python3 -c "import json; d=json.load(open('public/openapi.json'));
print('version:', d['info']['version']);
print('len(description):', len(d['info']['description']));
print('contains COBAC compliant:', 'COBAC compliant' in d['info']['description'] or 'COBAC & BEAC compliant' in d['info']['description']);
print('contains 100/100:', '100/100' in d['info']['description']);
print('contains Standing Order:', 'Standing Order' in d['info']['description']);
print('contains Guardian:', 'Guardian' in d['info']['description'])"

# Expected:
# version: 4.51.1
# len(description): 1781
# contains COBAC compliant: False
# contains 100/100: False
# contains Standing Order: False
# contains Guardian: False

# 2. Confirm the archive exists and contains the original prose
test -f CHANGELOG_INTERNAL.md && grep -c 'Standing Order' CHANGELOG_INTERNAL.md
# Expected: a positive integer

# 3. Confirm version artifacts agree
grep KOB_API_VERSION src/config/version.ts
grep '"apiVersion"' public/changelog.json | head -1
# Expected: both report 4.51.1
```

---

## G. Decision gate — Phase 2 needs your call on 3 things

These are restated from `.lovable/plan.md` because Phase 2 cannot start without them:

1. **Licensing reality** — confirm: COBAC / BEAC licences are (a) granted, (b) applied for, or (c) not yet applied? I have hedged to "in progress" everywhere; tell me which is accurate.
2. **FAPI target** — is FAPI 1.0 Advanced the v1 target, or is OAuth 2.0 + PKCE + refresh rotation the honest production cut? This decides what gets relabelled "Planned" in Phase 2.
3. **PCI scope** — to your knowledge, does any KOB-owned service ever receive a raw card PAN, or is it 100% Kora-tokenised at the edge? If you do not know, Phase 4 will start with a code trace, not a claim.

Reply with answers (or "go with recommended defaults" again) and I will start Phase 2.
