// ============================================================
// @kangopenbanking/sdk
// Official Kang Open Banking SDK for Node.js / TypeScript
// Version 1.4.0 — adds Phase 3 MerchantOpsResource (exports,
// statements, reconciliation, api-keys, webhook deliveries).
// ============================================================

export { KangOpenBanking, KOBError } from './client';
export * from './types';
export * from './integration';
export {
  MerchantOpsResource,
  type ExportFilters,
  type ExportJob,
  type ExportFormat,
  type StatementRequest,
  type ReconciliationRunRequest,
  type MerchantApiKey,
  type MerchantWebhookEndpoint,
  type WebhookDelivery,
} from './phase3';
export { qr, type QRDirectoryMerchant, type QRDirectoryFilters } from './qr';
export {
  GlobalAccountsResource,
  type NiumGlobalAccount,
  type NiumIncomingPayment,
  type NiumPayoutPreferenceDefaults,
  type ListGlobalAccountsResponse,
  type CreateGlobalAccountRequest,
  type CreateGlobalAccountResponse,
  type UpdatePayoutPreferenceRequest,
  type PayoutPreference,
  type GlobalAccountCurrency,
  type GlobalAccountStatus,
  type NiumMode,
} from './global-accounts';
export {
  BeneficiariesResource,
  PayoutsResource as NiumPayoutsResource,
  ConversionsResource as NiumConversionsResource,
  RfiResource as NiumRfiResource,
  type NiumCurrency,
  type NiumAccountKind,
  type NiumBeneficiary,
  type NiumPayout,
  type NiumConversion,
  type NiumRfi,
} from './nium';
