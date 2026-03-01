import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertTriangle, Zap, Bug, Plus } from "lucide-react";

export default function Changelog() {
  const releases = [
    {
      version: "3.5.0",
      date: "2026-03-01",
      type: "minor",
      changes: [
        { type: "feature", description: "Cameroon Banking Identifiers — full RIB (23-digit) and IBAN (27-char) validation with MOD-97 checksum verification" },
        { type: "feature", description: "validate-rib edge function — validates Cameroon domestic RIB structure, computes MOD-97 key, derives corresponding IBAN" },
        { type: "feature", description: "validate-account-identifier edge function — unified validator mapping identifiers to transfer rails (DOMESTIC, INTERNATIONAL, LOCAL)" },
        { type: "feature", description: "directory-banks-cm edge function — static directory of 15 Cameroon banks with 5-digit codes, SWIFT BICs, and RIB support flags" },
        { type: "feature", description: "DOMESTIC_RIB added to account_scheme enum — accounts table now stores structured RIB fields (bank_code, branch_code, account_number, rib_key)" },
        { type: "feature", description: "Beneficiary creation enhanced with structured account_identifier input — auto-enriches bank metadata from RIB code" },
        { type: "feature", description: "Transfer rail auto-selection — internal (same bank), domestic_interbank (different CM banks), international (IBAN cross-border)" },
        { type: "feature", description: "BIC/SWIFT validation alongside RIB and IBAN for full international wire transfer compliance" },
        { type: "improvement", description: "Customer App: Bank Account (RIB) linking with bank selector, auto-formatting input mask, and client-side MOD-97 validation" },
        { type: "improvement", description: "Customer App: International (IBAN) account linking with formatting and length validation" },
        { type: "improvement", description: "Banking App Send Money: identifier type selector (RIB/IBAN/Account Number) with real-time validation hints" },
        { type: "improvement", description: "OpenAPI spec updated with validate-rib, validate-account-identifier, directory-banks-cm endpoints and Account schema RIB fields" },
        { type: "improvement", description: "Postman collection updated with Cameroon Banking Identifiers folder containing validation and directory requests" },
      ]
    },
    {
      version: "3.4.0",
      date: "2026-02-27",
      type: "minor",
      changes: [
        { type: "feature", description: "Funding Intents API — canonical domain for account funding with full lifecycle tracking (created → pending → succeeded/failed/cancelled/expired)" },
        { type: "feature", description: "4 new endpoints: Create, Get, List, Cancel Funding Intent under /v1/gateway/*" },
        { type: "feature", description: "PayPal inbound funding — create PayPal checkout orders, auto-capture on approval, webhook finalization via PAYMENT.CAPTURE.COMPLETED" },
        { type: "feature", description: "Bank transfer funding instructions — generate unique reference + bank details for manual bank transfer funding" },
        { type: "feature", description: "Funding reconciliation job — auto-polls stuck intents from Flutterwave, Stripe, PayPal; expires intents older than 24h" },
        { type: "feature", description: "Stripe webhook auto-credit for funding intents — payment_intent.succeeded now finalizes funding_intents and credits account" },
        { type: "feature", description: "Flutterwave webhook funding intent finalization — matches by tx_ref reference" },
        { type: "feature", description: "PayPal webhook funding intent finalization — handles CHECKOUT.ORDER.APPROVED (auto-capture) and PAYMENT.CAPTURE.COMPLETED" },
        { type: "feature", description: "Immutable funding_events table — records created, webhook, reconciled, cancelled, expired events per intent" },
        { type: "feature", description: "Idempotency enforcement — Idempotency-Key header with unique constraint per (account_id, key)" },
        { type: "improvement", description: "Developer portal: Funding Intents Guide with provider-specific tabs (MoMo, Card, PayPal, Bank)" },
        { type: "improvement", description: "Legacy Account Funding page marked with recommended migration notice" },
        { type: "improvement", description: "Developer sidebar updated with Funding Intents link" },
      ]
    },
    {
      version: "3.3.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "feature", description: "Multi-Tenancy Apps Showcase page at /apps — animated landing page presenting the PWA ecosystem (Banking, Merchant, Customer apps)" },
        { type: "feature", description: "Banking App (Phase 1) live demo link with feature overview (Wallet, P2P Transfers, Virtual Cards, Transaction History, KYC, QR Payments)" },
        { type: "feature", description: "Merchant App (Phase 2) and Customer App (Phase 3) placeholder cards with planned feature lists and Coming Soon badges" },
        { type: "feature", description: "Multi-tenancy branding demo section showing how different institutions (Afriland, Ecobank, UBA) get unique app branding" },
        { type: "feature", description: "Technical Architecture section explaining TenantProvider context flow and route structure (/bank/:id, /merchant/:id, /app/:id)" },
        { type: "improvement", description: "Apps Ecosystem link added to main navigation Platform mega-menu" },
        { type: "improvement", description: "Index page portal section updated with Apps Ecosystem banner linking to /apps" },
      ]
    },
    {
      version: "3.2.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "feature", description: "Cameroon Regulatory Filing Pack — 10 submission-ready documents for BEAC/COBAC PSP license application" },
        { type: "feature", description: "Filing Pack Index hub page with readiness score (78/100), document index, gap assessment, and operational checklist" },
        { type: "feature", description: "Corporate Structure & Governance — shareholding, UBO declaration, board composition, MLRO/CO appointments, org chart" },
        { type: "feature", description: "Internal Control Policy — three lines of defence, risk/compliance/audit committee structures, control matrix" },
        { type: "feature", description: "PSP License Application — CEMAC Regulation No. 04/18 application, settlement flows, processor disclosure, safeguarding model, capital adequacy" },
        { type: "feature", description: "Business Continuity & Disaster Recovery — RTO/RPO targets, failover architecture, incident escalation matrix, testing schedule" },
        { type: "feature", description: "AML/CFT Compliance Pack — tiered KYC, STR escalation process, sanctions screening, PEP framework, record retention, internal SAR form template" },
        { type: "feature", description: "Data Protection Policy — CEMAC data protection framework, retention schedules, cross-border transfer safeguards" },
        { type: "feature", description: "Technical System Disclosure — regulator-friendly architecture, encryption model, mTLS, audit immutability, reconciliation, idempotency" },
        { type: "feature", description: "Risk Assessment Matrix — probability/impact grid, 8-risk register with inherent/residual scoring and mitigation strategies" },
        { type: "feature", description: "Regulatory Reporting Templates — daily volume, settlement, fraud, chargeback, STR summary, monthly compliance declaration" },
        { type: "improvement", description: "Navigation updated with Filing Pack link under Compliance mega-menu" },
      ]
    },
    {
      version: "3.1.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "feature", description: "New shared StatCard component with icon, trend indicator, and sparkline support — replaces ad-hoc metric cards across all portals" },
        { type: "feature", description: "New DataTablePagination component with page size selector, first/last page controls, and range display" },
        { type: "feature", description: "New EmptyState component with icon, title, description, and optional CTA — replaces plain 'No data' text" },
        { type: "feature", description: "New DateRangePicker with presets (Today, 7d, 30d, 90d, This/Last month) and custom calendar range selection" },
        { type: "feature", description: "New TransactionDetailSheet — slide-out panel showing full transaction details, timeline, and provider response JSON" },
        { type: "improvement", description: "Merchant Dashboard: wallet balance cards, dispute count badge, quick actions (Payment Link, Invoice, API Keys, New Charge), sparkline revenue trend" },
        { type: "improvement", description: "Merchant Analytics: KPI stat cards (Volume, Avg Tx, Refund Rate, Chargeback Rate), Area chart revenue trend, status donut chart, date range picker" },
        { type: "improvement", description: "Merchant Payouts: search + status filters, summary stats, CSV export, pagination, detail sheet on click" },
        { type: "improvement", description: "Merchant Settlements: summary stats (settled, fees, pending), search + filters, pagination, detail sheet on click" },
        { type: "improvement", description: "Merchant Transactions: date range filter, pagination with page size selector, stat cards, detail sheet on click" },
        { type: "improvement", description: "Merchant Refunds: search + status filter, summary stats, pagination, detail sheet on click" },
        { type: "improvement", description: "FI Portal Analytics: replaced period dropdown with DateRangePicker, StatCard components, Area chart, donut with inner radius" },
        { type: "improvement", description: "FI Portal Transactions: StatCard summary row, DataTablePagination, TransactionDetailSheet on row click" },
        { type: "improvement", description: "Admin Transaction Monitoring: StatCard components replace manual Card+CardHeader pattern" },
      ]
    },
    {
      version: "3.0.0",
      date: "2026-02-26",
      type: "major",
      changes: [
        { type: "feature", description: "30+ new institutional pages: Regulatory, Compliance, Architecture, Expansion, Investor, API Reference, Certification" },
        { type: "feature", description: "Header navigation restructured: Platform, Compliance, Expansion, Developers, Resources mega-menus" },
        { type: "feature", description: "Footer restructured: Company, Developers, Compliance, Infrastructure, Expansion, Legal sections" },
        { type: "feature", description: "Cameroon Regulatory Compliance page — BEAC/COBAC framework, PSP licensing, AML/CFT, reporting obligations" },
        { type: "feature", description: "AML Policy, KYC Framework, Risk Monitoring compliance documentation" },
        { type: "feature", description: "Fraud Engine architecture — 5-layer defence model with processor signal integration" },
        { type: "feature", description: "Double-Entry Ledger System documentation — journal-post, atomic wallets, integrity guarantees" },
        { type: "feature", description: "Reconciliation Framework — three-way reconciliation, stuck transaction recovery" },
        { type: "feature", description: "Settlement Engine — lifecycle, calculation, payout channels, safety mechanisms" },
        { type: "feature", description: "6 Multi-Country Expansion pages: Cameroon, Nigeria, Ghana, Kenya, South Africa, Europe" },
        { type: "feature", description: "Infrastructure & Disaster Recovery documentation — RTO/RPO targets, backup strategy" },
        { type: "feature", description: "Incident Response framework — severity classification, response lifecycle, regulatory notifications" },
        { type: "feature", description: "7 API Reference pages: Versioning, Error Codes, Webhooks (24 events), Idempotency, Rate Limits, Sandbox Testing, Security" },
        { type: "feature", description: "4 Investor pages: Technical Overview, Risk Disclosure, Compliance Status, Infrastructure Maturity (90/100)" },
        { type: "feature", description: "A-Grade Certification Status page with 6-domain scoring system" },
        { type: "feature", description: "Sandbox Simulation Tools — fraud, dispute, refund, webhook replay, latency injection, settlement simulation" },
      ]
    },
    {
      version: "2.9.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "fix", description: "CRITICAL: OpenAPI grant_type enum now includes client_credentials — server-to-server integrations no longer fail strict OpenAPI validators" },
        { type: "fix", description: "CRITICAL: OAuth token request schema adds client_secret and scope properties to match implementation" },
        { type: "fix", description: "HIGH: Idempotency-Key header marked required: true (was false) per architecture mandate" },
        { type: "fix", description: "HIGH: Retry-After header documented in 429 rate-limit response" },
        { type: "fix", description: "HIGH: x-consent-id header added to all AISP endpoints (accounts, balances, transactions, beneficiaries, standing orders, direct debits)" },
        { type: "feature", description: "24 webhook event types enumerated in WebhookEventType schema (charge, payout, refund, dispute, settlement, consent, account domains)" },
        { type: "improvement", description: "Charge event types enumerated with 8 lifecycle events (created, processing, successful, failed, cancelled, voided, captured, refunded)" },
        { type: "improvement", description: "Reconciliation request schema adds provider field (flutterwave, stripe, paypal)" },
        { type: "improvement", description: "Legacy endpoints (/v1/mobile-money/*, /v1/stripe/*, /v1/flutterwave/*) marked deprecated in favor of Gateway API" },
        { type: "improvement", description: "OpenAPI spec version updated to 2.9.0" },
        { type: "improvement", description: "Postman: client_credentials token request added to OAuth folder" },
        { type: "fix", description: "Postman: Legacy payment paths aligned with OpenAPI spec (/v1/stripe/payment-intent, /v1/flutterwave/bank-transfer)" },
        { type: "fix", description: "Postman: Virtual card paths aligned with spec (/v1/cards/* not /v1/virtual-cards/*)" },
        { type: "feature", description: "Postman: Reconciliation mismatch retrieval and resolution requests added" },
      ]
    },
    {
      version: "2.8.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "fix", description: "CRITICAL: Stripe zero-decimal currency guard — amounts now correctly converted for USD/EUR (×100) vs XAF/XOF (no conversion)" },
        { type: "fix", description: "CRITICAL: Stripe webhook signature verification now enforced — forged webhooks rejected with 401" },
        { type: "fix", description: "CRITICAL: Merchant wallet now credited on successful charge via Stripe and Flutterwave webhooks (was missing for auto-capture)" },
        { type: "fix", description: "HIGH: Over-refund guard — refunds validated against SUM(existing_refunds) to prevent exceeding original charge amount" },
        { type: "fix", description: "HIGH: Merchant wallet debited on successful refund (was missing)" },
        { type: "fix", description: "HIGH: Merchant wallet debited on dispute creation, re-credited on dispute won" },
        { type: "fix", description: "HIGH: Settlement cron date mutation bug fixed — each institution now uses fresh Date objects" },
        { type: "improvement", description: "PayPal added to valid charge channels (was rejected with invalid_channel)" },
        { type: "fix", description: "Subscription event no longer writes to gateway_charge_events with subscription UUID as charge_id" },
        { type: "improvement", description: "Dispute lifecycle: charge.dispute.closed event now handles won/lost with wallet re-credit for won disputes" },
      ]
    },
    {
      version: "2.7.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "feature", description: "Woo for Kang v1.0.0 — complete production-ready WordPress plugin ZIP download (9 files)" },
        { type: "feature", description: "Plugin ZIP edge function generates in-memory ZIP with gateway, API client, webhooks, logger, templates, readme, license, and uninstall handler" },
        { type: "feature", description: "OpenAPI spec: 6 WooCommerce endpoints with full request/response schemas (was 3 stubs)" },
        { type: "feature", description: "Postman collection: 6 WooCommerce requests with complete example bodies (was 3)" },
        { type: "improvement", description: "API base URL fixed to production pattern (https://api.kangopenbanking.com/functions/v1)" },
        { type: "improvement", description: "WFK_PLUGIN_DIR constant added — fixes require path errors in plugin" },
        { type: "improvement", description: "Webhook handler rewritten with proper static dispatch, HMAC-SHA256 verification, and idempotency" },
        { type: "improvement", description: "Plugin code viewer updated with complete file set and corrected code" },
        { type: "fix", description: "Download buttons now generate actual ZIP file instead of showing 'packaging in progress'" },
        { type: "fix", description: "WooCommerce Guide page updated — removed early access banner, replaced with download-ready state" },
      ]
    },
    {
      version: "2.6.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "feature", description: "OpenAPI spec expanded with 39 missing endpoint paths — Payment Links, Payment Plans, Subscriptions, Split Payments, Tokenization, Charge Events, Reconciliation, Fee Reports, Payout Retry" },
        { type: "feature", description: "Merchant Onboarding API fully documented — lifecycle, KYB verification, API keys, settlement accounts, webhooks (13 endpoints)" },
        { type: "feature", description: "9 new OpenAPI schemas: GatewayPaymentLink, GatewayPaymentPlan, GatewaySubscription, GatewaySubaccount, GatewayCustomer, GatewayCustomerToken, GatewayChargeEvent, GatewayReconciliationRun, GatewayMerchant" },
        { type: "improvement", description: "Fee estimate channel enum updated to support all 8 channels (mobile_money, card, bank_transfer, apple_pay, google_pay, ussd, account_funding, paypal)" },
        { type: "improvement", description: "Charge channel enum synchronized with GatewayCharge schema (7 channels including apple_pay, google_pay, ussd, paypal)" },
        { type: "improvement", description: "Payment Facilitation and Merchant Onboarding tags added to OpenAPI spec" },
        { type: "fix", description: "Duplicate Settlement path definitions resolved — Settlement tag dead code removed" },
        { type: "fix", description: "Developer portal sidebar de-duplicated — Payment Facilitation no longer appears in both Open Banking and Integration Guides" },
      ]
    },
    {
      version: "2.5.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "feature", description: "PayPal Payouts API — send money to PayPal/Venmo recipients via EMAIL, PHONE, or PAYPAL_ID" },
        { type: "feature", description: "PayPal Withdrawal — withdraw KOB account balance to PayPal with automatic failure reversal" },
        { type: "feature", description: "PayPal Webhook receiver with CRC32+SHA256 signature verification via PayPal's API" },
        { type: "feature", description: "PayPal OAuth2 token adapter with in-memory caching and auto-refresh (5-min safety buffer)" },
        { type: "feature", description: "PayPal fee tier added to gateway fee engine (3.5% + 150 XAF fixed)" },
        { type: "improvement", description: "Developer portal: PayPal Integration Guide with authentication, payouts, withdrawals, webhooks docs" },
        { type: "improvement", description: "OpenAPI spec updated with PayPal payout and withdrawal endpoints" },
        { type: "improvement", description: "Postman collection expanded with PayPal Payout, Get Status, and Withdraw requests" },
        { type: "improvement", description: "Gateway Webhooks Guide updated with PayPal event types" },
        { type: "improvement", description: "Transfers Guide updated — 7 transfer channels (added PayPal)" },
      ]
    },
    {
      version: "2.4.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "feature", description: "Internal Account Transfer endpoint — POST /v1/banking/internal-transfer for KOB-to-KOB transfers with balance validation" },
        { type: "feature", description: "Facilitated Bank Transfer endpoint — POST /v1/banking/facilitated-transfer for institution-facilitated Flutterwave payouts with KOB fee calculation" },
        { type: "feature", description: "Unified Transfers & Fund Movement guide — new developer portal page documenting all 6 transfer channels" },
        { type: "improvement", description: "BankingReference expanded with Internal Account Transfer and Mobile Money to Bank sections" },
        { type: "improvement", description: "OpenAPI spec updated with /v1/banking/internal-transfer and /v1/banking/facilitated-transfer endpoints" },
        { type: "improvement", description: "Postman collection expanded with Internal Account Transfer and Facilitated Bank Transfer requests" },
        { type: "improvement", description: "E2E test suite expanded with Open Banking consent lifecycle and transfer endpoint coverage" },
      ]
    },
    {
      version: "2.3.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "feature", description: "Transaction Risk Scoring API — POST /v1/gateway/risk/score with velocity, amount-threshold, and pattern-anomaly checks" },
        { type: "feature", description: "Gateway Exchange Rate API — GET /v1/gateway/exchange-rate for real-time multi-currency FX lookups under the Payment Gateway tag" },
        { type: "feature", description: "Invoice generation documented in Subscriptions guide with POST /v1/invoices/generate endpoint" },
        { type: "improvement", description: "Fee estimate expanded to support account_funding, ussd, apple_pay, and google_pay channels" },
        { type: "improvement", description: "OpenAPI spec updated with /v1/gateway/risk/score and /v1/gateway/exchange-rate endpoints" },
        { type: "improvement", description: "Postman collection expanded with Score Transaction Risk and Gateway Exchange Rate requests" },
        { type: "improvement", description: "RiskAuditReference developer page updated with transaction risk scoring documentation" },
      ]
    },
    {
      version: "2.2.0",
      date: "2026-02-26",
      type: "minor",
      changes: [
        { type: "feature", description: "Account Funding API — Fund KOB accounts via Mobile Money, Card, or Bank Transfer (gateway-fund-account)" },
        { type: "feature", description: "Withdraw to Bank API — Withdraw from KOB account to external bank via Flutterwave (gateway-withdraw-to-bank)" },
        { type: "feature", description: "Auto-credit webhook handler — gateway-webhook-flutterwave auto-credits user account on successful fund-account charges" },
        { type: "feature", description: "Withdrawal reversal — Automatic debit reversal when payout fails via webhook" },
        { type: "feature", description: "Account funding fee tier (2.5%, 0 fixed) added to gateway adapters" },
        { type: "improvement", description: "OpenAPI spec updated with /v1/gateway/fund-account and /v1/gateway/withdraw-to-bank endpoints" },
        { type: "improvement", description: "Postman collection expanded with Fund Account and Withdraw to Bank requests" },
        { type: "improvement", description: "Developer portal updated with Account Funding guide and sidebar navigation" },
      ]
    },
    {
      version: "2.1.0",
      date: "2026-02-21",
      type: "minor",
      changes: [
        { type: "feature", description: "Payment Links API — shareable no-code checkout URLs with slug-based lookup" },
        { type: "feature", description: "Subscriptions API — payment plans with automated cron-based recurring billing" },
        { type: "feature", description: "Split Payments — marketplace subaccounts with percentage/flat split distribution" },
        { type: "feature", description: "Customer Tokenization — save payment methods and charge tokens for one-click checkout" },
        { type: "feature", description: "Charge Events timeline — granular lifecycle tracking for every charge" },
        { type: "feature", description: "Multi-currency FX support — real-time exchange rates for cross-currency settlements" },
        { type: "improvement", description: "Enhanced gateway-create-charge with payment_link_id, subaccounts, and settlement_currency" },
        { type: "improvement", description: "OpenAPI spec updated to v2.1.0 with 5 new tag domains and 12 new endpoints" },
        { type: "improvement", description: "Postman collection expanded with 15 new requests for all gateway features" },
      ]
    },
    {
      version: "2.0.0",
      date: "2026-02-16",
      type: "major",
      changes: [
        { type: "feature", description: "v1 API path standardization across all endpoints (/v1/ prefix)" },
        { type: "feature", description: "RFC 7807 error model with domain-prefixed codes (AISP_001, PISP_002)" },
        { type: "feature", description: "OAuth 2.0 + Dynamic Client Registration (DCR) + mTLS authentication" },
        { type: "feature", description: "Payment Facilitation API for white-label payment processing" },
        { type: "feature", description: "Virtual Cards API (create, topup, freeze, transactions)" },
        { type: "feature", description: "ISO 20022 messaging (PACS.008, PACS.002, PAIN.001, CAMT.053)" },
        { type: "feature", description: "SWIFT MT103/MT940 message generation and parsing" },
        { type: "feature", description: "AI agent discovery endpoints (ai-plugin.json, OpenAPI, APIs.json)" },
        { type: "feature", description: "WooCommerce plugin integration for e-commerce merchants" },
        { type: "feature", description: "Multi-currency mobile money support (8 CEMAC currencies)" },
        { type: "feature", description: "Sandbox environment with synthetic data generator" },
        { type: "improvement", description: "Idempotency-Key header enforcement on all write operations" },
        { type: "improvement", description: "Standardized offset-based pagination across all list endpoints" },
        { type: "improvement", description: "Enhanced webhook delivery with retry and dead-letter queue" },
      ]
    },
    {
      version: "1.2.0",
      date: "2025-01-15",
      type: "minor",
      changes: [
        { type: "feature", description: "Added CrediQ credit health monitoring dashboard" },
        { type: "feature", description: "New API Playground for testing public endpoints" },
        { type: "feature", description: "API Catalog with searchable endpoint directory" },
        { type: "improvement", description: "Improved API response times by 30%" },
        { type: "improvement", description: "Enhanced OpenAPI documentation" },
      ]
    },
    {
      version: "1.1.0",
      date: "2025-01-01",
      type: "minor",
      changes: [
        { type: "feature", description: "ISO20022 message parsing and generation" },
        { type: "feature", description: "SWIFT MT103 and MT940 support" },
        { type: "feature", description: "Bulk transfer operations" },
        { type: "improvement", description: "Enhanced OAuth 2.0 flows" },
        { type: "fix", description: "Fixed timezone handling in transaction timestamps" },
      ]
    },
    {
      version: "1.0.5",
      date: "2024-12-15",
      type: "patch",
      changes: [
        { type: "fix", description: "Resolved mobile money webhook delivery issues" },
        { type: "fix", description: "Fixed credit score calculation edge cases" },
        { type: "improvement", description: "Better error messages for failed payments" },
      ]
    },
    {
      version: "1.0.0",
      date: "2024-11-01",
      type: "major",
      changes: [
        { type: "feature", description: "Initial public release" },
        { type: "feature", description: "AISP (Account Information Service)" },
        { type: "feature", description: "PISP (Payment Initiation Service)" },
        { type: "feature", description: "Mobile Money integration (MTN, Orange)" },
        { type: "feature", description: "Credit scoring engine" },
        { type: "feature", description: "OAuth 2.0 authentication" },
      ]
    },
  ];

  const getChangeIcon = (type: string) => {
    switch (type) {
      case "feature": return <Plus className="h-4 w-4 text-green-600" />;
      case "improvement": return <Zap className="h-4 w-4 text-blue-600" />;
      case "fix": return <Bug className="h-4 w-4 text-orange-600" />;
      case "breaking": return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getChangeColor = (type: string) => {
    switch (type) {
      case "feature": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "improvement": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "fix": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "breaking": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-muted";
    }
  };

  const getReleaseTypeBadge = (type: string) => {
    switch (type) {
      case "major": return <Badge variant="destructive">Major Release</Badge>;
      case "minor": return <Badge variant="default">Minor Release</Badge>;
      case "patch": return <Badge variant="secondary">Patch</Badge>;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">API Changelog</h1>
        <p className="text-xl text-muted-foreground">
          Track new features, improvements, and bug fixes
        </p>
      </div>

      <div className="space-y-8">
        {releases.map((release, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <CardTitle>Version {release.version}</CardTitle>
                  {getReleaseTypeBadge(release.type)}
                </div>
                <Badge variant="outline">{release.date}</Badge>
              </div>
              <CardDescription>
                {release.changes.length} changes in this release
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {release.changes.map((change, changeIndex) => (
                  <div key={changeIndex} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getChangeIcon(change.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-xs ${getChangeColor(change.type)}`}>
                          {change.type}
                        </Badge>
                      </div>
                      <p className="text-sm">{change.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deprecation Notice */}
      <Card className="mt-12 border-yellow-500/20 bg-yellow-500/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <CardTitle className="text-yellow-600">Deprecation Notice</CardTitle>
              <CardDescription className="mt-2">
                No endpoints are currently scheduled for deprecation.
                We maintain backwards compatibility and provide at least 6 months notice before deprecating any features.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
