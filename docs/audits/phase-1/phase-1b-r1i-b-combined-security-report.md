# Phase 1B-R1I-b — Combined Security Report

Companion to `phase-1b-r1i-b3-final-report.md`. Consolidates the security
posture of both G3 operations after full R1I-b closure.

## Threat coverage matrix

| Threat | Control | Operation(s) | Result |
|---|---|---|---|
| Cross-tenant key aliasing | `merchant_id` in reservation scope | both | Denied |
| Cross-user key aliasing | `user_id` in scope | both | Denied |
| Cross-operation key aliasing | Distinct `resource` per operation | both | Denied |
| Cross-account key aliasing | `account_id` in fingerprint for `scope=account` | update | Denied |
| Cross-environment key aliasing | `environment` in fingerprint | update; create (via UUIDv5 lock namespace) | Denied |
| Duplicate provider create on retry with a new key | UUIDv5 business-op lock | create | Denied |
| Blind retry after ambiguous 5xx | Ambiguity marker + reconciliation-on-replay | create | Denied |
| Stale replay reverting newer state | SET_STATE + fingerprint immutability | update | Impossible |
| Same-key body tampering | 409 IDEMPOTENCY_KEY_REUSED on fingerprint mismatch | both | Denied |
| Concurrent duplicate storming | in-flight slot + 429 Retry-After:1 | both | Absorbed |
| Anonymous access to reservation rows | grants: `service_role` only | both | Denied |
| Authenticated-client access to reservation rows | no `authenticated` grant | both | Denied |
| Client-supplied UUIDv5 acceptance | UUIDv4 regex enforced | both | Rejected |
| Oversized / control-char keys | ≤255 + UUIDv4 regex | both | Rejected |
| Internal key leakage | handlers return only public fields | create (UUIDv5 op-lock) | Contained |
| Provider secret leakage | handlers never echo Nium API secret / signing key | create | Contained |
| Destination / bank-detail leakage | user-scoped SELECT only | both | Contained |
| Stack-trace leakage | structured error envelope | both | Contained |
| Reservation poisoning | RLS + grants prevent non-service writes | both | Denied |

## Unresolved findings

```
Critical: 0
High:     0
Medium:   0
Low:      0
```

## Notes

- The b.3 slice added no runtime code; every control above is inherited
  from b.1 / b.1V / b.1X / b.1XV / b.2.1 / b.2.1V and was re-verified at
  source in this slice.
- Cross-operation isolation was the only outstanding combined risk after
  b.2.1 and is now proven at source by
  `global-accounts-cross-op-isolation-b3.test.ts`.
