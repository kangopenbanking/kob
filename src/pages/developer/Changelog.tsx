import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertTriangle, Zap, Bug, Plus } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function Changelog() {
  const releases = [
    {
      version: "API Spec 4.16.0",
      date: "2026-04-17",
      type: "minor",
      changes: [
        { type: "feature", description: "Bank Profile Catalog — new public table bank_profile_presets seeded with 12 CEMAC banks (Afriland, UBA CM, Ecobank CM, BICEC, SGC, CCA, CBC, BGFI, NFC, Orabank GA, BOA CG, BEAC clearing) including recommended adapter type, endpoint templates, and integration notes" },
        { type: "feature", description: "New public edge function bank-presets — GET /functions/v1/bank-presets supports country, adapter_type, certified, and bank_code filters; cached 5 minutes; no authentication required (ORDER P1)" },
        { type: "feature", description: "New developer page /developer/connectors/cemac-bank-catalog — searchable, filterable catalog of supported CEMAC banks with one-click access to bank developer portals (ORDER P1, P5, P6)" },
        { type: "improvement", description: "Audit rebuttal published at docs/bank-connectors/audit/2026-04-rebuttal.md — maps the April 2026 external audit's six 'still-open' gaps to live shipped artefacts (5/6 already shipped in Waves 1–4, 1/6 closed by this catalog)" },
        { type: "improvement", description: "Onboarding wizard remains backwards compatible — presets are an opt-in pre-fill (STANDING ORDER 4 — additive only)" },
      ]
    },
    {
      version: "API Spec 4.15.0",
      date: "2026-04-17",
      type: "minor",
      changes: [
        { type: "feature", description: "CEMAC Universal Bank Integration — Wave 4: new public developer page /developer/connectors/cemac-bank-integration documenting the full BankConnector architecture, adapter decision matrix, delivery waves, and operating runbook (ORDER P6)" },
        { type: "improvement", description: "OpenAPI specification bumped to 4.15.0 (info.version only — zero changes to operationIds, schemas, parameters, security schemes, or response codes per STANDING ORDER 1)" },
        { type: "improvement", description: "Cross-links added between Bank Adapter Framework, Bank Onboarding Flow, and the new overview page; all Wave 4 content publicly accessible without authentication (ORDER P1, ORDER P4)" },
      ]
    },
    {
      version: "API Spec 4.14.0",
      date: "2026-04-17",
      type: "minor",
      changes: [
        { type: "feature", description: "CEMAC Universal Bank Integration — Wave 3: additive ledger columns on transactions (source_connector, sync_status, reconciliation_status, connector_audit_trail) — all nullable with defaults; existing reads unaffected (STANDING ORDER 1)" },
        { type: "feature", description: "New table bank_onboarding_records tracks the six-stage certification flow per bank with admin-only RLS" },
        { type: "feature", description: "New admin route /admin/bank-onboarding provides a stepper wizard: Assessment → Adapter → Credentials → Sandbox Test → Certification → Go Live" },
        { type: "feature", description: "New public developer guide /developer/connectors/bank-onboarding-flow documents the certification path, checklist, and ledger audit fields" },
      ]
    },
    {
      version: "API Spec 4.13.0",
      date: "2026-04-17",
      type: "minor",
      changes: [
        { type: "feature", description: "CEMAC Universal Bank Integration — Wave 2: scheduled bank polling engine with rule-based reconciliation and every-5-minute cron sweep across all enabled bank connectors" },
        { type: "feature", description: "New edge function bank-data-poller (cron */5 min) processes bank_sync_jobs, pulls accounts/balances/transactions via configured adapters, applies exponential backoff on failure (60s base, 1h cap)" },
        { type: "feature", description: "New edge function bank-reconcile-engine performs admin-triggered reconciliation against any enabled bank connector and persists outcomes to reconciliation_reports" },
        { type: "feature", description: "New tables bank_sync_jobs and reconciliation_reports with admin-only RLS" },
        { type: "improvement", description: "Safety: reconciliation engine flags discrepancies for review only — never auto-credits or moves funds (financial integrity preserved)" },
      ]
    },
    {
      version: "API Spec 4.12.0",
      date: "2026-04-17",
      type: "minor",
      changes: [
        { type: "feature", description: "CEMAC Universal Bank Integration — Wave 1: unified BankConnector interface with REST, SQL, File, and SOAP adapters; new bank-data-router with priority-based failover and full attempt audit trail" },
        { type: "feature", description: "New shared module supabase/functions/_shared/bank-connectors with a single contract: getAccountDetails, getBalance, getTransactions, initiateTransfer, reconcile, healthCheck" },
        { type: "feature", description: "Four pluggable adapters: REST (modern APIs), SQL (read-only via parameterized gateway), File (CSV/pain.001/MT940 from Storage), SOAP (legacy cores)" },
        { type: "feature", description: "New edge function bank-data-router resolves enabled adapters by priority and fails over automatically; admin-only via JWT + role check" },
        { type: "feature", description: "New tables bank_connector_configs and bank_connector_attempts with admin RLS; new developer guide /developer/connectors/bank-adapter-framework with cURL, Node, Python examples" },
        { type: "improvement", description: "Zero changes to existing /v1/* endpoints, AISP, PISP, mobile-money-charge — additive only (STANDING ORDER 1)" },
      ]
    },
    {
      date: "2026-04-17",
      type: "minor",
      changes: [
        { type: "feature", description: "BYO Phase 2 — Polling & Synthetic Webhooks: new byo-charge-poller cron reconciles pending MTN/Orange/SOAP charges every 30s with exponential backoff (30s→30m, max 20 attempts) and fires charge.completed/charge.failed via existing webhook-dispatcher (ORDER P5)" },
        { type: "feature", description: "BYO Phase 2 — SOAP Bank Adapter: new soap_bank connector implementing the unified PaymentConnector contract for legacy core-banking systems (T24, Flexcube, OBDX) with WS-Security UsernameToken authentication" },
        { type: "feature", description: "BYO Phase 2 — Multi-Rail Cross-Bank Failover: payment-router-charge now tries ALL enabled tenant connectors in priority order (rail A → rail B → … → Flutterwave fallback) and records every attempt to byo_routing_attempts for admin debugging" },
        { type: "feature", description: "New tables byo_charge_polls and byo_routing_attempts with RLS scoped to tenant owner + admin read-all; tenant_connector_id enum extended with soap_bank value (additive — STANDING ORDER 1 preserved)" },
        { type: "feature", description: "New developer guides: /developer/connectors/polling-and-webhooks, /developer/connectors/soap-bank-adapter, /developer/connectors/multi-rail-failover with cURL + Node + Python examples (ORDER P9)" },
        { type: "improvement", description: "PaymentConnectorsPanel extended with SOAP Bank credentials form (endpoint URL, WS-Security creds, namespace, operations); admin TenantConnectors visibility unchanged" },
        { type: "improvement", description: "Existing mobile-money-charge route, Flutterwave default, and v4.10.0 BYO contract preserved unchanged (STANDING ORDER 1 — The Lock)" },
      ]
    },
    {
      version: "API Spec 4.10.0",
      date: "2026-04-17",
      type: "minor",
      changes: [
        { type: "feature", description: "BYO (Bring-Your-Own) Mobile Money Connectors -- Institutions, merchants, and developers can register their own MTN MoMo or Orange Money API credentials and route charges through them while Flutterwave (KOB-managed) remains the default rail and automatic fallback (STANDING ORDER 4 -- additive only)" },
        { type: "feature", description: "New edge functions: tenant-connectors-manage (CRUD), tenant-connectors-list (list without secrets), tenant-connectors-test (health check), payment-router-charge (priority-ordered routing with Flutterwave fallback)" },
        { type: "feature", description: "New table tenant_payment_connectors with AES-GCM (PAYMENT_CONNECTOR_KEY) credential encryption at rest, RLS scoped to owner, and full audit trail via log_audit_event" },
        { type: "feature", description: "Connector framework (_shared/payment-connectors/) implementing a unified PaymentConnector interface across MTN MoMo Collection API, Orange Money Web Payment, and Flutterwave -- new providers can be added without touching public routes" },
        { type: "feature", description: "Developer guide /developer/connectors/byo-mobile-money with cURL, Node.js, and Python examples (ORDER P9)" },
        { type: "feature", description: "Payment Connectors panel added to Institution Settings and Business Settings for self-service credential management with live health-check testing" },
        { type: "improvement", description: "Existing /functions/v1/mobile-money-charge route and Flutterwave default behaviour preserved unchanged (STANDING ORDER 1 -- The Lock); BYO is opt-in via the new payment-router-charge endpoint" },
      ]
    },
    {
      version: "API Spec 4.9.8",
      date: "2026-04-15",
      type: "patch",
      changes: [
        { type: "fix", description: "Fixed ~50 developer documentation code examples that referenced non-existent REST-style paths (e.g. /gateway/charges, /oauth/token) which returned 404 'Requested function was not found' -- all examples now use correct flat function entrypoints (gateway-charges-router, oauth-token, par-endpoint, etc.)" },
        { type: "improvement", description: "Quickstart, Gateway Charges, Refunds, Mobile Money, Sandbox, Go-Live, Authentication, and OAuth2 guides corrected to match live runtime routing" },
        { type: "improvement", description: "All 290 deployed Edge Functions verified reachable -- zero 404 errors on documented routes" },
        { type: "improvement", description: "Full E2E contract test suite (29 tests) passing: Health, OpenAPI, OIDC, Postman, 8 payment channels, protected routers, static specs, API key guards" },
      ]
    },
    {
      version: "API Spec 4.9.7",
      date: "2026-04-14",
      type: "patch",
      changes: [
        { type: "improvement", description: "Direct Backend Infrastructure Correction -- all runtime API references standardized to direct Supabase Edge Functions backend URL across 90+ files" },
        { type: "improvement", description: "OpenAPI servers[] corrected to single direct backend entry; legacy api.kangopenbanking.com and sandbox.kangopenbanking.com removed from active spec" },
        { type: "improvement", description: "OAuth/OIDC endpoint references (tokenUrl, authorizationUrl, refreshUrl, jwks_uri) corrected to direct backend paths" },
        { type: "improvement", description: "All 8 payment channel fee estimates verified returning JSON via direct backend" },
        { type: "improvement", description: "SDK packages (Node, PHP, Python) DEFAULT_BASE_URL corrected to direct backend" },
        { type: "improvement", description: "CORS headers verified on all edge functions -- Access-Control-Allow-Origin and comprehensive Access-Control-Allow-Headers present" },
        { type: "improvement", description: "Regression guard test suite added (direct-backend-guard.test.ts) to prevent reintroduction of deprecated custom API domains" },
        { type: "improvement", description: "Developer portal code examples (curl, JS, Python, PHP) across 60+ pages updated to direct backend URLs" },
      ]
    },
    {
      version: "API Spec 4.9.6",
      date: "2026-04-12",
      type: "patch",
      changes: [
        { type: "feature", description: "Error Codes Reference expanded from 18 to 63 codes across 14 domains (AUTH, AISP, PISP, PAY, MM, FLW, KYC, CERT, LOAN, SAV, ADM, WH, LED, BANK) with per-error recovery actions and retry guidance" },
        { type: "feature", description: "Common Mistakes section added to Error Codes Reference with 5 frequent integration pitfalls and solutions" },
        { type: "feature", description: "New guide: Build a Marketplace Checkout -- end-to-end charge, commission split, payout, and settlement reconciliation with failure handling" },
        { type: "feature", description: "New guide: Build a Bank Data Aggregator -- OAuth consent, AISP account fetch, transaction sync, and token refresh lifecycle" },
        { type: "improvement", description: "Failure handling, edge cases, and reversal flows added to Accept Payments, Refunds, and Payouts guides (ORDER P6)" },
        { type: "improvement", description: "Authentication Overview enhanced with 'Which method do I need?' decision table linking API Key, OAuth, and mTLS to user roles" },
        { type: "improvement", description: "Go-Live Checklist enhanced with Observability Setup section -- structured logging, webhook monitoring, latency tracking, error rate alerting (ORDER P6)" },
        { type: "improvement", description: "Live Test Report patched -- public endpoints tested without auth; authenticated endpoints skipped gracefully for anonymous users; invalid test parameters corrected" },
        { type: "improvement", description: "Prerendered static HTML for 9 developer portal routes to resolve SPA ghost-page routing on published site (ORDER P2)" },
      ]
    },
    {
      version: "API Spec 4.9.5",
      date: "2026-04-11",
      type: "patch",
      changes: [
        { type: "feature", description: "8 new webhook event types: onboarding_application.approved/rejected, merchant_kyb.verified/failed, credit_score.updated, loan_application.approved/rejected/pending_documents (STANDING ORDER 2, STANDING ORDER 4)" },
        { type: "feature", description: "Webhook event filtering -- topic-based subscription model with events[] array on POST /v1/webhooks for selective event delivery" },
        { type: "feature", description: "Sandbox spec enhanced with x-sandbox: true, x-test-data test phone numbers and card numbers, x-scenario annotations (ORDER P3, ORDER P5)" },
        { type: "feature", description: "Split payment documentation expanded with marketplace worked examples, settlement timing table, and split limits (ORDER P6)" },
        { type: "improvement", description: "/developer/sandbox paths made fully public per ORDER P3 (Free Sandbox Rule)" },
        { type: "improvement", description: "/developer/sdks redirect added for backward compatibility per ORDER P2 (Zero-404 Rule)" },
      ]
    },
    {
      version: "API Spec 4.9.5",
      date: "2026-04-10",
      type: "patch",
      changes: [
        { type: "feature", description: "Rate limit tables added to OpenAPI info description -- Production and Sandbox thresholds for all endpoint groups (300/120 req/min general, 60/30 payments, 30 OAuth, 10 webhook replay)" },
        { type: "feature", description: "RateLimitError schema enhanced with retry_after and limit required fields per RFC 6585 Section 4" },
        { type: "feature", description: "SLA table added to OpenAPI info description -- 99.9% Production uptime, 99.5% Sandbox, P1 30-minute response time, 72-hour maintenance notice" },
        { type: "improvement", description: "x-status-page updated to status.kangopenbanking.com, x-sla-url updated to kangopenbanking.com/sla" },
        { type: "improvement", description: "Rate limit response header documentation (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After) added to spec description" },
      ]
    },
    {
      version: "API Spec 4.9.4",
      date: "2026-04-08",
      type: "patch",
      changes: [
        { type: "feature", description: "TooManyRequests (429) reusable response component added with X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, and Retry-After headers" },
        { type: "feature", description: "RateLimitError schema added to components/schemas with RFC 7807 Problem Details format" },
        { type: "feature", description: "429 response injected into all 196 POST endpoints for universal rate limit coverage" },
        { type: "feature", description: "x-sla-url, x-status-page, and x-uptime-sla extensions added to OpenAPI info block" },
        { type: "feature", description: "x-sdk-libraries extension added for Node.js, Python, and PHP SDK references" },
        { type: "feature", description: "x-postman-collection extension added with Postman workspace link" },
        { type: "improvement", description: "SDK section on developer portal enhanced with repository links and version badges" },
      ]
    },
    {
      version: "API Spec 4.9.3",
      date: "2026-04-05",
      type: "patch",
      changes: [
        { type: "feature", description: "Sandbox Console (/developer/sandbox/console) -- unified self-service sandbox registration, API key generation, test data seeding, webhook testing, and bank connector validation (ORDER P3, ORDER P5)" },
        { type: "feature", description: "Self-service API key issuance -- developers get sbx_ prefixed keys instantly without manual provisioning, up to 5 active keys per account with tiered rate limits" },
        { type: "feature", description: "Bank Connector Validation suite -- tests all 4 connector modes (API Pull, DB Polling, File CSV/MT940, Message Queue) plus Banking API Router with per-test latency profiling" },
        { type: "feature", description: "Webhook testing panel -- sends real HTTP requests with HMAC-SHA256 signatures to any URL and reports status code, response time, and delivery success" },
        { type: "improvement", description: "6 sandbox edge functions deployed and verified: sandbox-create-account, sandbox-create-api-key, sandbox-generate-data, sandbox-test-webhook, sandbox-trigger-webhook, sandbox-register-webhook" },
      ]
    },
    {
      version: "API Spec 4.9.2",
      date: "2026-04-05",
      type: "patch",
      changes: [
        { type: "feature", description: "DcrRegistrationRequest component schema -- 12 properties including software_statement (SSA JWT), jwks_uri, jwks, and FAPI signing algorithm fields (RFC 7591 Section 2, FAPI 1.0 ADV Section 5.2.2)" },
        { type: "feature", description: "DcrRegistrationResponse component schema -- 13 properties covering all fields returned by the DCR edge function including software_roles, environment, and client_id_issued_at" },
        { type: "improvement", description: "POST /v1/dcr/register now uses $ref component schemas instead of inline definitions with full request/response examples" },
        { type: "improvement", description: "Integration contracts documentation updated with complete DCR field reference table and SSA claim requirements" },
      ]
    },
    {
      version: "API Spec 4.9.1",
      date: "2026-04-05",
      type: "patch",
      changes: [
        { type: "feature", description: "POS Commerce modules promoted from planned to active -- catalog, inventory, orders, refunds, and WooCommerce sync are fully operational with 17 edge functions and 23 tables" },
        { type: "feature", description: "Live Endpoint Testing -- real-time HTTP profiling against production endpoints with latency percentile calculation (p50/p95/p99) on the Test Report page" },
        { type: "feature", description: "SLA Commitments table -- contractual uptime targets (99.95%), latency bounds, RTO/RPO, and incident response times published on the API Status page" },
        { type: "feature", description: "FAPI 1.0 Certification Tracker -- 12-point FAPI Advanced checklist with per-requirement certification status and OpenID Foundation verification link" },
        { type: "feature", description: "COBAC/BEAC Compliance Tracker -- 8-point regulatory compliance checklist with standard citations on the Certification page" },
        { type: "feature", description: "POS Commerce added to service status monitoring -- operational with 99.93% uptime (30d)" },
        { type: "improvement", description: "Developer Forum confirmed publicly accessible without authentication per ORDER P1 (Public First Rule)" },
        { type: "improvement", description: "Incident response priorities (P1-P4) with defined response and resolution times published" },
      ]
    },
    {
      version: "API Spec 4.9.0",
      date: "2026-04-04",
      type: "minor",
      changes: [
        { type: "feature", description: "Unified Banking API Router -- 14 actions for customer, account, transfer, KYC, and COBAC report operations via /v1/banking/*" },
        { type: "feature", description: "Bank Dashboard -- white-label portal for connected banks with connector setup wizard, approval queue, customer management, transfer manager, reports, and API logs" },
        { type: "feature", description: "Embeddable Widget System -- Payment, Bank Connect, and Verification widgets with iframe and JS SDK integration, postMessage event communication" },
        { type: "feature", description: "Open Banking Standards page -- FAPI 1.0, COBAC, PSD2, ISO 20022 compliance matrix with CEMAC zone coverage" },
        { type: "feature", description: "Bank Onboarding Guide -- step-by-step connector setup documentation for API, Database, File, and Manual Console connector types" },
        { type: "feature", description: "E2E Test Report page -- automated test results for connector health, API endpoints, auth, widgets, and webhook delivery" },
        { type: "feature", description: "banking_customers table -- bank-managed customer profiles with institution-scoped RLS and external ID mapping" },
        { type: "feature", description: "banking_api_logs table -- request/response audit trail with institution and developer scoping" },
        { type: "feature", description: "widget_sessions table -- ephemeral widget token sessions with service-role-only access" },
        { type: "feature", description: "Internal transfer with idempotency -- atomic fund movement via execute_atomic_transfer RPC with Idempotency-Key duplicate prevention" },
        { type: "feature", description: "COBAC-compliant transaction report generation with credit/debit summaries and net position calculation" },
        { type: "improvement", description: "Developer portal navigation extended with Widgets SDK, Test Report, Open Banking Standards, and Bank Onboarding entries" },
      ]
    },
    {
      version: "API Spec 4.8.0",
      date: "2026-04-04",
      type: "minor",
      changes: [
        { type: "feature", description: "Public Business Identity API -- unauthenticated lookup, search, and verification badge endpoints for any merchant" },
        { type: "feature", description: "Public business directory search with filtering by industry, country, and trust tier (paginated)" },
        { type: "feature", description: "Trust Score tiers introduced: Unverified, Bronze, Silver, Gold, Platinum -- mapped from 0-100 composite score" },
        { type: "feature", description: "Public trust badge endpoint returns verification status, tier, and score without authentication" },
        { type: "feature", description: "Trust score history tracking -- up to 24 historical score snapshots per merchant" },
        { type: "feature", description: "Public-safe factors summary (verification strength, transaction volume, reliability, dispute record) exposed on public scores" },
        { type: "feature", description: "Document expiry tracking on verification checks with expiring_docs admin endpoint" },
        { type: "feature", description: "Batch verification initiation for pending KYC submissions (admin)" },
        { type: "feature", description: "Auto-complete KYB workflow -- when all checks pass/fail, business_kyc status auto-updates to approved/rejected" },
        { type: "feature", description: "Sanctions screening check added to cross-check pipeline (OFAC SDN, EU, UN Consolidated, CEMAC Regional)" },
        { type: "feature", description: "Business age assessment added to verification cross-checks with enhanced monitoring flag for businesses under 1 year" },
        { type: "improvement", description: "Verification sources now tracked per check (RCCM Registry, DGI Tax Authority, PostIQ, National ID Registry)" },
        { type: "improvement", description: "Trust score calculation now syncs trust_tier to public_business_profiles automatically" },
        { type: "improvement", description: "RCCM format validation expanded to support RCCM/ prefix patterns used in OHADA jurisdictions" },
      ]
    },
    {
      version: "API Spec 4.7.0",
      date: "2026-04-03",
      type: "minor",
      changes: [
        { type: "feature", description: "Cache-Control, ETag, and Last-Modified headers added to all 122 GET endpoints (RFC 7234)" },
        { type: "feature", description: "304 Not Modified response component added for conditional request support" },
        { type: "feature", description: "Token lifetime documented: 15m access, 30d rotating refresh, 60s auth code" },
        { type: "feature", description: "Webhook delivery policy documented: 7 attempts, exponential backoff, 30-day dead-letter" },
        { type: "feature", description: "IdempotencyKey header now documents 24-hour key retention TTL" },
        { type: "fix", description: "balance_after on Transaction schema corrected from number to string (precision fix)" },
        { type: "fix", description: "OAuth authorizationUrl/tokenUrl corrected from /functions/v1/ to /v1/ path" },
        { type: "feature", description: "Rate limit headers added to 7 previously missing endpoint responses" },
        { type: "improvement", description: "Dual naming convention (snake_case/PascalCase) documented on Transaction schema" },
        { type: "feature", description: "New documentation pages: Token Lifecycle, Webhook Retry Policy, HTTP Caching" },
      ]
    },
    {
      version: "API Spec 4.6.0",
      date: "2026-03-29",
      type: "minor",
      changes: [
        { type: "feature", description: "FAPI 1.0 Advanced certification ready — code_challenge and code_challenge_method now required=true on /v1/oauth/authorize" },
        { type: "feature", description: "Schema validation hardened — required[] arrays added to all 49 API schemas (37 previously missing)" },
        { type: "feature", description: "Idempotency-Key header added to 15 payment-related POST endpoints for network-safe retries (OBIE R/W v3.1 Section 3.3)" },
        { type: "feature", description: "StandardResponse envelope applied to all 19 single-resource GET endpoints for consistent response structure" },
        { type: "feature", description: "PaginatedResponse envelope applied to all 67 list GET endpoints for universal pagination" },
        { type: "feature", description: "RFC 7807 application/problem+json support expanded to all 330+ error responses across the API" },
        { type: "feature", description: "WebhookEventPayload base schema added — structured envelope with 52 event types, deduplication ID, livemode flag, and per-event data mapping" },
        { type: "improvement", description: "OIDC discovery document extended with pushed_authorization_request_endpoint and backchannel_authentication_endpoint" },
      ]
    },
    {
      version: "API Spec 4.5.0",
      date: "2026-03-29",
      type: "minor",
      changes: [
        { type: "feature", description: "Standards-ISO 20022 tag declared — 42/42 tag alignment across all 339 operations" },
        { type: "feature", description: "nonce parameter set to required=true on /v1/oauth/authorize per FAPI 1.0 Advanced Section 5.2.2-14" },
        { type: "feature", description: "Token endpoint restored for public PKCE clients — security now [{},{\"mtls\":[]}] supporting both public and confidential clients" },
        { type: "feature", description: "camt.052 and camt.054 renamed from /generate to /parse with correct operationIds and x-iso20022-message versions" },
        { type: "feature", description: "ProblemDetails schema extended with error_id and timestamp fields for support trace correlation" },
        { type: "feature", description: "GatewaySubscription extended with trial_start, trial_end, cancel_at_period_end, cancelled_at, billing_cycle_anchor, and metadata fields" },
        { type: "improvement", description: "GatewayCharge and Transaction schemas hardened with required[] arrays" },
        { type: "improvement", description: "PayPal webhook signature verification headers and manual verification algorithm fully documented" },
        { type: "improvement", description: "x-iso20022-message extension added to all 9 ISO 20022 endpoints for consistent metadata" },
      ]
    },
    {
      version: "API Spec 4.4.0",
      date: "2026-03-29",
      type: "minor",
      changes: [
        { type: "feature", description: "StandardResponse and PaginatedResponse allOf envelopes wired to 12 operations for consistent response structure" },
        { type: "feature", description: "5 FAPI parameters (nonce, request_uri, request, acr_values, claims) added to /v1/oauth/authorize" },
        { type: "feature", description: "ProblemDetails schema (RFC 7807) added with application/problem+json support on 6 endpoints" },
        { type: "feature", description: "5 new ISO 20022 message endpoints: pacs.004, pacs.009, camt.052, camt.054, camt.056" },
        { type: "feature", description: "mTLS (RFC 8705) security option added to /v1/oauth/token for certificate-bound access tokens" },
        { type: "feature", description: "PATCH and DELETE operations added to /v1/gateway/subscriptions/{subscriptionId}" },
        { type: "improvement", description: "8 missing fields added to GatewayCharge schema (updated_at, description, metadata, customer_id, dispute_id, refunded_at, failure_reason, failure_message)" },
        { type: "improvement", description: "7 OBIE PascalCase alias properties with x-obie-mapping added to Transaction schema" },
        { type: "improvement", description: "6 OBIE-mandated required fields added to Account schema" },
        { type: "improvement", description: "Duplicate inline pagination parameters removed from 8 endpoints in favour of component $ref" },
      ]
    },
    {
      version: "API Spec 4.3.0",
      date: "2026-03-29",
      type: "minor",
      changes: [
        { type: "feature", description: "OpenAPI specification upgraded with 25 standards fixes across security, schema design, payment standards, ISO 20022 compliance, and OpenAPI structure" },
        { type: "feature", description: "2 new savings endpoints added — total operations increased to 332 (later 339 with v4.4.0 additions)" },
        { type: "improvement", description: "Provider webhook paths consolidated under /v1/ namespace" },
        { type: "improvement", description: "FAPI 1.0 Advanced, PSD2, and OBIE R/W v3.1 compliance gaps addressed across all endpoint categories" },
      ]
    },
    {
      version: "10.1.0",
      date: "2026-03-21",
      type: "minor",
      changes: [
        { type: "feature", description: "Pay by Bank — Redirect-based payment authorization with Strong Customer Authentication (SCA) for merchant checkout flows" },
        { type: "feature", description: "Hosted Authorization Page (/pay/authorize) — Secure web-based payment approval with inline login, merchant branding, amount display, and automatic redirect" },
        { type: "feature", description: "Consumer App Payment Approval (/app/authorize-payment/:id) — In-app authorization screen for Pay by Bank deep links with PIN verification" },
        { type: "feature", description: "pay-by-bank Edge Function — Full API with create_intent, get_intent, authorize, reject, callback, and list_intents actions" },
        { type: "feature", description: "pay_by_bank_intents table — Payment intent lifecycle tracking with auto-expiry (15min), PISP consent integration, and merchant redirect state management" },
        { type: "feature", description: "4 new webhook events: pay_by_bank.authorized, pay_by_bank.submitted, pay_by_bank.completed, pay_by_bank.failed" },
        { type: "improvement", description: "Node.js SDK updated with PayByBankIntent, CreatePayByBankIntentRequest, and PayByBankIntentResponse types" },
        { type: "improvement", description: "Python SDK updated with PayByBankIntent dataclass and PayByBankStatus literal type" },
      ]
    },
    {
      version: "10.0.0",
      date: "2026-03-21",
      type: "major",
      changes: [
        { type: "feature", description: "Remittance-as-a-Service (RaaS) — Full inbound + outbound remittance lifecycle with 5-state machine (created → pending → received → credited → settled)" },
        { type: "feature", description: "Remittance Partner Adapter Layer — provider-agnostic interface for Thunes, TerraPay, Onafriq with HMAC-SHA256 signature verification and canonical event model" },
        { type: "feature", description: "Remittance Routing Engine — smart destination routing to KOB wallets, bank accounts, and merchant/bill payments with double-entry ledger postings" },
        { type: "feature", description: "Remittance Settlement & Reconciliation — automated statement import, 5-type mismatch detection, daily cron for stale transaction flagging" },
        { type: "feature", description: "Outbound Remittance Engine — corridor discovery, quote generation, multi-layered compliance (sanctions, limits, usage tracking), delivery method selection" },
        { type: "feature", description: "Remittance Webhook Ingestion — rate-limited, signature-verified inbound webhooks with dedupe via webhook_inbox table" },
        { type: "feature", description: "Bank Confirmation Handler — real-time and batch bank credit confirmation with settlement ledger posting" },
        { type: "feature", description: "Admin Remittance Command Center — 5 dashboard pages: Overview, Partners, Bank Confirmations, Settlements, Outbound Monitoring" },
        { type: "feature", description: "Consumer Send Money page (/app/send-money) — 5-step flow with corridor picker, live quotes, and transfer history with tracking" },
        { type: "feature", description: "Consumer Inbound Remittance tracking (/app/remittances) — status filters, event timeline, volume summary" },
        { type: "feature", description: "Banking App Remittance view (/bank/:id/remittances) — institution-scoped inbound remittance tracking" },
        { type: "feature", description: "Professional Remittance landing page (/remittance) — Wise-inspired design with corridor rates, delivery options, and API section" },
        { type: "improvement", description: "SDK documentation updated with remittance endpoint examples for Node.js, Python, and PHP libraries" },
        { type: "improvement", description: "Outbound compliance decisions routed through edge function (was direct DB) for proper audit trail and email notifications" },
        { type: "improvement", description: "Usage tracking fixed with atomic increment RPC function (increment_remittance_usage) replacing broken upsert" },
        { type: "fix", description: "listOutbound now queries by sender_user_id instead of sender_email for stable history across email changes" },
        { type: "fix", description: "Admin RemittancePartners now forwards session token in invoke headers for proper RBAC resolution" },
      ]
    },
    {
      version: "9.1.0",
      date: "2026-03-20",
      type: "minor",
      changes: [
        { type: "feature", description: "Competitive Comparison page (/developer/compare) — interactive 77-feature matrix comparing KOB vs Stripe vs Flutterwave vs CinetPay vs DusuPay across 10 categories" },
        { type: "feature", description: "3-Layer Architecture section on Developer Home — animated visual showcasing Payment Gateway + Open Banking + Banking Infrastructure layers" },
        { type: "feature", description: "Migration Guides page (/developer/migrate) — side-by-side code examples for switching from Stripe or Flutterwave to KOB in Node.js, Python, and PHP" },
        { type: "improvement", description: "Developer Portal navigation updated with Compare and Migrate links" },
      ]
    },
    {
      version: "9.0.0",
      date: "2026-03-20",
      type: "major",
      changes: [
        { type: "feature", description: "UK Open Banking v4.0.1 FAPI header compliance — x-fapi-interaction-id echo/generate on all AISP/PISP responses, x-fapi-auth-date, x-fapi-customer-ip-address, x-customer-user-agent parsing and audit logging" },
        { type: "feature", description: "Detached JWS message signing (x-jws-signature) — PS256-compatible signatures on all PISP write endpoint responses with structural validation on inbound requests" },
        { type: "feature", description: "JWE content type rejection — returns 415 Unsupported Media Type for application/jose+jwe requests per UK OB specification" },
        { type: "feature", description: "CBPII Confirmation of Funds endpoint — consent creation, retrieval, revocation, and funds availability check (cbpii-funds-confirmation edge function + cbpii_consents table)" },
        { type: "feature", description: "International Payment Consents & Payments — create/get consent, create/get payment with currency_of_transfer, creditor_agent, exchange_rate_information, and charge_bearer fields" },
        { type: "feature", description: "Domestic Scheduled Payment Consents & Payments — consent creation with RequestedExecutionDateTime, payment submission with automatic consent consumption" },
        { type: "feature", description: "Domestic Standing Order Consents — consent creation with Frequency, FirstPaymentDateTime, RecurringPaymentAmount, and FinalPaymentDateTime" },
        { type: "feature", description: "File Payment Consents & Payments — UK OB file-payment format with FileType, FileHash, NumberOfTransactions, ControlSum; maps to KOB batch payment infrastructure" },
        { type: "improvement", description: "UK OB nested error model (Errors[] array) — new ob-errors.ts shared module with ErrorCode, Message, Path, Url fields; maintains backward compatibility" },
        { type: "improvement", description: "Hypermedia pagination (Links.Next/Prev/First/Last) added to AISP transactions endpoint per UK OB specification" },
        { type: "improvement", description: "Retry-After header now included on all 429 rate-limit responses across the platform" },
        { type: "improvement", description: "CORS headers updated to accept FAPI and JWS headers (x-fapi-interaction-id, x-fapi-auth-date, x-fapi-customer-ip-address, x-customer-user-agent, x-jws-signature)" },
        { type: "improvement", description: "pisp_consents and payments tables extended with payment_type (domestic/international/domestic_scheduled/domestic_standing_order/file) and metadata JSONB columns" },
      ]
    },
    {
      version: "8.1.0",
      date: "2026-03-20",
      type: "minor",
      changes: [
        { type: "feature", description: "PHP / Laravel SDK v1.0.0 — full-featured SDK with Guzzle HTTP client, PSR-4 autoloading, Laravel service provider, facade, and webhook verification middleware" },
        { type: "feature", description: "PHP SDK resource classes: Accounts, Balances, Transactions, Beneficiaries, Charges, Refunds, Payouts, Gateway, Sandbox, Webhooks" },
        { type: "feature", description: "Laravel auto-discovery with KOBServiceProvider + KOB facade + publishable config (php artisan vendor:publish --tag=kob-config)" },
        { type: "feature", description: "VerifyWebhookSignature middleware for Laravel routes — automatic HMAC-SHA256 webhook validation" },
        { type: "feature", description: "KOBException class with structured error_code, error_id, and statusCode properties" },
        { type: "improvement", description: "SDK Registry edge function updated — PHP SDK now returns status 'available' with full quickstart and feature list" },
        { type: "improvement", description: "SDKs & Libraries page updated — PHP/Laravel card now shows v1.0.0 with install command and PHP quickstart tab" },
        { type: "improvement", description: "All three SDKs (Node.js, Python, PHP) now have complete E2E validated source code with consistent API coverage" },
      ]
    },
    {
      version: "8.0.0",
      date: "2026-03-20",
      type: "major",
      changes: [
        { type: "feature", description: "Bank Connector Layer — full bank onboarding lifecycle: register → submit → approve → active with admin/public directory" },
        { type: "feature", description: "Bank-sourced data tables: bank_customers, bank_sourced_accounts, bank_sourced_balances, bank_sourced_transactions, bank_sourced_beneficiaries" },
        { type: "feature", description: "Push-model data ingestion endpoints (mTLS-protected): bulk ingest accounts, balances, transactions, beneficiaries" },
        { type: "feature", description: "PSU linking flow: bank_psu_links table with link_psu_start and link_psu_confirm actions" },
        { type: "feature", description: "Bank payment connector rail: bank_payments and bank_payment_status_events tables with status callbacks" },
        { type: "feature", description: "Sandbox bank simulator: sandbox_seed_bank creates 'Sandbox Bank CM' with sample data for dev testing" },
        { type: "feature", description: "Admin Bank Directory page (/admin/bank-directory) with 5 tabs: Banks, Connectors, Health, PSU Links, Payments" },
        { type: "feature", description: "bank-directory edge function — consolidated router with 20+ actions for bank lifecycle, connector management, data ingestion, and sandbox simulation" },
        { type: "improvement", description: "OpenAPI spec v4.0.0 — added Bank Directory, Bank Connectors, and Interbank Engine endpoint groups with Bank and InterbankPayment schemas" },
        { type: "improvement", description: "Postman collection — added Bank Directory, Bank Connectors, and Interbank Engine folders with example requests" },
      ]
    },
    {
      version: "7.0.0",
      date: "2026-03-20",
      type: "major",
      changes: [
        { type: "feature", description: "Interbank Engine — 10-state payment machine (created→validated→submitted→accepted→settled) with concurrency-safe transitions" },
        { type: "feature", description: "7 new tables: interbank_participants, interbank_endpoints, interbank_payments, interbank_messages, interbank_status_events, interbank_reconciliation_items, event_outbox" },
        { type: "feature", description: "ISO 20022 canonical mapping — pacs.008 generation and pacs.002/camt.054 inbound processing with workflow orchestration" },
        { type: "feature", description: "Dispatch layer with outbox pattern — reliable message delivery with exponential backoff (max 7 retries)" },
        { type: "feature", description: "interbank-engine edge function — create, submit, reverse payments with ledger hold/release integration" },
        { type: "feature", description: "interbank-connector-inbound edge function — mTLS-enforced ingestion for pacs.002 and camt.054 messages" },
        { type: "feature", description: "interbank-dispatch-worker edge function — polls event_outbox and delivers messages via https_push, file, or message_queue" },
        { type: "feature", description: "Admin Interbank Payments page (/admin/interbank-payments) with 6 tabs: Payments, Participants, Messages, Connectors, Outbox, Reconciliation" },
        { type: "improvement", description: "Comprehensive interbank documentation in /docs/interbank/ covering lifecycle, ISO 20022, error codes, and connector kit" },
      ]
    },
    {
      version: "6.2.0",
      date: "2026-03-15",
      type: "minor",
      changes: [
        { type: "feature", description: "Per-Merchant Statement Generator — new gateway-merchant-statement edge function generates monthly merchant statements in JSON and CSV with full charge/payout/refund line items and summary analytics" },
        { type: "feature", description: "Provider Settlement Import & Compare — new gateway-settlement-import edge function imports Stripe/Flutterwave/PayPal settlement files, compares against KOB ledger, and records mismatches for admin resolution" },
        { type: "feature", description: "5 mismatch types detected: amount, status, fee, missing-in-platform, missing-in-provider" },
        { type: "improvement", description: "All gaps from Stripe/Flutterwave comparison audit now resolved — KOB achieves full gateway parity" },
      ]
    },
    {
      version: "6.1.0",
      date: "2026-03-15",
      type: "minor",
      changes: [
        { type: "feature", description: "Live API Status Page — connected ApiStatusPage to api-health edge function for real-time service status display with refresh and FAPI compliance details" },
        { type: "feature", description: "API Playground sandbox-only auth warning banner — X-API-Key for sandbox, OAuth2 Bearer for production" },
        { type: "feature", description: "2 new playground endpoints: Generate Test Data, List Banks (Gateway)" },
        { type: "improvement", description: "Migrated api-health edge function from deprecated serve import to native Deno.serve" },
        { type: "improvement", description: "Added Sandbox vs Production Authentication section to developer quickstart guide" },
      ]
    },
    {
      version: "6.0.0",
      date: "2026-03-15",
      type: "major",
      changes: [
        { type: "feature", description: "Master Documentation Pack — integration-contracts.md, feature-matrix.md (170 features across 16 domains), and test-plan.md with 4 E2E journeys" },
        { type: "feature", description: "Public Developer Docs — quickstart guides for Merchants, Developers, and Institutions with XAF examples and Cameroon phone formatting" },
        { type: "feature", description: "Webhook integration guide, error codes reference (AUTH_, GW_, CONSENT_, KYB_, LEDGER_, STD_ domains), and status lifecycle reference" },
        { type: "feature", description: "Postman Collection Alignment — added 8 missing folders (Wallets, Escrow, Instant Payouts, Treasury, Compliance Screening, SLA Monitoring, POS & Commerce). Total endpoints: ~190" },
        { type: "feature", description: "Final Audit Report — 169/170 features implemented, 20/20 security controls passed, production readiness confirmed" },
      ]
    },
    {
      version: "5.0.0",
      date: "2026-03-09",
      type: "major",
      changes: [
        { type: "feature", description: "Merchant API Key Management — gateway_merchant_keys table with create/revoke/list/rotate actions and backward-compatible legacy table writes" },
        { type: "feature", description: "Bulk Operations — gateway_bulk_operations table and edge function for bulk payouts, refunds, and customer imports via CSV" },
        { type: "feature", description: "Enterprise Merchant Features — branding customization with live checkout preview, white-label config (custom domain, email), advanced analytics" },
        { type: "feature", description: "POS Commerce — subscription plan CRUD, multi-location + POS staff management, WooCommerce sync dashboard" },
        { type: "feature", description: "Merchant Store Guide — comprehensive 12-section merchant user guide including Enterprise features" },
        { type: "fix", description: "Fixed missing gateway_bulk_operations table (BulkOperations page was non-functional)" },
        { type: "fix", description: "Fixed missing enterprise columns on gateway_merchants (branding/white-label pages would error)" },
        { type: "improvement", description: "gateway-merchant-keys edge function updated to use shared CORS headers" },
      ]
    },
    {
      version: "3.7.0",
      date: "2026-03-08",
      type: "minor",
      changes: [
        { type: "feature", description: "POS Consumer Marketplace — merchants publish storefronts via subscription; consumers browse, cart, and buy with wallet balance" },
        { type: "feature", description: "QR Code Payments — merchant QR generation (static/dynamic) and consumer scan-to-pay via kob_pos_pay payload" },
        { type: "feature", description: "Wallet payment method added to pos-pay-order — atomic consumer debit + merchant credit with inventory decrement" },
        { type: "feature", description: "pos-store-browse edge function — paginated store discovery with city/category filters" },
        { type: "feature", description: "pos-consumer-cart edge function — full cart management (add/update/remove/clear)" },
        { type: "feature", description: "pos-consumer-checkout edge function — idempotent wallet-to-wallet checkout with order creation" },
        { type: "feature", description: "pos-qr-payment edge function — QR payload generation and scan-to-pay processing" },
        { type: "feature", description: "pos-store-subscription edge function — plan listing and merchant subscription activation" },
        { type: "feature", description: "Consumer App: /app/stores marketplace with filters, favourites, grid view; /app/stores/:merchantId product browsing; /app/cart with payment success/failure screens" },
        { type: "feature", description: "Merchant Portal: Storefront settings page with store profile editor, subscription management, and QR code generator" },
        { type: "feature", description: "Admin Portal: Marketplace management — subscription plan CRUD, merchant subscription oversight, store visibility toggle" },
        { type: "improvement", description: "CustomerScan updated to recognize kob_pos_pay QR codes and route to merchant payment flow" },
        { type: "improvement", description: "CustomerHome: 'Stores' feature card added to Money Movement section" },
        { type: "improvement", description: "New tables: pos_store_profiles, pos_subscription_plans, pos_store_subscriptions, pos_consumer_carts, pos_consumer_cart_items with full RLS" },
        { type: "improvement", description: "consumer_app added to pos_order_channel enum for marketplace order tracking" },
      ]
    },
    {
      version: "3.6.0",
      date: "2026-03-06",
      type: "minor",
      changes: [
        { type: "feature", description: "Dedicated Merchant Staff Login portal at /staff-login — dual-auth with Email+Password and Phone+6-digit PIN tabs" },
        { type: "feature", description: "merchant-create-staff edge function — merchants set email, password, phone, and PIN for staff; creates auth user and links to merchant_staff_roles" },
        { type: "feature", description: "staff-pin-login edge function — validates phone + salted SHA-256 PIN hash, returns authenticated session via magic link token" },
        { type: "feature", description: "phone_number and pin_hash columns added to merchant_staff_roles table for PIN-based staff authentication" },
        { type: "feature", description: "Merchant Staff Login button added to main /auth page — dashed-border CTA linking to dedicated staff portal" },
        { type: "feature", description: "'Copy Login Link' action on Merchant Staff Roles dashboard — merchants share /staff-login URL with team" },
        { type: "improvement", description: "Merchant Travel Guide: 11-module staff management section covering credential setup, role presets, permissions, and security best practices" },
        { type: "improvement", description: "Admin Travel Guide: staff-roles section updated with authentication flow details and credential management monitoring" },
        { type: "improvement", description: "Apps Ecosystem: Merchant App features updated to reflect Staff Portal, Travel Booking, and Route Management capabilities" },
        { type: "improvement", description: "Product Manual: Merchants manual type added alongside Banks, Customers, and Developers" },
      ]
    },
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
        { type: "improvement", description: "API base URL fixed to production pattern (https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1)" },
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

      <AutoDocNavigation />
    </div>
  );
}
