# Phase 4 — PCI / Card Data Boundary Audit

**Spec version:** 4.51.4
**Date:** 2026-06-25
**Scope reviewed:** every operation, schema, parameter, and request/response body in `public/openapi.json`, `public/openapi.yaml`, plus the sandbox mirrors. Edge functions under `supabase/functions/` were searched for `card_number`, `cardNumber`, `cvv`, `cvc`, `primary_account_number`, and `raw_pan`.

## PCI scope inventory

| Surface | PCI flag | Justification |
| --- | --- | --- |
| `POST /v1/payouts/push-to-card` (`payoutPushToCard`) | `cardholder_data` | Accepts a raw `card_number` in the request body to fund a payout to a beneficiary card. The PAN is transmitted on the wire and forwarded to Kora; KOB does not write it to its primary datastore. |
| `POST /v1/issuing/cards/{id}/reveal` (`revealVirtualCard`) | `cardholder_data` | Returns full PAN + CVV after step-up MFA. PAN/CVV originate from the Kora card vault and are returned to the caller in-memory only. |
| `VirtualCard.card_number_masked` (schema property) | `masked_pan_only` | Truncated PAN per PCI DSS req 3.3 (first 6 / last 4). Safe for storage, logs, and UI. |
| Every other operation in the spec | `none` (implicit) | No PAN, CVV, full-track, or PIN-block transit. |
| Edge functions in `supabase/functions/` | `none` | Code search returned zero hits for raw PAN/CVV identifiers. Card-data handling is delegated to Kora; KOB middleware exchanges only card UUIDs and masked PANs. |

## What this means for our PCI posture

- **Storage:** KOB does not store full PANs at rest. Only masked PANs (`card_number_masked`) live in `virtual_cards` and equivalent records. Sensitive authentication data (CVV, full track, PIN block) is never persisted — it is forwarded to the issuer/processor at authorization time only, per PCI DSS req 3.2.
- **Transit:** Two operations transmit full PAN: `payoutPushToCard` (inbound) and `revealVirtualCard` (outbound). Both are flagged `cardholder_data` in the spec.
- **Delegated vault:** Full PAN/CVV are held in the Kora card vault. KOB operates as a card-data-aware gateway in front of Kora; the SAQ-D obligations attach to Kora.
- **Honest posture statement (proposed for `/compliance` page):** *KOB is not PCI DSS Level 1 certified. Card-vault obligations are delegated to Kora, which is PCI DSS Level 1 certified. KOB's own scope is limited to two transit-only endpoints (push-to-card payouts and the step-up-protected reveal endpoint); both are flagged `x-pci-scope: cardholder_data` in the OpenAPI specification.*

## Why we did not move the touchpoints behind the vault

`payoutPushToCard` is, by definition, a beneficiary-funding flow: the caller has the PAN of the destination card and we must hand it to Kora. There is no tokenization path that removes the PAN from KOB's API surface without breaking the product. The honest mitigation — followed here — is to (a) flag the surface, (b) keep it on the same step-up + idempotency + rate-limit policy as `revealVirtualCard`, and (c) never persist the PAN in KOB's datastore.

`revealVirtualCard` is the controlled escape hatch for cardholders. It is step-up-gated, audit-logged, and returns only in-memory. The flag now makes that obligation explicit to integrators and auditors.

## Change inventory (additive only)

- 2 operations gained `x-pci-scope` and `x-pci-note` properties.
- 1 schema property gained `x-pci-scope` and a PCI-DSS-3.3 citation in its description.
- 1 root-level `x-pci-scope-legend` object was added.
- No path, `operationId`, schema name, security scheme, parameter, header, enum, or `required[]` entry was added, renamed, reordered, or removed.

## Standing Order compliance

- **SO 1 (Lock):** no renames or removals.
- **SO 2 (Ratchet):** no compliance check reduced; an explicit PCI boundary is now part of the contract.
- **SO 3 (Audit Trail):** this document + `PHASE_4_COMPLIANCE_CLOSEOUT.md`.
- **SO 4 (Surgeon):** additive vendor extensions only; YAML edits scoped to two operation blocks, one schema property, and one root key.
- **SO 5 (Dead Code):** no schemas/parameters/headers/security schemes added.
- **SO 6 (Version Gate):** `info.version` bumped 4.51.3 → 4.51.4 (patch, additive metadata).
- **SO 7 (Five Roles):** Guardian / Architect / Surgeon / Auditor / Scorekeeper enforced.
