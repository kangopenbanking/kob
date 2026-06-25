# Kang Open Banking — Truth Audit (Phase 1)

**Date:** 2026-06-25
**Scope:** public-facing surfaces only (OpenAPI spec `info.description`, landing/regulatory pages, SDK READMEs). Internal `/docs/audit*`, `/docs/governance`, `/scripts`, and migration files are out of scope for this pass — they are not customer-visible.
**Rule:** every "Implemented" claim must point at running code or a passing test. Anything else is downgraded to Partial / Planned / Not Started.

---

## Legend

- **Implemented** — wired end-to-end, evidence in repo, exercised by tests or a live route.
- **Partial** — some code exists; not enough to back the public claim.
- **Planned** — referenced in spec/docs only; no working implementation.
- **Not Started** — claim has no corresponding code or roadmap artifact.

---

## 1. Regulatory and certification claims

| # | Claim (verbatim, before) | Location | Status | Evidence | Phase 1 hedge applied |
|---|---|---|---|---|---|
| R1 | "COBAC & BEAC compliant Open Banking API …" | `public/openapi.json` info.description; `public/openapi.yaml` info.description | **Not Started** as a compliance claim — no licence held | No COBAC/BEAC certificate or registration is on file; user has confirmed licensing is in progress | Rewrote `info.description` to "designed with COBAC and BEAC requirements in mind. KOB does not currently hold a COBAC or BEAC licence; licensing is in progress." |
| R2 | "COBAC Compliant" trust badge in hero | `src/pages/Index.tsx:113` | **Not Started** as a certification claim | Same as R1 | Hedged to "Designed for COBAC alignment". |
| R3 | "PCI-DSS Certified" trust badge in hero | `src/pages/Index.tsx:117` | **Partial** — Phase 4 will confirm whether KOB ever touches raw PAN; if not, PCI-DSS scope is reduced to SAQ-A via tokenisation partner, not full Level 1 certification | No PCI Attestation of Compliance (AOC) in repo | Hedged to "PCI-DSS scope via tokenisation partner". |
| R4 | "Full COBAC & BEAC compliance with automated reporting" | `src/pages/Index.tsx:899` | **Partial** — reporting templates exist (`src/pages/regulatory/ReportingTemplates.tsx`), but "full compliance" is not a claim KOB can make today | — | Reworded to "Built against COBAC and BEAC requirements … Licensing is in progress; no certification is claimed." |
| R5 | "COBAC compliant, PCI-DSS certified with OAuth 2.0 authentication" | `src/pages/ForDevelopers.tsx:337` | **Not Started** (certification) / **Implemented** (OAuth 2.0 path) | OAuth 2.0 + PKCE code present; no certificates | Reworded to: OAuth 2.0 Auth Code + PKCE is real and documented; certification claims removed. |
| R6 | "Fully compliant with Central African Banking Commission regulations" | `src/pages/About.tsx:206` | **Not Started** | Same as R1 | Replaced "Compliant" with "Designed for alignment" and added a top-of-section disclaimer card. |
| R7 | "PCI-DSS Level 1 Certified", "ISO 27001:2013 Certified", "SOC 2 Type II Audited" | `src/pages/About.tsx:221-223` | **Planned** | No AOC, no ISO certificate, no SOC 2 report present | Relabelled each as control objectives / planned attestations, with explicit "not yet held" language. |
| R8 | "Kang Open Banking maintains full compliance with CEMAC … regulations" | `src/pages/CompliancePage.tsx:22` | **Not Started** | Same as R1 | Replaced with framework-overview language and prepended an "Important — read first" disclaimer card. |
| R9 | "PCI-DSS Level 1 certified, ISO 27001 compliant" | `src/pages/About.tsx:111` | **Planned** | No certificates in repo | Reworded to "built to PCI-DSS and ISO 27001 control objectives". |

## 2. Self-graded changelog narration in public spec

| # | Claim | Location | Status | Phase 1 action |
|---|---|---|---|---|
| C1 | "v4.5.0 … Final compliance push — 100/100" | `public/openapi.json` info.description (and YAML mirror) | Internal QA opinion published to external integrators | Removed from public `info.description`; archived verbatim to `CHANGELOG_INTERNAL.md`. |
| C2 | "Standing Orders 1, 2, 3, 6 honored — zero renames, zero removals, all changes additive" | Same | Internal governance text | Same — moved to `CHANGELOG_INTERNAL.md`. |
| C3 | "Guardian invariants protected throughout" | Same | Internal governance text | Same. |
| C4 | Per-version "R1…R12 / G1…G8 / P1…P3" change codes | Same | Internal change-set IDs only meaningful to KOB engineers | Same — replaced public surface with a one-liner pointing to https://kangopenbanking.com/changelog.json. |

## 3. SDK READMEs

Findings (verified by grep over `packages/sdk-{node,python,php,go,java}/README.md` and `public/sdk-downloads/sdk-{node,python,php}-README.md`):

- No "COBAC", "BEAC", "financial-grade", or "secure by default" strings present.
- No AI-assistant artifacts (merge markers, "Here is your fully polished…", placeholder badge/star requests) present.
- No "Authentication (Upcoming)" placeholder strings — every README shows a real, working quickstart using the sandbox API key path.

**Status: clean as of 2026-06-25.** No Phase 1 edits applied to SDK READMEs. They will be re-audited in Phase 2 against the actual auth surface (PKCE / mTLS / private_key_jwt) once Phase 2 inventory is complete; any SDK that exposes a flow which is not implemented end-to-end will then be relabelled "Not yet implemented".

## 4. Authentication claims (deferred to Phase 2 — listed here for traceability only)

| # | Claim | Location | Phase 2 work |
|---|---|---|---|
| A1 | Authorization Code + PKCE | spec + SDK READMEs | Verify against live sandbox with an integration test. |
| A2 | Refresh token rotation + reuse detection | spec | Verify with a "reuse old refresh → session revoke" test. |
| A3 | mTLS client authentication | spec (security scheme `mtls`) | Confirm whether the edge function actually validates the client cert chain or whether it is described only. |
| A4 | `private_key_jwt` client auth | spec | Same as A3. |
| A5 | `token_endpoint_auth_method=none` for public clients | spec | Resolve contradiction with FAPI 1.0 Advanced — pick one consistent policy. |

These items are **not** marked "resolved" by Phase 1; they require Phase 2 sign-off (see Open Questions in `.lovable/plan.md`).

## 5. Items I could NOT verify in Phase 1 (require decisions)

1. **Whether KOB ever touches raw card PAN data.** Phase 4 work; until verified, every PCI-DSS claim must remain hedged.
2. **Whether mTLS / private_key_jwt are working end-to-end.** Phase 2 work; spec currently describes them.
3. **Whether `token_endpoint_auth_method=none` is actually accepted by the live token endpoint.** Phase 2 work.

## 6. Items explicitly NOT changed in Phase 1 (and why)

- All `paths`, `components.schemas`, `components.securitySchemes`, `tags`, `servers`, and `security` arrays in the OpenAPI spec — Standing Order 1 / 2 forbid removal or rename without a major-version bump.
- All operationIds, parameters, request bodies, response bodies, and examples — same reason.
- All SDK source code — Phase 2 territory; Phase 1 is text-only.
- All internal `docs/audit/*`, `docs/governance/*`, `docs/audits/*`, `CHANGELOG.md`, and migration SQL files — these are internal artifacts, not customer-visible, and rewriting them would dilute the audit trail Phase 2+ needs.
- `public/changelog.json` entry bodies — they are factual per-release notes (not the self-graded narration that lived in `info.description`).

---

## Phase 1 outcomes (evidence)

- `public/openapi.json` info.description: **9 998 chars → 1 781 chars**, all "COBAC compliant / 100/100 / Standing Order / Guardian" language removed, regulatory status now explicitly hedged. Verified via `python3 -c "import json; print(len(json.load(open('public/openapi.json'))['info']['description']))"`.
- `public/openapi.yaml` info.description: rewritten in lockstep with JSON via the same patch script (`scripts/phase1-truth-pass.mjs`).
- `info.version` bumped 4.51.0 → 4.51.1 per Standing Order 6 (patch — additive metadata only). Mirrored in `src/config/version.ts` (`KOB_API_VERSION`, `KOB_POSTMAN_VERSION`) and in `public/changelog.json`.
- Original 9 998-char description archived verbatim to `CHANGELOG_INTERNAL.md` so no governance history is lost.
- 4 public pages hedged: `src/pages/Index.tsx` (4 spots), `src/pages/About.tsx` (4 spots), `src/pages/CompliancePage.tsx` (top disclaimer), `src/pages/ForDevelopers.tsx` (1 spot).

See `PHASE_1_REPORT.md` for the file-by-file diff summary, before/after quotes, and the "did NOT change" list.
