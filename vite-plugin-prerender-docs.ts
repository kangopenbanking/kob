/**
 * Vite Plugin: Static HTML Pre-rendering for Documentation Routes
 *
 * PERMANENT PUBLIC ROUTES — DO NOT REMOVE OR REDIRECT
 * /developer, all /developer/* documentation routes, /openapi.json,
 * /openapi.yaml, SDK docs, and changelog feeds must remain public.
 * 
 * Generates unique index.html files for each documentation route at build time.
 * This ensures crawlers and audit tools see unique content per route,
 * not just the SPA shell. The React app still hydrates normally in browsers.
 * 
 * Justification: ORDER P1 (Public First), ORDER P6 (Complete Content),
 * ORDER P2 (Zero-404 Rule)
 */

import { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { readExpectedVersion } from './scripts/lib/read-expected-version.mjs';

// Single source of truth — never hardcode the version string in the
// prerendered docs. Falls back to the SSOT when the env var is unset.
const KOB_API_VERSION = process.env.EXPECTED_OPENAPI_VERSION || readExpectedVersion();

interface DocRoute {
  path: string;
  title: string;
  description: string;
  h1: string;
  content: string;
  serveAsExtensionlessFile?: boolean;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderChangelogContent(): string {
  try {
    const changelogPath = path.resolve(process.cwd(), 'public/changelog.json');
    const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf-8'));
    const entries = Array.isArray(changelog.entries) ? changelog.entries : [];
    const renderedEntries = entries.map((entry: any) => {
      const version = escapeHtml(entry.version ?? '(unversioned)');
      const date = escapeHtml(entry.date ?? 'unreleased');
      const type = escapeHtml(entry.type ?? 'release');
      const breaking = entry.breaking_changes ? 'yes' : 'no';
      const bullets = [
        ...(Array.isArray(entry.highlights) ? entry.highlights : []),
        ...(Array.isArray(entry.fixes) ? entry.fixes : []),
        ...(Array.isArray(entry.additions) ? entry.additions : []),
      ].slice(0, 4);
      return `<h3>v${version} — ${date}</h3>
<p><strong>Type:</strong> ${type} · <strong>Breaking:</strong> ${breaking}</p>
<p>${escapeHtml(entry.summary ?? '')}</p>
${bullets.length ? `<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}`;
    }).join('\n\n');

    return `<h2>Version History</h2>
<p>All API changes are documented here within 48 hours of deployment, as required by ORDER P7. Newest first. Breaking changes are flagged. Subscribe via <a href="mailto:developers@kangopenbanking.com">developers@kangopenbanking.com</a>.</p>
${renderedEntries}
<h3>Machine-readable feeds</h3>
<ul>
  <li><a href="/changelog.json">changelog.json</a> — JSON, every entry with standards citations and migration notes</li>
  <li><a href="/developer/changelog.xml">RSS feed</a></li>
</ul>`;
  } catch {
    return `<h2>Version History</h2>
<p>All API changes are documented here within 48 hours of deployment. The machine-readable feed is available at <a href="/changelog.json">/changelog.json</a>.</p>`;
  }
}

const DOC_ROUTES: DocRoute[] = [
  {
    path: '/developer/getting-started',
    title: 'Getting Started | Kang Open Banking Developer Docs',
    description: 'Make your first API call to the Kang Open Banking API in under 5 minutes. Free sandbox, no signup required. cURL, Node.js, Python, PHP, Go, and Java examples.',
    h1: 'Getting Started with Kang Open Banking API',
    content: `<h2>Quick Start Guide</h2>
<p>Get your sandbox API key and make your first API call in under 5 minutes. No signup required. Field names below match the canonical OpenAPI 3.1 specification (v${KOB_API_VERSION}): the GatewayCharge schema requires <code>channel</code> and <code>customer_phone</code>.</p>
<h3>Step 1: Get Your Sandbox Key</h3>
<p>Use the instant key generator on this page or use the default test key: <code>sk_test_kob_sandbox_demo_key_2024</code></p>
<h3>Step 2: Make Your First API Call</h3>
<pre><code>curl -i https://api.kangopenbanking.com/v1/health</code></pre>
<h3>Step 3: Create a Mobile Money Charge (Sandbox)</h3>
<pre><code>curl -X POST https://sandbox-api.kangopenbanking.com/v1/gateway/charges \\
  -H "Authorization: Bearer sk_test_kob_sandbox_demo_key_2024" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "amount": "5000",
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237650000000",
    "description": "Order #1234"
  }'</code></pre>
<h3>Step 4: Successful Response (HTTP 201)</h3>
<pre><code>{
  "data": {
    "id": "ch_01HZX9K7P3M2N4Q5R6S7T8V9W0",
    "object": "charge",
    "status": "pending",
    "amount": "5000",
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237650000000",
    "provider_ref": "MP240501.1234.A12345",
    "tx_ref": "kob_tx_8f3e1c92a7b4",
    "description": "Order #1234",
    "created_at": "2026-05-01T14:32:11Z"
  },
  "request_id": "req_01HZX9K7P3M2N4Q5R6S7T8V9W0",
  "links": { "self": "/v1/gateway/charges/ch_01HZX9K7P3M2N4Q5R6S7T8V9W0" }
}</code></pre>
<h3>Step 5: Error Response (RFC 7807)</h3>
<p>All 4xx/5xx errors use <code>application/problem+json</code> with a stable <code>error_id</code>:</p>
<pre><code>HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://docs.kangopenbanking.com/errors/validation_error",
  "title": "Validation Error",
  "status": 400,
  "detail": "customer_phone is required when channel is mobile_money",
  "error_id": "err_01HZX9KAB12CDEF34GHJKMNPQR",
  "timestamp": "2026-05-01T14:32:11Z"
}</code></pre>
<h3>Available SDKs</h3>
<ul>
  <li>Node.js / TypeScript — <code>npm install @kangopenbanking/sdk</code></li>
  <li>Python — <code>pip install kang-openbanking</code></li>
  <li>PHP — <code>composer require kang/openbanking-php</code></li>
  <li>Java, Go, Ruby — community implementation guides available on the SDKs page; official packages targeted Q3 2026.</li>
</ul>
<p>Production base URL: <code>https://api.kangopenbanking.com/v1</code><br/>Sandbox base URL: <code>https://sandbox-api.kangopenbanking.com/v1</code></p>
<h3>Postman Collection</h3>
<p>A versioned Postman v2.1 collection is auto-generated from the live OpenAPI spec on every release (388 requests, 45 folders).</p>
<ul>
  <li><a href="/postman/Kang_Open_Banking_API_latest.postman_collection.json">Latest collection</a> (currently v${KOB_API_VERSION})</li>
  <li><a href="/postman/Kang_Open_Banking_API_v${KOB_API_VERSION}.postman_collection.json">v${KOB_API_VERSION} (immutable, pinned)</a></li>
  <li><a href="/postman/Kang_Open_Banking_Sandbox.postman_environment.json">Sandbox environment</a></li>
  <li><a href="/postman/Kang_Open_Banking_Production.postman_environment.json">Production environment</a></li>
  <li><a href="/postman/manifest.json">manifest.json</a> — current version + download URLs (machine-readable)</li>
</ul>`
  },
  {
    path: '/developer/api-explorer',
    title: 'API Explorer | Kang Open Banking Interactive Swagger UI',
    description: 'Interactive API Explorer powered by Swagger UI. Try all Kang Open Banking endpoints live — payments, accounts, transfers, webhooks. OpenAPI 3.1 spec included.',
    h1: 'API Explorer — Interactive Swagger UI',
    serveAsExtensionlessFile: true,
    content: `<h2>Interactive API Reference</h2>
<p>Explore all Kang Open Banking API endpoints interactively using Swagger UI. The full OpenAPI 3.1 specification is loaded with try-it-out capability.</p>
<h3>Available Endpoint Groups</h3>
<ul>
  <li>Payments — Initiate mobile money, card, and bank transfer payments</li>
  <li>Accounts — Retrieve account information (AISP)</li>
  <li>Transfers — Bank-to-bank and instant payouts</li>
  <li>Webhooks — Configure and manage webhook subscriptions</li>
  <li>Wallets — Custodial wallet management</li>
  <li>KYC/AML — Identity verification and compliance screening</li>
  <li>Credit Scoring — Credit assessment API</li>
</ul>
<h3>Download Specifications</h3>
<ul>
  <li><a href="/openapi.json">OpenAPI Specification (JSON)</a></li>
  <li><a href="/openapi.yaml">OpenAPI Specification (YAML)</a></li>
  <li><a href="/openapi-sandbox.json">Sandbox Specification (JSON)</a></li>
  <li><a href="/postman/Kang_Open_Banking_API_latest.postman_collection.json">Postman Collection (v${KOB_API_VERSION} — latest)</a></li>
  <li><a href="/postman/Kang_Open_Banking_API_v${KOB_API_VERSION}.postman_collection.json">Postman Collection v${KOB_API_VERSION} (immutable)</a></li>
  <li><a href="/postman/manifest.json">Postman manifest (current version + URLs)</a></li>
</ul>
<p>Authentication: Bearer token or OAuth 2.0. Sandbox key: <code>sk_test_kob_sandbox_demo_key_2024</code></p>`
  },
  {
    path: '/developer/examples/real-world',
    title: 'Real-World Integration Examples | Kang Open Banking',
    description: 'Production-tested integration examples for Kang Open Banking API. E-commerce checkout, subscription billing, marketplace payouts, and mobile money collection flows.',
    h1: 'Real-World Integration Examples',
    serveAsExtensionlessFile: true,
    content: `<h2>12 Production-Ready Integration Guides</h2>
<p>Every guide is copy-paste-ready, includes a sequence diagram, cURL examples, JSON request/response samples, and notes on idempotency, retries, and webhook handling. All examples target the public sandbox at <code>https://sandbox-api.kangopenbanking.com/v1</code> and work with the published test credentials.</p>

<h3>Payment Gateway</h3>
<ul>
  <li><a href="/developer/examples/01-merchant-onboarding-kyb-api-keys">1. Merchant Onboarding, KYB &amp; API Keys</a> — register a merchant, submit KYB documents, generate API keys (8 min)</li>
  <li><a href="/developer/examples/02-accept-payments-create-charge">2. Accept Payments — Create a Charge</a> — Mobile Money, Card, and PayPal with full webhook lifecycle (10 min)</li>
  <li><a href="/developer/examples/03-add-money-account-funding">3. Add Money — Account Funding</a> — fund wallets via Mobile Money, card, or bank transfer (7 min)</li>
  <li><a href="/developer/examples/04-refunds">4. Refunds</a> — full and partial refunds with idempotency (5 min)</li>
  <li><a href="/developer/examples/05-payouts-single-bulk-paypal">5. Payouts — Single, Bulk &amp; PayPal</a> — disburse to bank accounts, MoMo wallets, or PayPal (12 min)</li>
  <li><a href="/developer/examples/07-settlements-reporting-exports-reconciliation">7. Settlements, Reporting &amp; Reconciliation</a> — settlement cycles, CSV/PDF exports, reconciliation (8 min)</li>
  <li><a href="/developer/examples/08-disputes-chargebacks-evidence">8. Disputes &amp; Chargebacks</a> — handle disputes and submit evidence within deadlines (7 min)</li>
</ul>

<h3>Webhooks &amp; Events</h3>
<ul>
  <li><a href="/developer/examples/06-webhooks-merchant-outbound-deliveries-rotation">6. Webhooks — Setup, Deliveries &amp; Rotation</a> — endpoints, HMAC-SHA256 verification, retries, secret rotation (10 min)</li>
</ul>

<h3>Open Banking</h3>
<ul>
  <li><a href="/developer/examples/09-open-banking-aisp-consent-accounts-transactions">9. Open Banking AISP — Accounts &amp; Transactions</a> — consent, redirect authorization, account data retrieval (12 min)</li>
  <li><a href="/developer/examples/10-open-banking-pisp-consent-domestic-payment">10. Open Banking PISP — Domestic Payment</a> — consent and authorization for a domestic payment (10 min)</li>
</ul>

<h3>End-to-End "Build X" Use Cases</h3>
<ul>
  <li><a href="/developer/examples/11-build-marketplace-checkout">11. Build a Marketplace Checkout</a> — charge buyers, calculate commission, disburse to sellers, reconcile (15 min)</li>
  <li><a href="/developer/examples/12-build-bank-data-aggregator">12. Build a Bank Data Aggregator</a> — AISP consent, account sync, transaction history, token management (15 min)</li>
</ul>

<p>Every example covers happy-path requests, error responses (RFC 7807 Problem Details), and the matching webhook payload where applicable. Languages: cURL, Node.js, and Python in every guide; PHP, Java, and Go on the quickstart and go-live guides.</p>`
  },
  {
    path: '/developer/gateway/quickstart',
    title: 'Payment Gateway Quickstart (10 min) | Kang Open Banking',
    description: `Accept your first payment in 10 minutes with Kang Open Banking Payment Gateway. Mobile money, cards, and bank transfers in Cameroon and CEMAC. Field names match OpenAPI v${KOB_API_VERSION}.`,
    h1: 'Payment Gateway Quickstart — Accept Payments in 10 Minutes',
    serveAsExtensionlessFile: true,
    content: `<h2>10-Minute Integration Guide</h2>
<p>Start accepting payments in Cameroon and the CEMAC region with minimal code. Always include an <code>Idempotency-Key</code> header on every payment POST request. The GatewayCharge schema requires <code>channel</code> and <code>customer_phone</code> per the OpenAPI 3.1 spec.</p>
<h3>Step 1: Create a Charge (Mobile Money)</h3>
<pre><code>curl -X POST https://sandbox-api.kangopenbanking.com/v1/gateway/charges \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "amount": "500000",
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237650000000",
    "description": "Test payment"
  }'</code></pre>
<h3>Step 2: Successful Response</h3>
<pre><code>{
  "data": {
    "id": "ch_01HZX9K7P3M2N4Q5R6S7T8V9W0",
    "status": "pending",
    "amount": "500000",
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237650000000",
    "tx_ref": "kob_tx_8f3e1c92a7b4",
    "created_at": "2026-05-01T14:32:11Z"
  }
}</code></pre>
<h3>Step 3: Check Charge Status</h3>
<pre><code>curl https://sandbox-api.kangopenbanking.com/v1/gateway/charges/ch_01HZX9K7P3M2N4Q5R6S7T8V9W0 \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"</code></pre>
<h3>Step 4: Verify Webhooks</h3>
<p>Configure your webhook endpoint and verify HMAC-SHA256 signatures on every incoming event using the <code>X-KOB-Signature</code> header. See the <a href="/developer/gateway/webhooks">Webhook Verification Guide</a>.</p>
<h3>Step 5: Issue a Payout</h3>
<pre><code>curl -X POST https://sandbox-api.kangopenbanking.com/v1/gateway/payouts \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "250000",
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237650000000"
  }'</code></pre>
<h3>Supported Payment Methods</h3>
<table>
  <tr><th>Method</th><th>Min Amount (XAF)</th><th>Max Amount (XAF)</th><th>Settlement</th></tr>
  <tr><td>MTN MoMo</td><td>100</td><td>5,000,000</td><td>T+1</td></tr>
  <tr><td>Orange Money</td><td>100</td><td>3,000,000</td><td>T+1</td></tr>
  <tr><td>Visa/Mastercard</td><td>500</td><td>10,000,000</td><td>T+2</td></tr>
  <tr><td>Bank Transfer</td><td>1,000</td><td>50,000,000</td><td>T+1</td></tr>
</table>
<p>Amounts are string integers in minor units. XAF has no subunits, so <code>"500000"</code> = 500,000 XAF.</p>`
  },
  {
    path: '/developer/gateway/webhooks',
    title: 'Webhook Verification Guide | Kang Open Banking Gateway',
    description: 'Verify Kang Open Banking webhook signatures using HMAC-SHA256. Full list of 52 event types, exponential backoff retry policy, and idempotent handling for payment notifications.',
    h1: 'Webhook Verification Guide',
    serveAsExtensionlessFile: true,
    content: `<h2>Webhook Integration</h2>
<p>Receive real-time payment, account and lifecycle notifications via HTTPS webhooks with cryptographic signature verification. Every event includes a stable <code>event_id</code> for safe idempotent handling on the receiver side.</p>
<h3>Signature Verification (HMAC-SHA256)</h3>
<p>All webhooks are signed using HMAC-SHA256. Verify the <code>X-KOB-Signature</code> header against the raw, unparsed request body using the shared secret you configured for the endpoint.</p>
<h4>Node.js</h4>
<pre><code>const crypto = require('crypto');
function verify(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret)
    .update(rawBody, 'utf8').digest('hex');
  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
}</code></pre>
<h4>Python</h4>
<pre><code>import hmac, hashlib
def verify(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)</code></pre>
<h4>PHP</h4>
<pre><code>function verify(string $rawBody, string $signature, string $secret): bool {
    $expected = hash_hmac('sha256', $rawBody, $secret);
    return hash_equals($expected, $signature);
}</code></pre>
<h3>Event Types (52 events)</h3>
<p>Grouped by domain. Subscribe to only the events you need.</p>
<table>
  <tr><th>Domain</th><th>Events</th></tr>
  <tr><td>Charges</td><td><code>charge.created</code>, <code>charge.pending</code>, <code>charge.succeeded</code>, <code>charge.failed</code>, <code>charge.cancelled</code>, <code>charge.refunded</code>, <code>charge.partially_refunded</code></td></tr>
  <tr><td>Refunds</td><td><code>refund.created</code>, <code>refund.succeeded</code>, <code>refund.failed</code></td></tr>
  <tr><td>Payouts</td><td><code>payout.created</code>, <code>payout.pending</code>, <code>payout.sent</code>, <code>payout.succeeded</code>, <code>payout.failed</code>, <code>payout.cancelled</code></td></tr>
  <tr><td>Transfers</td><td><code>transfer.initiated</code>, <code>transfer.completed</code>, <code>transfer.failed</code>, <code>transfer.reversed</code></td></tr>
  <tr><td>Disputes</td><td><code>dispute.opened</code>, <code>dispute.evidence_required</code>, <code>dispute.won</code>, <code>dispute.lost</code>, <code>dispute.closed</code></td></tr>
  <tr><td>Settlements</td><td><code>settlement.created</code>, <code>settlement.completed</code>, <code>settlement.failed</code></td></tr>
  <tr><td>Subscriptions</td><td><code>subscription.created</code>, <code>subscription.renewed</code>, <code>subscription.cancelled</code>, <code>subscription.payment_failed</code></td></tr>
  <tr><td>Accounts (AISP)</td><td><code>consent.authorised</code>, <code>consent.revoked</code>, <code>consent.expired</code>, <code>account.linked</code>, <code>account.unlinked</code></td></tr>
  <tr><td>Payments (PISP)</td><td><code>payment.initiated</code>, <code>payment.authorised</code>, <code>payment.completed</code>, <code>payment.rejected</code>, <code>payment.cancelled</code></td></tr>
  <tr><td>KYC / Compliance</td><td><code>kyc.submitted</code>, <code>kyc.approved</code>, <code>kyc.rejected</code>, <code>compliance.flagged</code>, <code>sar.filed</code></td></tr>
  <tr><td>Loans / Savings</td><td><code>loan.disbursed</code>, <code>loan.repaid</code>, <code>loan.overdue</code>, <code>savings.deposit</code>, <code>savings.withdrawal</code></td></tr>
  <tr><td>System</td><td><code>webhook.test</code></td></tr>
</table>
<h3>Retry Policy</h3>
<p>Failed deliveries (any non-2xx response or timeout) are retried with exponential backoff over 7 attempts:</p>
<table>
  <tr><th>Attempt</th><th>Delay</th></tr>
  <tr><td>1</td><td>Immediate</td></tr>
  <tr><td>2</td><td>+1 minute</td></tr>
  <tr><td>3</td><td>+5 minutes</td></tr>
  <tr><td>4</td><td>+30 minutes</td></tr>
  <tr><td>5</td><td>+2 hours</td></tr>
  <tr><td>6</td><td>+8 hours</td></tr>
  <tr><td>7</td><td>+24 hours</td></tr>
</table>
<p>After the 7th failure the event is moved to the dead-letter queue and retained for 30 days. You can replay events from the Developer Console or the <code>POST /v1/webhooks/{id}/replay</code> API.</p>
<p><strong>Per-attempt timeout:</strong> 10 seconds. Return any 2xx within that window to acknowledge.</p>`
  },
  {
    path: '/developer/sandbox',
    title: 'Sandbox Environment | Kang Open Banking Developer Sandbox',
    description: 'Free sandbox environment for testing Kang Open Banking API. Test credentials, simulated payments, mobile money test numbers, and card test data.',
    h1: 'Sandbox Environment Overview',
    content: `<h2>Free Developer Sandbox</h2>
<p>A fully functional test environment mirroring production. No signup required — use the default sandbox key to start immediately.</p>
<h3>Sandbox Base URL</h3>
<p><code>https://sandbox-api.kangopenbanking.com/v1</code></p>
<h3>Default Test Credentials</h3>
<p>API Key: <code>sk_test_kob_sandbox_demo_key_2024</code></p>
<h3>Test Coverage</h3>
<table>
  <tr><th>Area</th><th>Supported</th></tr>
  <tr><td>Mobile Money</td><td>MTN MoMo and Orange Money success, failure and timeout simulations</td></tr>
  <tr><td>Cards</td><td>Success, declined and 3-D Secure-required test numbers</td></tr>
  <tr><td>Webhooks</td><td>Signed test delivery with retry and deduplication headers</td></tr>
</table>
<p>For the full sandbox reference, continue to <a href="/developer/sandbox/overview">Sandbox Overview</a>.</p>`
  },
  {
    path: '/developer/sandbox/overview',
    title: 'Sandbox Environment | Kang Open Banking Developer Sandbox',
    description: 'Free sandbox environment for testing Kang Open Banking API. Test credentials, simulated payments, mobile money test numbers, and card test data.',
    h1: 'Sandbox Environment Overview',
    content: `<h2>Free Developer Sandbox</h2>
<p>A fully functional test environment mirroring production. No signup required — use the default sandbox key to start immediately.</p>
<h3>Sandbox Base URL</h3>
<p><code>https://sandbox-api.kangopenbanking.com/v1</code></p>
<h3>Production Base URL</h3>
<p><code>https://api.kangopenbanking.com/v1</code></p>
<h3>Sandbox-only endpoints</h3>
<ul>
  <li><code>POST /v1/sandbox/reset</code> — Reset all your sandbox data</li>
  <li><code>POST /v1/sandbox/webhooks/send-test</code> — Trigger a test webhook delivery</li>
</ul>
<h3>Default Test Credentials</h3>
<p>API Key: <code>sk_test_kob_sandbox_demo_key_2024</code></p>
<h3>Test Phone Numbers (Mobile Money)</h3>
<table>
  <tr><th>Number</th><th>Provider</th><th>Behavior</th></tr>
  <tr><td>+237670000000</td><td>MTN MoMo</td><td>Always succeeds</td></tr>
  <tr><td>+237670000001</td><td>MTN MoMo</td><td>Insufficient funds</td></tr>
  <tr><td>+237690000000</td><td>Orange Money</td><td>Always succeeds</td></tr>
  <tr><td>+237690000001</td><td>Orange Money</td><td>Timeout simulation</td></tr>
</table>
<h3>Test Card Numbers</h3>
<table>
  <tr><th>Card Number</th><th>Result</th></tr>
  <tr><td>4242 4242 4242 4242</td><td>Success</td></tr>
  <tr><td>4000 0000 0000 0002</td><td>Declined</td></tr>
  <tr><td>4000 0025 0000 3155</td><td>3D-Secure required</td></tr>
</table>`
  },
  {
    path: '/developer/changelog',
    title: 'API Changelog | Kang Open Banking Version History',
    description: 'Complete changelog for Kang Open Banking API. Track new endpoints, breaking changes, deprecations, and version history.',
    h1: 'API Changelog',
    serveAsExtensionlessFile: true,
    content: renderChangelogContent()
  },
  {
    path: '/developer/guides/sdks',
    title: 'SDKs and Libraries | Kang Open Banking Developer Tools',
    description: 'Official SDKs for Kang Open Banking API. Node.js, Python, PHP, Java, Go, and Ruby client libraries with installation guides and complete working examples.',
    h1: 'SDKs and Client Libraries',
    content: `<h2>Official SDKs</h2>
<p>Install an official SDK to integrate Kang Open Banking API in your preferred language. All official SDKs handle authentication, automatic retries, idempotency-key generation and HMAC webhook signature verification.</p>
<h3>Officially Published SDKs</h3>
<table>
  <tr><th>Language</th><th>Package</th><th>Install</th><th>Min Runtime</th></tr>
  <tr><td>Node.js / TypeScript</td><td>@kangopenbanking/sdk</td><td><code>npm install @kangopenbanking/sdk</code></td><td>Node 18+</td></tr>
  <tr><td>Python</td><td>kang-openbanking</td><td><code>pip install kang-openbanking</code></td><td>Python 3.9+</td></tr>
  <tr><td>PHP</td><td>kang/openbanking-php</td><td><code>composer require kang/openbanking-php</code></td><td>PHP 8.1+</td></tr>
</table>
<h3>Node.js — Create a Mobile Money Charge</h3>
<pre><code>import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  apiKey: process.env.KOB_API_KEY!, // sk_test_... or sk_live_...
  environment: 'sandbox',           // 'sandbox' | 'production'
});

const charge = await kob.gateway.charges.create({
  amount: '5000',
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '+237650000000',
  provider: 'mtn_momo',
  description: 'Order #1234',
}); // Idempotency-Key auto-generated

console.log(charge.id, charge.status);</code></pre>
<h3>Python — Create a Mobile Money Charge</h3>
<pre><code>from kang_openbanking import KangOpenBanking

kob = KangOpenBanking(
    api_key=os.environ["KOB_API_KEY"],
    environment="sandbox",
)

charge = kob.gateway.charges.create(
    amount="5000",
    currency="XAF",
    channel="mobile_money",
    customer_phone="+237650000000",
    provider="mtn_momo",
    description="Order #1234",
)
print(charge.id, charge.status)</code></pre>
<h3>PHP — Create a Mobile Money Charge</h3>
<pre><code>use Kang\\OpenBanking\\Client;

$kob = new Client([
    'api_key' => getenv('KOB_API_KEY'),
    'environment' => 'sandbox',
]);

$charge = $kob->gateway->charges->create([
    'amount' => '5000',
    'currency' => 'XAF',
    'channel' => 'mobile_money',
    'customer_phone' => '+237650000000',
    'provider' => 'mtn_momo',
    'description' => 'Order #1234',
]);

echo $charge->id, ' ', $charge->status;</code></pre>
<h3>Self-Hosted Implementation Guides</h3>
<p>Java (OkHttp), Go (net/http), and Ruby (Net::HTTP) drop-in client guides are published; official packages are targeted for Q3 2026. Each guide includes auth header construction, idempotency key generation (UUID v4), HMAC-SHA256 webhook signature verification, and exponential backoff retry policy.</p>`
  },
  {
    path: '/developer/authentication/dcr',
    title: 'Dynamic Client Registration (RFC 7591) | Kang Open Banking Developer Docs',
    description: 'Register OAuth 2.0 / OIDC clients programmatically with Kang Open Banking using RFC 7591 Dynamic Client Registration. Signed Software Statement Assertion (SSA), FAPI 1.0 Advanced extensions, mTLS binding, rotation and revocation.',
    h1: 'Dynamic Client Registration (DCR)',
    content: `<h2>Programmatic OAuth 2.0 / OIDC Client Registration</h2>
<p>Kang Open Banking implements RFC 7591 Dynamic Client Registration with the FAPI 1.0 Advanced extensions required by UK Open Banking, Berlin Group NextGenPSD2, and FDX. One signed Software Statement Assertion (SSA) authorises a Third-Party Provider (TPP) against every connected bank in the directory.</p>
<h3>Endpoint</h3>
<pre><code>POST https://api.kangopenbanking.com/v1/dcr/register
Content-Type: application/json

{
  "software_statement": "eyJhbGciOiJQUzI1NiJ9...",
  "redirect_uris": ["https://yourapp.com/callback"],
  "grant_types": ["authorization_code", "refresh_token", "client_credentials"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "tls_client_auth",
  "scope": "openid accounts balances transactions payments offline_access"
}</code></pre>
<h3>Required SSA claims</h3>
<ul>
  <li><code>software_id</code> — stable identifier for the TPP application</li>
  <li><code>software_client_name</code> — human-readable name shown on consent screens</li>
  <li><code>software_roles</code> — AISP, PISP, CBPII or any combination</li>
  <li><code>software_jwks_uri</code> — public JWKS for request signing</li>
  <li><code>org_id</code> — verified organisation identifier from the KOB Directory</li>
</ul>
<h3>Lifecycle (RFC 7592)</h3>
<ul>
  <li><code>GET /v1/dcr/clients/{client_id}</code> — read the live registration</li>
  <li><code>PUT /v1/dcr/clients/{client_id}</code> — rotate metadata or secret</li>
  <li><code>DELETE /v1/dcr/clients/{client_id}</code> — revoke the client and all issued tokens</li>
</ul>
<p>Standards: RFC 7591, RFC 7592, RFC 8705 mTLS, FAPI 1.0 Advanced § 5.2.2.</p>`
  },
  {
    path: '/developer/open-banking/standards',
    title: 'Standards & Compliance Index | Kang Open Banking Developer Docs',
    description: 'Kang Open Banking complies with FAPI 1.0 Advanced, OAuth 2.0 / OIDC, RFC 7591 DCR, RFC 8705 mTLS, RFC 7807 errors, ISO 20022, UK OBIE, Berlin Group NextGenPSD2, FDX 6.0, PSD2 SCA, and COBAC.',
    h1: 'Standards & Compliance Index',
    content: `<h2>Internationally recognised standards</h2>
<p>Every standard below has a published proof page on the developer portal, with live implementation, code samples and specification references.</p>
<table>
  <tr><th>Standard</th><th>Status</th><th>Authority</th></tr>
  <tr><td>FAPI 1.0 Advanced</td><td>Compliant</td><td>OpenID Foundation</td></tr>
  <tr><td>OAuth 2.0 / OIDC Core</td><td>Compliant</td><td>IETF / OpenID Foundation</td></tr>
  <tr><td>RFC 7591 Dynamic Client Registration</td><td>Compliant</td><td>IETF</td></tr>
  <tr><td>RFC 8705 mTLS</td><td>Compliant</td><td>IETF</td></tr>
  <tr><td>UK Open Banking (OBIE)</td><td>Compatible</td><td>Open Banking Implementation Entity</td></tr>
  <tr><td>Berlin Group NextGenPSD2</td><td>Compatible</td><td>Berlin Group</td></tr>
  <tr><td>FDX 6.0 (US)</td><td>Compatible</td><td>Financial Data Exchange</td></tr>
  <tr><td>PSD2 / Strong Customer Authentication</td><td>Aligned</td><td>European Banking Authority</td></tr>
  <tr><td>ISO 20022</td><td>Supported</td><td>ISO / SWIFT</td></tr>
  <tr><td>RFC 7807 Problem Details</td><td>Compliant</td><td>IETF</td></tr>
  <tr><td>COBAC Regulatory Framework</td><td>Compliant</td><td>Commission Bancaire de l'Afrique Centrale</td></tr>
</table>
<p>Proof pages: <a href="/developer/authentication/fapi">FAPI</a> · <a href="/developer/authentication/oauth2">OAuth 2.0</a> · <a href="/developer/authentication/dcr">DCR</a> · <a href="/developer/authentication/mtls">mTLS</a> · <a href="/developer/open-banking/consents">Consents &amp; SCA</a> · <a href="/developer/iso20022/messages">ISO 20022</a> · <a href="/developer/api-reference/obie-migration">OBIE Migration</a></p>`
  },
  {
    path: '/developer/spec-diff',
    title: 'OpenAPI Version Diff | Kang Open Banking',
    description: 'Compare any two published Kang Open Banking OpenAPI versions side-by-side. Surfaces added paths, removed paths, schema changes, and breaking changes for institutional review.',
    h1: 'OpenAPI Version Diff',
    content: `<h2>Compare two API versions</h2>
<p>Use this tool before upgrading clients. Pick a "from" and "to" version; the page calls <code>GET /v1/spec/diff</code> and renders added paths, removed paths, schema changes, response-code changes, and required-field changes. Breaking changes are flagged in red.</p>
<h3>Endpoints</h3>
<table>
  <tr><th>Method</th><th>Path</th><th>Description</th></tr>
  <tr><td>GET</td><td><code>/v1/spec/versions</code></td><td>Lists every published OpenAPI version with release date and snapshot availability.</td></tr>
  <tr><td>GET</td><td><code>/v1/spec/diff?from=4.28.1&amp;to=4.28.2</code></td><td>Returns a structured JSON diff of two versions.</td></tr>
</table>
<h3>Classification</h3>
<ul>
  <li><strong>Additive</strong> (safe): new paths, new response codes, new optional schema fields.</li>
  <li><strong>Breaking</strong> (red): removed paths, removed response codes, renamed operationIds, removed required fields, removed schemas. Per Standing Order 1 (The Lock), breaking changes require an API major-version increment.</li>
</ul>
<h3>cURL</h3>
<pre><code>curl https://api.kangopenbanking.com/v1/spec/diff?from=4.28.1&amp;to=4.28.2</code></pre>
<p>Standards cited: RFC 6902 (JSON Patch), Standing Order 1 (The Lock), Standing Order 4 (Surgeon Rule).</p>`
  },
  {
    path: '/developer/authentication',
    title: 'Authentication | Kang Open Banking Developer Docs',
    description: 'Authenticate with the Kang Open Banking API using API keys (Bearer tokens) or OAuth 2.0 with PKCE. Full scopes table, FAPI 1.0 Advanced posture, mTLS, and worked examples.',
    h1: 'Authentication',
    content: `<h2>Authentication Methods</h2>
<p>Kang Open Banking supports two complementary authentication methods. Use API keys for server-to-server merchant integrations, and OAuth 2.0 with PKCE for third-party Open Banking apps acting on behalf of an end user.</p>
<h3>1. API Keys (Bearer tokens) — Merchant integrations</h3>
<p>Send your secret key as a Bearer token on every request. Sandbox keys start with <code>sk_test_</code>; live keys start with <code>sk_live_</code>. Never expose secret keys in client-side code.</p>
<pre><code>curl https://api.kangopenbanking.com/v1/gateway/charges \\
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Idempotency-Key: $(uuidgen)"</code></pre>
<h3>2. OAuth 2.0 + PKCE — Third-party Open Banking apps</h3>
<p>OAuth 2.0 Authorization Code flow with PKCE (S256) is mandatory for all interactive flows per FAPI 1.0 Advanced § 5.2.2. Public clients (mobile, SPA) MUST use PKCE; confidential clients SHOULD use PKCE.</p>
<h4>Step 1 — Generate PKCE pair</h4>
<pre><code>// Node.js
const crypto = require('crypto');
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');</code></pre>
<h4>Step 2 — Redirect user to /authorize</h4>
<pre><code>https://api.kangopenbanking.com/v1/oauth/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &scope=openid+accounts+balances+transactions+offline_access
  &state=RANDOM_STATE
  &nonce=RANDOM_NONCE
  &code_challenge=CHALLENGE
  &code_challenge_method=S256</code></pre>
<h4>Step 3 — Exchange code for tokens</h4>
<pre><code>curl -X POST https://api.kangopenbanking.com/v1/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=AUTH_CODE" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "redirect_uri=https://yourapp.com/callback" \\
  -d "code_verifier=VERIFIER"</code></pre>
<h3>OAuth Scopes</h3>
<table>
  <tr><th>Scope</th><th>Grants</th><th>Required For</th></tr>
  <tr><td><code>openid</code></td><td>OIDC ID token</td><td>All OIDC flows</td></tr>
  <tr><td><code>profile</code></td><td>User profile claims</td><td>Display user name/email</td></tr>
  <tr><td><code>offline_access</code></td><td>Refresh token</td><td>Long-lived access</td></tr>
  <tr><td><code>accounts</code></td><td>Read account list (AISP)</td><td>GET /v1/aisp/accounts</td></tr>
  <tr><td><code>balances</code></td><td>Read account balances</td><td>GET /v1/aisp/accounts/*/balances</td></tr>
  <tr><td><code>transactions</code></td><td>Read transaction history</td><td>GET /v1/aisp/accounts/*/transactions</td></tr>
  <tr><td><code>beneficiaries</code></td><td>Read saved beneficiaries</td><td>GET /v1/aisp/accounts/*/beneficiaries</td></tr>
  <tr><td><code>payments</code></td><td>Initiate payments (PISP)</td><td>POST /v1/pisp/payments</td></tr>
  <tr><td><code>gateway:read</code></td><td>Read charges, payouts, refunds</td><td>Merchant read access</td></tr>
  <tr><td><code>gateway:write</code></td><td>Create charges, payouts, refunds</td><td>Merchant write access</td></tr>
</table>
<h3>Token Lifetimes</h3>
<table>
  <tr><th>Token Type</th><th>Lifetime</th><th>Rotation</th></tr>
  <tr><td>Access Token</td><td>15 minutes</td><td>Non-rotating; request a new one via refresh</td></tr>
  <tr><td>Refresh Token</td><td>30 days</td><td>Rotating — each use issues a new refresh token; reuse triggers session-wide revocation (OAuth 2.1 § 6.1)</td></tr>
  <tr><td>Authorization Code</td><td>60 seconds</td><td>Single-use</td></tr>
</table>
<h3>FAPI 1.0 Advanced Posture</h3>
<ul>
  <li>PKCE S256 mandatory on all <code>/authorize</code> requests</li>
  <li><code>nonce</code> required on OIDC requests</li>
  <li>Pushed Authorization Requests (PAR) supported at <code>POST /v1/oauth/par</code></li>
  <li>mTLS bound access tokens via <code>tls_client_auth</code> (RFC 8705)</li>
  <li>Request object signing supported (PS256, ES256)</li>
</ul>
<p>See also: <a href="/developer/authentication/oauth2">OAuth 2.0 reference</a> · <a href="/developer/authentication/fapi">FAPI</a> · <a href="/developer/authentication/mtls">mTLS</a> · <a href="/developer/authentication/dcr">Dynamic Client Registration</a></p>`
  },
  {
    path: '/developer',
    title: 'Developer Portal | Kang Open Banking API Documentation',
    description: `Kang Open Banking Developer Portal. API documentation, interactive explorer, SDKs, sandbox environment, and integration guides for Cameroon and CEMAC payments. API v${KOB_API_VERSION}.`,
    h1: 'Kang Open Banking Developer Portal',
    content: `<h2>Build with the Kang Open Banking API</h2>
<p><strong>Kang Open Banking API v${KOB_API_VERSION} · OpenAPI 3.1.0 · 391 operations · FAPI 1.0 Advanced</strong></p>
<p>Everything you need to integrate payments, banking, and financial services for Cameroon and the CEMAC region.</p>

<h3>Start building — pick your path</h3>
<ul>
  <li><strong>I'm a developer</strong> → <a href="/developer/getting-started">Getting Started</a> — first API call in 5 minutes</li>
  <li><strong>I'm integrating a bank</strong> → <a href="/developer/authentication">Authentication &amp; FAPI</a> — OAuth 2.0 + PKCE, mTLS, DCR</li>
  <li><strong>I'm an e-commerce business</strong> → <a href="/developer/gateway/quickstart">Payment Gateway Quickstart</a> — accept payments in 10 minutes</li>
</ul>

<h3>What's new</h3>
<ul>
  <li><strong>v${KOB_API_VERSION} — May 2026:</strong> Webhook signature and replay-protection header names aligned across the public OpenAPI spec and docs. <a href="/developer/changelog">Full changelog →</a></li>
  <li><strong>v${KOB_API_VERSION} — May 2026:</strong> SDK coverage metadata extended for Java, Go, and Ruby.</li>
  <li><strong>v${KOB_API_VERSION} — May 2026:</strong> Spec versioning, diff endpoints, provider sandbox simulators, and webhook replay tooling published.</li>
</ul>

<h3>Quick links</h3>
<ul>
  <li><a href="/developer/getting-started">Getting Started Guide</a> — first API call in 5 minutes</li>
  <li><a href="/developer/authentication">Authentication</a> — API keys, OAuth 2.0 + PKCE, scopes table</li>
  <li><a href="/developer/api-explorer">API Explorer</a> — interactive Swagger UI</li>
  <li><a href="/developer/gateway/quickstart">Payment Gateway Quickstart</a> — accept payments in 10 minutes</li>
  <li><a href="/developer/gateway/webhooks">Webhook Verification Guide</a> — HMAC-SHA256, 52 event types, retry policy</li>
  <li><a href="/developer/sandbox/overview">Sandbox Environment</a> — free testing with test credentials</li>
  <li><a href="/developer/guides/sdks">SDKs and Libraries</a> — Node.js, Python, PHP (Java, Go, Ruby implementation guides)</li>
  <li><a href="/developer/examples/real-world">Real-World Examples</a> — production-ready integration patterns</li>
  <li><a href="/developer/open-banking/standards">Standards &amp; Compliance Index</a> — FAPI, OBIE, Berlin Group, FDX, ISO 20022, PSD2</li>
  <li><a href="/developer/authentication/dcr">Dynamic Client Registration</a> — RFC 7591 ecosystem onboarding</li>
  <li><a href="/developer/changelog">Changelog</a> — every API change within 48 hours of deployment</li>
</ul>

<h3>Specifications</h3>
<ul>
  <li><a href="/openapi.json">OpenAPI 3.1 (JSON)</a> — machine-readable, downloadable, no auth</li>
  <li><a href="/openapi.yaml">OpenAPI 3.1 (YAML)</a></li>
  <li><a href="/openapi-sandbox.json">Sandbox OpenAPI 3.1 (JSON)</a></li>
</ul>`
  },
];

export function prerenderDocsPlugin(): Plugin {
  return {
    name: 'prerender-docs',
    apply: 'build',
    closeBundle: {
      sequential: true,
      async handler() {
        const distDir = path.resolve(process.cwd(), 'dist');
        const indexHtmlPath = path.join(distDir, 'index.html');

        if (!fs.existsSync(indexHtmlPath)) {
          console.warn('[prerender-docs] dist/index.html not found, skipping.');
          return;
        }

        const baseHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
        let generated = 0;

        for (const route of DOC_ROUTES) {
          // Build the directory path: /developer/getting-started -> dist/developer/getting-started/
          const routeDir = path.join(distDir, route.path);
          const routeHtmlPath = path.join(routeDir, 'index.html');
          const extensionlessRoutePath = path.join(distDir, route.path);

          // Skip if file already exists (e.g., the root /developer might conflict)
          if (fs.existsSync(routeHtmlPath)) {
            // Still replace content for existing files
          }

          // Always write the directory-index variant. Netlify (and most
          // static hosts) resolve `/foo/index.html` for `/foo` requests
          // before applying SPA catch-all rewrites — without this,
          // `/developer/changelog` and `/developer/examples/real-world` fell
          // through to the SPA shell and returned the homepage shell.
          fs.mkdirSync(routeDir, { recursive: true });

          // Modify the HTML for this specific route
          let html = baseHtml;

          // Replace <title>
          html = html.replace(
            /<title>[^<]*<\/title>/,
            `<title>${route.title}</title>`
          );

          // Replace meta description
          html = html.replace(
            /<meta name="description" content="[^"]*">/,
            `<meta name="description" content="${route.description}">`
          );

          // Replace canonical URL
          html = html.replace(
            /<link rel="canonical" href="[^"]*" \/>/,
            `<link rel="canonical" href="https://kangopenbanking.com${route.path}" />`
          );

          // Replace OG title
          html = html.replace(
            /<meta property="og:title" content="[^"]*">/,
            `<meta property="og:title" content="${route.title}">`
          );
          html = html.replace(
            /<meta name="twitter:title" content="[^"]*">/,
            `<meta name="twitter:title" content="${route.title}">`
          );

          // Replace OG description
          html = html.replace(
            /<meta property="og:description" content="[^"]*">/,
            `<meta property="og:description" content="${route.description}">`
          );
          html = html.replace(
            /<meta name="twitter:description" content="[^"]*">/,
            `<meta name="twitter:description" content="${route.description}">`
          );

          // Replace OG URL
          html = html.replace(
            /<meta property="og:url" content="[^"]*" \/>/,
            `<meta property="og:url" content="https://kangopenbanking.com${route.path}" />`
          );

          // Replace the <noscript> block with route-specific content
          html = html.replace(
            /<noscript>[\s\S]*?<\/noscript>/,
            `<noscript>
      <div style="max-width:960px;margin:0 auto;padding:2rem;font-family:system-ui,sans-serif;color:#1a1a2e">
        <h1>${route.h1}</h1>
        <p>${route.description}</p>
        ${route.content}
        <hr/>
        <p><a href="/developer">Developer Portal Home</a> | <a href="/openapi.json">OpenAPI Spec (JSON)</a> | <a href="mailto:developers@kangopenbanking.com">Contact</a></p>
      </div>
    </noscript>`
          );

          // NOTE: We intentionally do NOT inject a visible #ssr-fallback div here.
          // Doing so caused duplicate content rendering: the static block stayed
          // briefly visible alongside the React-rendered page on hydration, and
          // some crawlers indexed the page body twice. The <noscript> block above
          // is sufficient for SEO and for non-JS crawlers; React owns the visible
          // DOM exclusively. (Audit fix — Developer Portal duplicate content bug.)

          if (route.serveAsExtensionlessFile) {
            // Publish the directory-index variant (Netlify's first lookup
            // for `/foo`) AND the `.html` mirror so every edge resolution
            // path wins before the SPA catch-all redirect kicks in (P1/P2).
            // We can no longer write the extensionless sibling file because
            // it collides with the directory at the same path.
            fs.writeFileSync(routeHtmlPath, html, 'utf-8');
            fs.writeFileSync(path.join(distDir, `${route.path}.html`), html, 'utf-8');
          } else {
            fs.writeFileSync(routeHtmlPath, html, 'utf-8');
          }
          generated++;
        }

        console.log(`[prerender-docs] Generated ${generated} static HTML files for documentation routes.`);
      }
    }
  };
}
