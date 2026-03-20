# Bank Connector Layer — System Inventory (Phase 0)

## Date: 2026-03-20

## Existing Bank-Related Infrastructure

### Database Tables
| Table | Purpose |
|---|---|
| `bank_connections` | Legacy H2H/SFTP/REST bank connections |
| `bank_reconciliations` | Legacy reconciliation records |
| `bank_statements` | Imported bank statements |
| `bank_transaction_imports` | CSV/file imports |
| `bank_transfer_transactions` | Bank transfer payment records |
| `interbank_participants` | Interbank switch participants |
| `interbank_endpoints` | Participant connector endpoints |
| `client_certificates` | mTLS certificate storage |

### Edge Functions
| Function | Purpose |
|---|---|
| `directory-banks-cm` | Static Cameroon bank directory (15 banks) |
| `bank-sync` | Legacy bank data synchronization |
| `bank-import-transactions` | CSV transaction imports |
| `bank-reconcile` | Reconciliation engine |
| `interbank-engine` | Interbank payment switch + connector mgmt |
| `interbank-connector-inbound` | mTLS-enforced message ingestion |
| `interbank-dispatch-worker` | Outbox pattern dispatch |

### AISP Endpoints
| Function | Data Source |
|---|---|
| `aisp-accounts` | User's `accounts` table |
| `aisp-balances` | `account_balances` table |
| `aisp-transactions` | `transactions` table |
| `aisp-beneficiaries` | `beneficiaries` table |

### PISP Endpoints
| Function | Payment Rail |
|---|---|
| `pisp-domestic-payment` | Flutterwave / internal ledger |
| `pisp-consent` | Consent management |

### Admin UI
- `/admin/interbank-payments` — 6-tab interbank operations hub
- No dedicated bank directory or connector management UI

### Security
- mTLS utilities in `_shared/mtls.ts`
- OAuth2 token scoping via `oauth-token`
- OIDC discovery via `oidc-config`
