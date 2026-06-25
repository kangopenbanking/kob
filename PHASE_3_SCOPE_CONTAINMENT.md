# Phase 3 — Scope Containment Audit

**Spec version:** 4.51.3
**Date:** 2026-06-25
**Scope:** `public/openapi.json`, `public/openapi.yaml`, `public/openapi-sandbox.json`, `public/openapi-sandbox.yaml`

## Objective

Make the production-track vs. sandbox-pilot vs. experimental boundary explicit on every tag, so integrators cannot mistake a pilot module for a GA module. This closes the gap called out in the Phase 1 info.description (`The forthcoming x-maturity vendor extension will mark each tag explicitly`).

## Maturity scale

| Flag | Meaning |
| --- | --- |
| `ga` | Generally available. Stable contract; suitable for production integration subject to licensing status declared in `info.description`. |
| `preview` | Sandbox/pilot. Implemented in sandbox for integration testing; not yet authorised for production traffic. May change before GA. |
| `experimental` | Reference shape only; implementation is partial and may change without a major version bump until promoted. |

## Tag classification

### `ga` (25)
Monitoring, OAuth, Authentication, Security, Consent Management, Consents, AISP, PISP, KYC & Compliance, Webhooks, Admin, Communications, Directory, Bank Directory, Specification, Platform, Developer, Sandbox, Provider Webhooks (Inbound), Mobile Money, Payments, Payment Gateway, Merchants, Merchant Onboarding, Statements, Banking Operations.

### `preview` (25)
Loans, Savings, Credit Scoring, CrediQ, PostiQ, Virtual Cards, Issuing, Ledger, Interbank, Standards, Standards - ISO 20022, Bank Connectors, BankConnectors, Pay by Bank, Settlement, Payment Facilitation, Institution, Consumer Tools, Overdraft, Approval Workflows, Operational Controls, Gateway, Budgeting, Certificates, WooCommerce.

### `experimental` (4)
Agents, USSD, QR & Offline, CEMAC Remittance.

## Change inventory (additive only)

- Every tag object in the four spec files gains two properties: `x-maturity` and `x-maturity-note`.
- A root-level `x-maturity-legend` object describes the three flags so downstream tooling can render the scale without hard-coding it.
- No path, `operationId`, schema name, security scheme, parameter, header, enum, or required-array entry was added, renamed, reordered, or removed.

## Standing Order compliance

- **SO 1 (Lock):** no renames or removals.
- **SO 2 (Ratchet):** no compliance checks reduced; metadata only.
- **SO 3 (Audit Trail):** this document + `PHASE_3_CLOSEOUT_REPORT.md` cite the change.
- **SO 4 (Surgeon):** additive vendor extensions on existing tag objects; YAML files edited only inside the `tags:` block, leaving the remaining ~128k lines byte-identical.
- **SO 5 (Dead Code):** no schemas, parameters, headers, or security schemes added.
- **SO 6 (Version Gate):** `info.version` bumped 4.51.2 → 4.51.3 (patch, additive metadata).
- **SO 7 (Five Roles):** Guardian/Architect/Surgeon/Auditor/Scorekeeper enforced during this pass.
