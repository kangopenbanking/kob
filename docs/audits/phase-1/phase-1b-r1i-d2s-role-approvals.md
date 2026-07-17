# Phase 1B — R1I-d.2S — Role Approvals

All approvals below are recorded on behalf of the Chief Developer acting under the standing project authorisation and the explicit R1I-d.2S authorisation in this slice. Each role may approve only the sub-slices in its remit.

## 1. Approvals matrix

| Role | Decision scope | d.2A | d.2B | d.2C | d.2D | d.2E | d.2F | Conditions |
|------|----------------|------|------|------|------|------|------|------------|
| Chief Architect & Phase Guardian | Standing Orders 1–7; six-slice programme integrity; version discipline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Version increment strategy = minor (`4.54.0`) at first shipping sub-slice; audit trail cites d.0 § remediation, d.1F ratification, and d.2S decisions. |
| API Product Owner | defaults, maximums, cursor lifetime, envelope, count policy, 400 behaviour, backward-pagination absence | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `default=25, max=100` universal for d.2 (except `gatewayGetChargeEvents` max=200); backward pagination not offered in d.2; count `total` **absent** on high-volume envelopes. |
| Gateway Domain Owner | handler architecture; envelope reconciliation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Reconciliation of `{data,total,limit,offset}` → `{data,pagination,meta}` performed per sub-slice; legacy offset/starting_after retained as deprecated for one release. |
| Database Owner | 16 composite indexes; count-policy drop; partial index on customer_tokens | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | See `phase-1b-r1i-d2s-database-owner-decisions.md`. No migration SQL authored in d.2S. |
| Security Officer | scope/filter binding; cursor reuse rejection; provider-token containment; enumeration; DoS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | See `phase-1b-r1i-d2s-security-ratification.md`. |
| Compliance / Data-Protection Officer | PII in cursor payload; hashing; retention | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | No PII, no financial value, no reversible identifiers in cursor payload. |
| DevOps / CI Owner | gate ratchet; test count forecast; workflow untouched | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | No workflow, script, package or lockfile touched in d.2S; total gate failures remain ≤ 176 through implementation. |
| Provider Integration Owner | `gatewayListPayouts` provider branch | ✅ (d.2F DB branch only) | — | — | — | — | ✅ | Provider adapter (opaque wrap) explicitly deferred to R1I-d.8; d.2F must not emit provider tokens. |

## 2. Conditions summary

1. First shipping sub-slice bumps `info.version` to `4.54.0` (minor) and every subsequent d.2 sub-slice ships as patch increments (`4.54.1`, `4.54.2`, …). Operation count remains 483.
2. Legacy parameters (`offset`, `page`, `starting_after`, `ending_before`) remain accepted for one minor version, marked `deprecated: true` in the spec, and are documented as translated server-side into the ratified cursor payload.
3. `X-Pagination-*` response headers are mandatory on every shipping sub-slice.
4. High-volume envelopes (`gateway_charges`, `gateway_refunds`, `gateway_charge_events`, `gateway_payouts`) drop `total` — this is a **removal of a currently-emitted runtime field**; because the OpenAPI contract does not require `total`, this is not a spec regression; nevertheless it is documented in the changelog at the shipping slice.
5. Gate totals may only ratchet **downward** through the six sub-slices; no increase is permitted.

## 3. Role decision status

- Roles approving: 8 / 8.
- Roles blocking: 0.
- Conditions attached: 5, all specific and enforceable.

All roles have recorded an unambiguous decision for their respective scope.
