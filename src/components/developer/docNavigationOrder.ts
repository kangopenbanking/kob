/**
 * Defines the canonical reading order for the developer portal.
 * Each entry maps a route path to a human-readable title.
 * The order follows the Stripe-like sequential flow:
 * Home → Getting Started → Auth → Sandbox → API Ref → Gateway → Open Banking → etc.
 *
 * DocNavigation prev/next links are derived automatically from this list
 * via the useDocNavigation() hook — no manual props needed.
 */

export interface DocNavEntry {
  title: string;
  path: string;
}

export const DOC_NAV_ORDER: DocNavEntry[] = [
  // ── 1. Overview ──
  { title: "Developer Home", path: "/developer" },
  { title: "Getting Started", path: "/developer/getting-started" },
  { title: "Changelog", path: "/developer/changelog" },
  { title: "Forum", path: "/developer/forum" },
  { title: "Widgets SDK", path: "/developer/widgets" },
  { title: "Test Report", path: "/developer/test-report" },
  { title: "Status", path: "/developer/status" },
  { title: "Support", path: "/developer/support" },
  { title: "Access Policy", path: "/developer/access-policy" },

  // ── 2. Authentication ──
  { title: "Authentication Overview", path: "/developer/authentication" },
  { title: "API Keys", path: "/developer/authentication/api-keys" },
  { title: "OAuth 2.0 / PKCE", path: "/developer/authentication/oauth2" },
  { title: "FAPI 1.0 Advanced", path: "/developer/authentication/fapi" },
  { title: "mTLS", path: "/developer/authentication/mtls" },

  // ── 3. Sandbox ──
  { title: "Sandbox Overview", path: "/developer/sandbox/overview" },
  { title: "Sandbox Credentials", path: "/developer/sandbox/credentials" },
  { title: "Test Cards", path: "/developer/sandbox/test-cards" },
  { title: "Test Mobile Money", path: "/developer/sandbox/mobile-money" },
  { title: "Simulate Webhooks", path: "/developer/sandbox/simulate-webhooks" },

  // ── 4. API Reference ──
  { title: "API Reference", path: "/developer/api-reference" },
  { title: "Error Codes", path: "/developer/api/error-codes" },
  { title: "Rate Limits", path: "/developer/api/rate-limits" },
  { title: "Idempotency", path: "/developer/api/idempotency" },
  { title: "Pagination", path: "/developer/api-reference/pagination" },
  { title: "Versioning", path: "/developer/api-reference/versioning" },
  { title: "Currencies", path: "/developer/api/currencies" },
  { title: "Countries", path: "/developer/api/countries" },
  { title: "API Explorer", path: "/developer/api-explorer" },
  { title: "SDKs & Libraries", path: "/developer/guides/sdks" },
  { title: "Postman Collection", path: "/developer/guides/postman" },

  // ── 5. Payment Gateway ──
  { title: "Gateway Quickstart", path: "/developer/gateway/quickstart" },
  { title: "Charges", path: "/developer/gateway/charges" },
  { title: "Refunds", path: "/developer/gateway/refunds" },
  { title: "Payouts", path: "/developer/gateway/payouts" },
  { title: "Gateway Webhooks", path: "/developer/gateway/webhooks" },
  { title: "Subscriptions", path: "/developer/gateway/subscriptions" },
  { title: "Payment Links", path: "/developer/gateway/payment-links" },
  { title: "Virtual Accounts", path: "/developer/gateway/virtual-accounts" },
  { title: "Tokenisation", path: "/developer/gateway/tokenization" },
  { title: "Disputes", path: "/developer/gateway/disputes" },
  { title: "Settlements", path: "/developer/gateway/settlements" },
  { title: "Split Payments", path: "/developer/gateway/split-payments" },
  { title: "BYO Mobile Money", path: "/developer/connectors/byo-mobile-money" },
  { title: "Merchant Wallet", path: "/developer/gateway/merchant-wallet" },
  { title: "Verification", path: "/developer/gateway/verification" },
  { title: "Funding", path: "/developer/gateway/funding" },
  { title: "Funding Intents", path: "/developer/gateway/funding-intents" },
  { title: "Wallets", path: "/developer/gateway/wallets" },
  { title: "Escrow", path: "/developer/gateway/escrow" },
  { title: "Compliance Screening", path: "/developer/gateway/compliance" },
  { title: "Instant Payouts", path: "/developer/gateway/instant-payouts" },
  { title: "Treasury", path: "/developer/gateway/treasury" },
  { title: "Webhooks V2", path: "/developer/gateway/webhooks-v2" },
  { title: "SLA Monitor", path: "/developer/gateway/sla" },
  { title: "Charge Events", path: "/developer/gateway/charge-events" },
  { title: "PayPal Integration", path: "/developer/gateway/paypal" },

  // ── 6. Open Banking ──
  { title: "Open Banking Overview", path: "/developer/open-banking" },
  { title: "Open Banking Standards", path: "/developer/open-banking/standards" },
  { title: "Bank Onboarding", path: "/developer/bank-onboarding" },
  { title: "AISP Guide", path: "/developer/open-banking/aisp" },
  { title: "PISP Guide", path: "/developer/open-banking/pisp" },
  { title: "Consents", path: "/developer/open-banking/consents" },
  { title: "Pay by Bank", path: "/developer/open-banking/pay-by-bank" },

  // ── 7. Mobile Money ──
  { title: "Mobile Money Overview", path: "/developer/mobile-money" },
  { title: "MTN MoMo", path: "/developer/mobile-money/mtn" },
  { title: "Orange Money", path: "/developer/mobile-money/orange" },

  // ── 8. Compliance ──
  { title: "KYC Guide", path: "/developer/compliance/kyc" },
  { title: "AML & SAR", path: "/developer/compliance/aml" },
  { title: "FAPI Security", path: "/developer/compliance/fapi" },

  // ── 9. ISO 20022 ──
  { title: "ISO 20022 Overview", path: "/developer/iso20022" },
  { title: "ISO 20022 Messages", path: "/developer/iso20022/messages" },

  // ── 10. Examples ──
  { title: "Code Examples", path: "/developer/examples" },
  { title: "Real-World Integrations", path: "/developer/examples/real-world" },

  // ── 11. Guides ──
  { title: "Go-Live Checklist", path: "/developer/guides/go-live" },
  { title: "Migration Guide", path: "/developer/migrate" },
  { title: "Web Integration", path: "/developer/guides/web" },
  { title: "Mobile Integration", path: "/developer/guides/mobile" },

  // ── 12. Remittance API ──
  { title: "Remittance Overview", path: "/developer/remittance" },
  { title: "Corridors & Quotes", path: "/developer/remittance/corridors-quotes" },
  { title: "Create Transfer", path: "/developer/remittance/create-transfer" },
  { title: "Pay-in Methods", path: "/developer/remittance/payin-methods" },
  { title: "Payout Methods", path: "/developer/remittance/payout-methods" },
  { title: "Remittance Webhooks", path: "/developer/remittance/webhooks" },
  { title: "Remittance Sandbox", path: "/developer/remittance/sandbox" },
  { title: "Remittance Errors", path: "/developer/remittance/errors" },

  // ── 13. Additional Reference ──
  { title: "Banking Operations", path: "/developer/api/banking" },
  { title: "Transfers", path: "/developer/api/transfers" },
  { title: "API Webhooks", path: "/developer/api/webhooks" },
  { title: "Beneficiaries", path: "/developer/api/beneficiaries" },
  { title: "Refunds API", path: "/developer/api/refunds" },
  { title: "Settlements API", path: "/developer/api/settlements" },
  { title: "Disputes API", path: "/developer/api/disputes" },
  { title: "Exports", path: "/developer/api/exports" },
  { title: "Risk & Audit", path: "/developer/api/risk-audit" },
  { title: "Certificates", path: "/developer/api/certificates" },
  { title: "Mobile Money API", path: "/developer/api/mobile-money" },
  { title: "AISP Reference", path: "/developer/api/aisp" },
  { title: "PISP Reference", path: "/developer/api/pisp" },
  { title: "Testing Guide", path: "/developer/api/testing" },
];

/**
 * Given a pathname, returns the previous and next navigation entries.
 */
export function getDocNavigation(pathname: string): {
  previousPage?: DocNavEntry;
  nextPage?: DocNavEntry;
} {
  const index = DOC_NAV_ORDER.findIndex((entry) => entry.path === pathname);
  if (index === -1) return {};
  return {
    previousPage: index > 0 ? DOC_NAV_ORDER[index - 1] : undefined,
    nextPage: index < DOC_NAV_ORDER.length - 1 ? DOC_NAV_ORDER[index + 1] : undefined,
  };
}
