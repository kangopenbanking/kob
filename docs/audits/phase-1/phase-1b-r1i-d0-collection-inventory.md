# Phase 1B — R1I-d.0 — Complete Collection-Operation Inventory

**Method:** Programmatic walk of `public/openapi.json` at v4.53.1. Every `GET` whose `200/application/json` schema references `PaginatedResponse`, an array, or an object with `data: array` is enumerated below. Non-`GET` collection-like reports and stream/export endpoints are called out separately.

**Total operations inventoried:** 483
**Collection-shaped operations identified:** 77 GET operations across 24 domain tags

## 1. Master table

| Operation ID | Method | Path | Domain | Response shape | Classification |
|--------------|--------|------|--------|-----------------|----------------|
| certificateList | GET | /v1/certificates | Certificates | PaginatedResponse | PAGINATION_PRESENT |
| aispAccounts | GET | /v1/aisp/accounts | AISP | PaginatedResponse | PAGINATION_PRESENT |
| aispBalances | GET | /v1/aisp/accounts/{accountId}/balances | AISP | PaginatedResponse | PAGINATION_PRESENT |
| aispTransactions | GET | /v1/aisp/accounts/{accountId}/transactions | AISP | PaginatedResponse | PAGINATION_PRESENT |
| aispBeneficiaries | GET | /v1/aisp/accounts/{accountId}/beneficiaries | AISP | PaginatedResponse | PAGINATION_PRESENT |
| aispStandingOrders | GET | /v1/aisp/accounts/{accountId}/standing-orders | AISP | PaginatedResponse | PAGINATION_PRESENT |
| aispDirectDebits | GET | /v1/aisp/accounts/{accountId}/direct-debits | AISP | PaginatedResponse | PAGINATION_PRESENT |
| consentsList | GET | /v1/consents | Consent Management | PaginatedResponse | PAGINATION_PRESENT |
| creditScoreTips | GET | /v1/credit/tips | Credit Scoring | PaginatedResponse | PAGINATION_PRESENT |
| loanProducts | GET | /v1/loans/products | Loans | PaginatedResponse | PAGINATION_PRESENT |
| loanSchedule | GET | /v1/loans/{loanId}/schedule | Loans | PaginatedResponse | PAGINATION_PRESENT |
| savingsProducts | GET | /v1/savings/products | Savings | PaginatedResponse | PAGINATION_PRESENT |
| listSavingsAccounts | GET | /v1/savings/accounts | Savings | PaginatedResponse | PAGINATION_PRESENT |
| ledgerAccounts | GET | /v1/ledger/accounts | Ledger | PaginatedResponse | PAGINATION_PRESENT |
| journalList | GET | /v1/ledger/journal | Ledger | PaginatedResponse | PAGINATION_PRESENT |
| virtualCardList | GET | /v1/cards | Virtual Cards | PaginatedResponse | PAGINATION_PRESENT |
| virtualCardTransactions | GET | /v1/cards/{cardId}/transactions | Virtual Cards | PaginatedResponse | PAGINATION_PRESENT |
| webhookList | GET | /v1/webhooks | Webhooks | PaginatedResponse | PAGINATION_PRESENT |
| webhookDeliveries | GET | /v1/webhooks/{webhookId}/deliveries | Webhooks | PaginatedResponse | PAGINATION_PRESENT |
| adminSandboxAccounts | GET | /v1/admin/sandbox/accounts | Admin | PaginatedResponse | PAGINATION_PRESENT |
| adminWebhooks | GET | /v1/admin/webhooks | Admin | PaginatedResponse | PAGINATION_PRESENT |
| adminTransactionReview | GET | /v1/admin/transactions/review | Admin | PaginatedResponse | PAGINATION_PRESENT |
| adminListLoans | GET | /v1/admin/loans | Admin | PaginatedResponse | PAGINATION_PRESENT |
| adminListSavings | GET | /v1/admin/savings | Admin | PaginatedResponse | PAGINATION_PRESENT |
| adminListConsents | GET | /v1/admin/consents | Admin | PaginatedResponse | PAGINATION_PRESENT |
| adminManageBranches | GET | /v1/admin/branches | Admin | PaginatedResponse | PAGINATION_PRESENT |
| woocommerceListTransactions | GET | /v1/woocommerce/transactions | WooCommerce | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListCharges | GET | /v1/gateway/charges | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListRefunds | GET | /v1/gateway/refunds | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListPayouts | GET | /v1/gateway/payouts | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListDisputes | GET | /v1/gateway/disputes | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListSettlements | GET | /v1/gateway/settlements | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListBeneficiaries | GET | /v1/gateway/beneficiaries | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayReportTransactions | GET | /v1/gateway/reports/transactions | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayReportSettlements | GET | /v1/gateway/reports/settlements | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListVirtualAccounts | GET | /v1/gateway/virtual-accounts | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayGetMerchantBalance | GET | /v1/gateway/balances | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListPaymentLinks | GET | /v1/gateway/payment-links | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListPaymentPlans | GET | /v1/gateway/payment-plans | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListSubscriptions | GET | /v1/gateway/subscriptions | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListSubaccounts | GET | /v1/gateway/subaccounts | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListCustomers | GET | /v1/gateway/customers | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListCustomerTokens | GET | /v1/gateway/customers/{customerId}/tokens | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayGetChargeEvents | GET | /v1/gateway/charges/{chargeId}/events | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListReconciliationRuns | GET | /v1/gateway/reconciliation | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| merchantList | GET | /v1/merchants | Merchant Onboarding | PaginatedResponse | PAGINATION_PRESENT |
| merchantListApiKeys | GET | /v1/merchants/api-keys | Merchant Onboarding | PaginatedResponse | PAGINATION_PRESENT |
| merchantListSettlementAccounts | GET | /v1/merchants/settlement-accounts | Merchant Onboarding | PaginatedResponse | PAGINATION_PRESENT |
| merchantListWebhooks | GET | /v1/merchants/webhooks | Merchant Onboarding | PaginatedResponse | PAGINATION_PRESENT |
| gatewayListFundingIntents | GET | /v1/gateway/funding-intents | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| listWithdrawalPolicies | GET | /v1/admin/withdrawal-policies | Operational Controls | PaginatedResponse | PAGINATION_PRESENT |
| listStaffAuthorizations | GET | /v1/admin/staff/authorizations | Operational Controls | PaginatedResponse | PAGINATION_PRESENT |
| listWithdrawalRequests | GET | /v1/banking/withdrawal-requests | Approval Workflows | PaginatedResponse | PAGINATION_PRESENT |
| listApprovals | GET | /v1/banking/approvals | Approval Workflows | PaginatedResponse | PAGINATION_PRESENT |
| walletList | GET | /v1/wallets | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| walletStatement | GET | /v1/wallets/{walletId}/statement | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| escrowList | GET | /v1/escrow | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| sarList | GET | /v1/compliance/sar | KYC & Compliance | PaginatedResponse | PAGINATION_PRESENT |
| safeguardingSnapshots | GET | /v1/safeguarding/snapshots | KYC & Compliance | PaginatedResponse | PAGINATION_PRESENT |
| payoutRails | GET | /v1/payouts/rails | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| slaMetrics | GET | /v1/sla/metrics | Monitoring | PaginatedResponse | PAGINATION_PRESENT |
| slaIncidentList | GET | /v1/sla/incidents | Monitoring | PaginatedResponse | PAGINATION_PRESENT |
| webhookV2List | GET | /v1/webhooks/v2/endpoints | Webhooks | PaginatedResponse | PAGINATION_PRESENT |
| webhookV2Deliveries | GET | /v1/webhooks/v2/deliveries | Webhooks | PaginatedResponse | PAGINATION_PRESENT |
| sandboxScenarioList | GET | /v1/sandbox/payout-sim | Sandbox | PaginatedResponse | PAGINATION_PRESENT |
| reconciliationMismatches | GET | /v1/reconciliation/mismatches | Payment Gateway | PaginatedResponse | PAGINATION_PRESENT |
| banksList | GET | /v1/banks | Bank Directory | PaginatedResponse | PAGINATION_PRESENT |
| connectorsList | GET | /v1/banks/{bankId}/connectors | Bank Connectors | PaginatedResponse | PAGINATION_PRESENT |
| interbankPaymentsList | GET | /v1/interbank/payments | Interbank | PaginatedResponse | PAGINATION_PRESENT |
| interbankParticipantsList | GET | /v1/interbank/participants | Interbank | PaginatedResponse | PAGINATION_PRESENT |
| interbankMessagesList | GET | /v1/interbank/messages | Interbank | PaginatedResponse | PAGINATION_PRESENT |
| bankPaymentsList | GET | /v1/banks/{bankId}/payments | Bank Connectors | PaginatedResponse | PAGINATION_PRESENT |
| merchantsQrDirectoryList | GET | /v1/merchants/qr-directory | Payments | array/list | UNKNOWN_REQUIRES_DECISION |
| listWebhookDlq | GET | /v1/webhooks/dlq | Webhooks | array/list | UNKNOWN_REQUIRES_DECISION |
| agentList | GET | /v1/agents | Agents | array/list | UNKNOWN_REQUIRES_DECISION |
| agentTransactionList | GET | /v1/agents/{agentId}/transactions | Agents | array/list | UNKNOWN_REQUIRES_DECISION |
| cemacCorridorsList | GET | /v1/remittance/cemac/corridors | CEMAC Remittance | array/list | UNKNOWN_REQUIRES_DECISION |

## 2. Domain roll-up

| Domain | Collection ops |
|--------|---------------|
| Payment Gateway | 24 |
| Admin | 7 |
| AISP | 6 |
| Webhooks | 5 |
| Merchant Onboarding | 4 |
| Interbank | 3 |
| Loans | 2 |
| Savings | 2 |
| Ledger | 2 |
| Virtual Cards | 2 |
| Operational Controls | 2 |
| Approval Workflows | 2 |
| KYC & Compliance | 2 |
| Monitoring | 2 |
| Bank Connectors | 2 |
| Agents | 2 |
| Certificates, Consent Management, Credit Scoring, WooCommerce, Sandbox, Bank Directory, Payments, CEMAC Remittance | 1 each |

## 3. Notes

- The 5 array-shaped (non-PaginatedResponse) operations (`merchantsQrDirectoryList`, `listWebhookDlq`, `agentList`, `agentTransactionList`, `cemacCorridorsList`) still pass G4 because they declare `LimitParam`/`CursorParam` refs even though the response is an unwrapped array. They are flagged `UNKNOWN_REQUIRES_DECISION` in §4 of the exemption report — either they must adopt the canonical envelope or an explicit bounded-collection exemption must be recorded.
- Stream/export candidates: `getStatementContent`, `gatewayReportTransactions`, `gatewayReportSettlements`, `safeguardingSnapshots` — reports may deliver bounded windows; classified in the mismatch register.
- No POST/PUT search endpoints returning collections were found (searched for schemas with `data:array` in non-GET verbs — none matched).
