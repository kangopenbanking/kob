# Phase 1B — R1I-d.0 — Contract / Runtime Mismatch Register

**Legend:**
- **C1** Contract documents pagination; runtime ignores it.
- **C2** Runtime paginates; contract does not document it.
- **C3** Contract and runtime use different parameter names.
- **C4** Response metadata documented but absent.
- **C5** Response metadata returned but undocumented.
- **C6** Maximum/default values differ.
- **C7** Ordering is undocumented or unstable.
- **C8** Count semantics are incorrect.
- **C9** Cursor is unsafe or cross-scope reusable.
- **C10** Query is unbounded.
- **C11** Collection qualifies for a bounded exemption.
- **C12** Operation is not wired.

## 1. Register

| Operation | Class(es) | Evidence |
|-----------|-----------|----------|
| aispTransactions | C7 (partial), C9 | Ordering stable in code; cursor unsigned. |
| aispAccounts | C9 | Cursor unsigned. |
| aispBalances | C7 | `balances` typically per-account; per-op cardinality small — could be C11. |
| consentsList | C9 | Cursor unsigned. |
| gatewayListCharges | C7, C8 (if `count:'exact'`) | `created_at DESC` no tie-breaker; count on high-volume table. |
| gatewayListRefunds | C7 | Same. |
| gatewayListPayouts | C7, C9 (provider branch) | Provider token pass-through unverified. |
| gatewayListDisputes | C7 | Same. |
| gatewayListSettlements | C7 | Same. |
| gatewayListSubscriptions | C7 | Same. |
| gatewayListCustomers | C7 | Same. |
| gatewayListCustomerTokens | C7 | Same. |
| gatewayListPaymentLinks | C7 | Same. |
| gatewayListPaymentPlans | C7 | Same. |
| gatewayListSubaccounts | C7 | Same. |
| gatewayListBeneficiaries | C7 | Same. |
| gatewayGetChargeEvents | C7 | Same. |
| gatewayListReconciliationRuns | C7 | Same. |
| gatewayListFundingIntents | C7 | Same. |
| gatewayListVirtualAccounts | C7 | Same. |
| gatewayGetMerchantBalance | (misclassified? — balance is a resource, response wraps `data[]` per currency) | Review — possibly single-resource w/ nested array (not a paginated list). |
| gatewayReportTransactions | C10 (in-memory), C8 | Suspected aggregation, requires runtime open. |
| gatewayReportSettlements | C10, C8 | Same. |
| walletStatement | C7 | High-volume `transactions` scan. |
| walletList | C7 | |
| escrowList | C7 | |
| webhookList | C7 | |
| webhookDeliveries | C7, C8 | High-volume table. |
| webhookV2List | C7 | |
| webhookV2Deliveries | C7, C8 | |
| listWebhookDlq | C4, C7, C10 | Array response; no envelope; potentially unbounded. |
| adminSandboxAccounts | C7 | |
| adminWebhooks | C7 | |
| adminTransactionReview | C7, C8, DoS | Cross-tenant scan. |
| adminListLoans | C7 | |
| adminListSavings | C7 | |
| adminListConsents | C7 | |
| adminManageBranches | C7 | |
| listWithdrawalPolicies | C7 | |
| listStaffAuthorizations | C7 | |
| listWithdrawalRequests | C7 | |
| listApprovals | C7 | |
| loanProducts | C11 candidate | Static per institution. |
| loanSchedule | C7 stable order — OK | Suggest C11 (bounded by term). |
| savingsProducts | C11 candidate | |
| listSavingsAccounts | C7 | |
| ledgerAccounts | C11 candidate | Institution-bounded. |
| journalList | C7, C8 | High-volume. |
| virtualCardList | C7 | |
| virtualCardTransactions | C7 | |
| merchantList | C7 | |
| merchantListApiKeys | C7 | |
| merchantListSettlementAccounts | C7 | |
| merchantListWebhooks | C7 | |
| merchantsQrDirectoryList | C4, C10, C11 candidate | Array response; likely small. |
| creditScoreTips | C11 candidate | Static tip catalog. |
| certificateList | C7 | Bounded per TPP; low risk. |
| sarList | C7 | |
| safeguardingSnapshots | C7, C11 candidate | Snapshot-time aggregation. |
| payoutRails | C11 candidate | Static rail directory. |
| slaMetrics | C7 | |
| slaIncidentList | C7 | |
| sandboxScenarioList | C11 candidate | Small static catalog. |
| reconciliationMismatches | C7 | |
| banksList | C11 (exempt) | Bounded reference directory. |
| connectorsList | C11 (exempt) | Bounded per bank. |
| bankPaymentsList | C7 | |
| interbankPaymentsList | C7, C8 | High-volume. |
| interbankParticipantsList | C11 candidate | Directory-scale. |
| interbankMessagesList | C7, C8 | Very high-volume. |
| woocommerceListTransactions | C7 | |
| agentList | C4, C7, C11 candidate | Array response. |
| agentTransactionList | C4, C7, C10 | Array response; only `limit` documented. |
| cemacCorridorsList | C4, C11 (exempt) | Array response; static reference. |

## 2. Summary counts

- **C11 (bounded exemption candidates):** 12 operations — will be individually justified in d.1 with a documented cap.
- **C7 (unstable ordering):** ≈52 operations — dominant defect class.
- **C4 / C10 (array-shaped or unbounded):** 5 operations.
- **C8 (count semantics on high-volume tables):** ≈10 operations.
- **C9 (unsafe cursor):** all 6 current cursor implementations (unsigned tokens).
- **C1 / C2 / C3 / C5 / C6 / C12:** none confirmed.

## 3. No mismatch resolved in R1I-d.0

Register is diagnostic only.
