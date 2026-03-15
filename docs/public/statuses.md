# Status Lifecycle Reference

> Definitive status values and transitions for all KOB entities.

## Payment / Charge Status

```
pending → successful
pending → failed
pending → cancelled (merchant-initiated)
pending → voided (pre-capture void)
```

| Status | Description |
|---|---|
| `pending` | Charge created, awaiting provider confirmation |
| `successful` | Payment confirmed by provider |
| `failed` | Payment failed (provider error or timeout) |
| `cancelled` | Merchant cancelled before completion |
| `voided` | Pre-auth voided before capture |

## Refund Status

```
pending → successful
pending → failed
```

| Status | Description |
|---|---|
| `pending` | Refund initiated, awaiting provider |
| `successful` | Refund confirmed |
| `failed` | Refund failed |

## Payout Status

```
pending → processing → successful
pending → processing → failed (→ auto-reversal)
```

| Status | Description |
|---|---|
| `pending` | Payout requested |
| `processing` | Sent to provider |
| `successful` | Funds delivered |
| `failed` | Payout failed; wallet auto-reversed |

## Settlement Status

```
pending → processing → completed
pending → processing → failed
```

| Status | Description |
|---|---|
| `pending` | Settlement batch queued |
| `processing` | Funds being transferred |
| `completed` | Settlement complete |
| `failed` | Settlement failed |

## Consent Status (AISP/PISP)

```
AwaitingAuthorisation → Authorised → Consumed/Expired/Revoked
AwaitingAuthorisation → Rejected
```

| Status | Description |
|---|---|
| `AwaitingAuthorisation` | Consent created, PSU not yet authorized |
| `Authorised` | PSU authorized, consent active |
| `Rejected` | PSU rejected or admin denied |
| `Consumed` | Single-use consent used (PISP) |
| `Expired` | Past expiration_date |
| `Revoked` | User or TPP revoked |

## KYB Verification Status

```
draft → pending → approved
draft → pending → rejected → pending (resubmit)
```

| Status | Description |
|---|---|
| `draft` | KYB not yet submitted |
| `pending` | Under admin review |
| `approved` | KYB verified |
| `rejected` | Rejected with reason |

## KYC Verification Status

```
pending → approved
pending → rejected
```

| Status | Description |
|---|---|
| `pending` | Documents under review |
| `approved` | Identity verified |
| `rejected` | Verification failed |

## Merchant Status

```
draft → pending_review → active → suspended
```

| Status | Description |
|---|---|
| `draft` | Registered, KYB not submitted |
| `pending_review` | KYB submitted |
| `active` | KYB approved, can process payments |
| `suspended` | Temporarily disabled |

## Loan Status

```
pending → approved → disbursed → completed
pending → rejected
disbursed → defaulted
```

| Status | Description |
|---|---|
| `pending` | Application submitted |
| `approved` | Approved, awaiting disbursement |
| `rejected` | Application denied |
| `disbursed` | Funds released |
| `completed` | Fully repaid |
| `defaulted` | Overdue beyond grace period |

## Savings Account Status

```
active → closed
```

| Status | Description |
|---|---|
| `active` | Accepting deposits/withdrawals |
| `closed` | Account closed |
