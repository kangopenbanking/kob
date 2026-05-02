/**
 * Vite Plugin: Static HTML Pre-rendering for Documentation Routes
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

interface DocRoute {
  path: string;
  title: string;
  description: string;
  h1: string;
  content: string;
}

const DOC_ROUTES: DocRoute[] = [
  {
    path: '/developer/getting-started',
    title: 'Getting Started | Kang Open Banking Developer Docs',
    description: 'Make your first API call to the Kang Open Banking API in under 5 minutes. Free sandbox, no signup required. cURL, Node.js, Python, PHP, Go, and Java examples.',
    h1: 'Getting Started with Kang Open Banking API',
    content: `<h2>Quick Start Guide</h2>
<p>Get your sandbox API key and make your first API call in under 5 minutes. No signup required.</p>
<h3>Step 1: Get Your Sandbox Key</h3>
<p>Use the instant key generator on this page or use the default test key: <code>sk_test_kob_sandbox_demo_key_2024</code></p>
<h3>Step 2: Make Your First API Call</h3>
<pre><code>curl -i https://api.kangopenbanking.com/v1/health</code></pre>
<h3>Step 3: Try a Payment (Sandbox)</h3>
<pre><code>curl -X POST https://sandbox-api.kangopenbanking.com/v1/gateway/charges \\
  -H "Authorization: Bearer sk_test_kob_sandbox_demo_key_2024" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"amount":"5000","currency":"XAF","provider":"mtn_momo","phone_number":"+237670000000"}'</code></pre>
<h3>Available SDKs</h3>
<ul>
  <li>Node.js / TypeScript — <code>npm install @kangopenbanking/sdk</code></li>
  <li>Python — <code>pip install kang-openbanking</code></li>
  <li>PHP — <code>composer require kang/openbanking-php</code></li>
  <li>Java, Go, Ruby — coming soon. Implementation guides available on the SDKs page.</li>
</ul>
<p>Production base URL: <code>https://api.kangopenbanking.com/v1</code><br/>Sandbox base URL: <code>https://sandbox-api.kangopenbanking.com/v1</code></p>`
  },
  {
    path: '/developer/api-explorer',
    title: 'API Explorer | Kang Open Banking Interactive Swagger UI',
    description: 'Interactive API Explorer powered by Swagger UI. Try all Kang Open Banking endpoints live — payments, accounts, transfers, webhooks. OpenAPI 3.1 spec included.',
    h1: 'API Explorer — Interactive Swagger UI',
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
</ul>
<p>Authentication: Bearer token or OAuth 2.0. Sandbox key: <code>sk_test_kob_sandbox_demo_key_2024</code></p>`
  },
  {
    path: '/developer/examples/real-world',
    title: 'Real-World Integration Examples | Kang Open Banking',
    description: 'Production-tested integration examples for Kang Open Banking API. E-commerce checkout, subscription billing, marketplace payouts, and mobile money collection flows.',
    h1: 'Real-World Integration Examples',
    content: `<h2>Production-Ready Code Examples</h2>
<p>Complete, tested integration patterns for common use cases in the CEMAC region.</p>
<h3>E-Commerce Checkout</h3>
<p>Accept MTN MoMo, Orange Money, and card payments in a single checkout flow. Includes webhook verification and order fulfillment.</p>
<h3>Subscription Billing</h3>
<p>Recurring payments with automatic retry, dunning management, and prorated refunds for XAF-denominated subscriptions.</p>
<h3>Marketplace Payouts</h3>
<p>Split payments between marketplace operators and sellers. Supports escrow holds, commission deduction, and instant payouts.</p>
<h3>Mobile Money Collection</h3>
<p>Bulk collection from MTN MoMo and Orange Money accounts. Batch processing with reconciliation reports.</p>
<h3>Bank-to-Bank Transfers</h3>
<p>Domestic CEMAC transfers via SYSTAC/SYGMA rails. Real-time status tracking and settlement notifications.</p>
<p>All examples include cURL, Node.js, and Python implementations with error handling.</p>`
  },
  {
    path: '/developer/gateway/quickstart',
    title: 'Payment Gateway Quickstart (10 min) | Kang Open Banking',
    description: 'Accept your first payment in 10 minutes with Kang Open Banking Payment Gateway. Mobile money, cards, and bank transfers in Cameroon and CEMAC.',
    h1: 'Payment Gateway Quickstart — Accept Payments in 10 Minutes',
    content: `<h2>10-Minute Integration Guide</h2>
<p>Start accepting payments in Cameroon and the CEMAC region with minimal code. Always include an <code>Idempotency-Key</code> header on every payment POST request.</p>
<h3>Step 1: Create a Charge (Mobile Money)</h3>
<pre><code>curl -X POST https://sandbox-api.kangopenbanking.com/v1/gateway/charges \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"amount":"500000","currency":"XAF","provider":"mtn_momo","phone_number":"+237670000000","description":"Test payment"}'</code></pre>
<h3>Step 2: Check Charge Status</h3>
<pre><code>curl https://sandbox-api.kangopenbanking.com/v1/gateway/charges/CHARGE_ID \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"</code></pre>
<h3>Step 3: Verify Webhooks</h3>
<p>Configure your webhook endpoint and verify HMAC-SHA256 signatures on every incoming event using the <code>X-KOB-Signature</code> header.</p>
<h3>Step 4: Issue a Payout</h3>
<pre><code>curl -X POST https://sandbox-api.kangopenbanking.com/v1/gateway/payouts \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":"250000","currency":"XAF","provider":"mtn_momo","phone_number":"+237670000000"}'</code></pre>
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
    description: 'Verify Kang Open Banking webhook signatures using HMAC-SHA256. Event types, retry policy, and idempotent handling for payment notifications.',
    h1: 'Webhook Verification Guide',
    content: `<h2>Webhook Integration</h2>
<p>Receive real-time payment notifications via HTTPS webhooks with cryptographic signature verification.</p>
<h3>Signature Verification</h3>
<p>All webhooks are signed using HMAC-SHA256. Verify the <code>X-KOB-Signature</code> header against the raw request body.</p>
<pre><code>const crypto = require('crypto');
const signature = crypto.createHmac('sha256', webhookSecret)
  .update(rawBody).digest('hex');
const isValid = signature === receivedSignature;</code></pre>
<h3>Event Types</h3>
<ul>
  <li><code>payment.completed</code> — Payment successfully processed</li>
  <li><code>payment.failed</code> — Payment attempt failed</li>
  <li><code>payment.refunded</code> — Refund completed</li>
  <li><code>transfer.completed</code> — Bank transfer settled</li>
  <li><code>payout.sent</code> — Payout dispatched</li>
  <li><code>webhook.test</code> — Test ping event</li>
</ul>
<h3>Retry Policy</h3>
<p>Failed deliveries are retried with exponential backoff: 1min, 5min, 30min, 2hr, 12hr, 24hr (6 attempts total). Return HTTP 2xx to acknowledge.</p>`
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
    content: `<h2>Version History</h2>
<p>All API changes are documented here within 48 hours of deployment, as required by ORDER P7.</p>
<h3>Recent Changes</h3>
<p>View the full changelog with version numbers, dates, and categorized entries (Added, Changed, Deprecated, Fixed, Security).</p>
<p><a href="/changelog.json">Machine-readable changelog (JSON)</a></p>
<p><a href="/developer/changelog.xml">RSS Feed</a></p>`
  },
  {
    path: '/developer/guides/sdks',
    title: 'SDKs and Libraries | Kang Open Banking Developer Tools',
    description: 'Official SDKs for Kang Open Banking API. Node.js, Python, PHP, Java, Go, and Ruby client libraries with installation guides and examples.',
    h1: 'SDKs and Client Libraries',
    content: `<h2>Official SDKs</h2>
<p>Install an official SDK to integrate Kang Open Banking API in your preferred language.</p>
<h3>Officially Published SDKs</h3>
<table>
  <tr><th>Language</th><th>Package</th><th>Install</th></tr>
  <tr><td>Node.js / TypeScript</td><td>@kangopenbanking/sdk</td><td><code>npm install @kangopenbanking/sdk</code></td></tr>
  <tr><td>Python</td><td>kang-openbanking</td><td><code>pip install kang-openbanking</code></td></tr>
  <tr><td>PHP</td><td>kang/openbanking-php</td><td><code>composer require kang/openbanking-php</code></td></tr>
</table>
<h3>Community &amp; Self-Hosted Implementation Guides</h3>
<p>Java, Go, and Ruby SDKs are coming soon. Drop-in HTTP client implementation guides (OkHttp, net/http, Net::HTTP) are published on the SDKs page.</p>
<p>All official SDKs support both sandbox and production environments with automatic retries, idempotency-key handling, and HMAC webhook signature verification.</p>`
  },
  {
    path: '/developer',
    title: 'Developer Portal | Kang Open Banking API Documentation',
    description: 'Kang Open Banking Developer Portal. API documentation, interactive explorer, SDKs, sandbox environment, and integration guides for Cameroon and CEMAC payments.',
    h1: 'Kang Open Banking Developer Portal',
    content: `<h2>Build with the Kang Open Banking API</h2>
<p>Everything you need to integrate payments, banking, and financial services for Cameroon and the CEMAC region.</p>
<h3>Quick Links</h3>
<ul>
  <li><a href="/developer/getting-started">Getting Started Guide</a> — First API call in 5 minutes</li>
  <li><a href="/developer/api-explorer">API Explorer</a> — Interactive Swagger UI</li>
  <li><a href="/developer/gateway/quickstart">Payment Gateway Quickstart</a> — Accept payments in 10 minutes</li>
  <li><a href="/developer/sandbox/overview">Sandbox Environment</a> — Free testing with test credentials</li>
  <li><a href="/developer/guides/sdks">SDKs and Libraries</a> — Node.js, Python, PHP (Java, Go, Ruby implementation guides available)</li>
  <li><a href="/developer/examples/real-world">Real-World Examples</a> — Production-ready integration patterns</li>
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

          // Skip if file already exists (e.g., the root /developer might conflict)
          if (fs.existsSync(routeHtmlPath)) {
            // Still replace content for existing files
          }

          // Create directory
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

          // Add a visible server-rendered content block that the React app will replace
          // This ensures crawlers see content even without JS
          const serverContent = `
    <!-- Server-rendered content for SEO crawlers — React app replaces this on hydration -->
    <div id="ssr-fallback" style="max-width:960px;margin:0 auto;padding:2rem;font-family:system-ui,-apple-system,sans-serif;color:#1a1a2e">
      <h1>${route.h1}</h1>
      <p>${route.description}</p>
      ${route.content}
      <hr style="margin:2rem 0;border:none;border-top:1px solid #e2e8f0"/>
      <nav>
        <a href="/developer">Portal Home</a> |
        <a href="/developer/getting-started">Getting Started</a> |
        <a href="/developer/api-explorer">API Explorer</a> |
        <a href="/openapi.json">OpenAPI Spec</a>
      </nav>
    </div>`;

          // Insert the server content before the React root div
          html = html.replace(
            '<div id="root"></div>',
            `<div id="root"></div>${serverContent}`
          );

          fs.writeFileSync(routeHtmlPath, html, 'utf-8');
          generated++;
        }

        console.log(`[prerender-docs] Generated ${generated} static HTML files for documentation routes.`);
      }
    }
  };
}
