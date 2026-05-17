import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Separator } from "@/components/ui/separator";

const GatewayWebhooksGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO
      title="Webhook Guide | Kang Open Banking"
      description="Complete webhook integration guide — setup, signature verification for all providers (HMAC + PayPal certs), retries, deduplication, and sample handlers."
      canonical="https://kangopenbanking.com/developer/gateway/webhooks"
      ogImage="https://kangopenbanking.com/images/og-gateway-webhooks.png"
    />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Webhook Guide</h1>
      <p className="text-muted-foreground mt-2">Receive real-time event notifications for charges, payouts, refunds, and disputes. All outbound webhooks are HMAC-SHA256 signed. Inbound provider webhooks use provider-native verification.</p>
      <p className="text-sm text-muted-foreground mt-1">Last updated: 10 April 2026 | Contact: developers@kangopenbanking.com</p>
    </div>

    {/* Setup */}
    <Card>
      <CardHeader><CardTitle>1. Register Your Endpoint</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Register a webhook URL for your merchant to start receiving events.</p>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`curl -X POST https://api.kangopenbanking.com/v1/gateway-webhooks-router \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "merchant_id": "mch_uuid",
    "url": "https://yourapp.com/webhooks/kob",
    "events": ["charge.successful", "payout.completed", "dispute.created"],
    "active": true
  }'

# Response includes your webhook secret — store it securely!
# { "id": "wh_uuid", "secret": "whsec_...", "url": "..." }`}
        </pre>
      </CardContent>
    </Card>

    {/* How It Works */}
    <Card>
      <CardHeader><CardTitle>2. How Delivery Works</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4">
          {["Event Occurs", "Payload Signed", "POST to Your URL", "You Verify Signature", "Process Event", "Return 200"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Events are delivered as HTTP POST with JSON body. Headers include <code className="bg-muted px-1 rounded">X-KOB-Signature</code> and <code className="bg-muted px-1 rounded">X-KOB-Timestamp</code> for verification.</p>
      </CardContent>
    </Card>

    {/* Event Types */}
    <Card>
      <CardHeader><CardTitle>3. Event Types</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["charge.created", "Charge", "Charge initiated"],
              ["charge.successful", "Charge", "Payment completed successfully"],
              ["charge.failed", "Charge", "Payment failed"],
              ["charge.pending", "Charge", "Payment awaiting confirmation"],
              ["charge.refunded", "Charge", "Payment was refunded"],
              ["charge.reversed", "Charge", "Payment reversed by provider"],
              ["charge.expired", "Charge", "Payment expired before completion"],
              ["charge.cancelled", "Charge", "Payment cancelled by customer"],
              ["payout.created", "Payout", "Payout initiated"],
              ["payout.completed", "Payout", "Payout disbursed to recipient"],
              ["payout.failed", "Payout", "Payout failed"],
              ["payout.reversed", "Payout", "Payout reversed"],
              ["payout.pending", "Payout", "Payout awaiting processing"],
              ["refund.created", "Refund", "Refund initiated"],
              ["refund.completed", "Refund", "Refund processed successfully"],
              ["refund.failed", "Refund", "Refund failed"],
              ["dispute.created", "Dispute", "Card dispute opened"],
              ["dispute.updated", "Dispute", "Dispute evidence submitted"],
              ["dispute.won", "Dispute", "Dispute resolved in merchant favor"],
              ["dispute.lost", "Dispute", "Dispute resolved against merchant"],
              ["settlement.created", "Settlement", "Settlement batch created"],
              ["settlement.paid", "Settlement", "Settlement batch paid out"],
              ["settlement.failed", "Settlement", "Settlement failed"],
              ["subscription.created", "Subscription", "Subscription plan created"],
              ["subscription.activated", "Subscription", "Subscription activated"],
              ["subscription.renewed", "Subscription", "Subscription renewed"],
              ["subscription.cancelled", "Subscription", "Subscription cancelled"],
              ["subscription.expired", "Subscription", "Subscription expired"],
              ["subscription.payment_failed", "Subscription", "Subscription payment failed"],
              ["merchant.created", "Merchant", "Merchant account created"],
              ["merchant.updated", "Merchant", "Merchant details updated"],
              ["merchant.verified", "Merchant", "Merchant verification complete"],
              ["merchant.suspended", "Merchant", "Merchant account suspended"],
              ["wallet.credited", "Wallet", "Wallet credited"],
              ["wallet.debited", "Wallet", "Wallet debited"],
              ["wallet.frozen", "Wallet", "Wallet frozen"],
              ["escrow.created", "Escrow", "Escrow created"],
              ["escrow.funded", "Escrow", "Escrow funded"],
              ["escrow.released", "Escrow", "Escrow released"],
              ["escrow.disputed", "Escrow", "Escrow disputed"],
              ["escrow.refunded", "Escrow", "Escrow refunded"],
              ["consent.authorized", "AISP", "Account consent authorized"],
              ["consent.revoked", "AISP", "Account consent revoked"],
              ["consent.expired", "AISP", "Account consent expired"],
              ["payment_link.created", "Payment Link", "Payment link created"],
              ["payment_link.paid", "Payment Link", "Payment link completed"],
              ["payment_link.expired", "Payment Link", "Payment link expired"],
              ["pay_by_bank.authorized", "Pay by Bank", "Pay by bank authorized"],
              ["pay_by_bank.submitted", "Pay by Bank", "Pay by bank submitted"],
              ["pay_by_bank.completed", "Pay by Bank", "Pay by bank completed"],
              ["pay_by_bank.failed", "Pay by Bank", "Pay by bank failed"],
              ["onboarding_application.approved", "Onboarding", "Application approved"],
              ["onboarding_application.rejected", "Onboarding", "Application rejected"],
              ["merchant_kyb.verified", "KYB", "Merchant KYB verification passed"],
              ["merchant_kyb.failed", "KYB", "Merchant KYB verification failed"],
              ["credit_score.updated", "Credit", "Credit score recalculated"],
              ["loan_application.approved", "Lending", "Loan application approved"],
              ["loan_application.rejected", "Lending", "Loan application rejected"],
              ["loan_application.pending_documents", "Lending", "Loan awaiting documents"],
            ].map(([event, domain, desc]) => (
              <TableRow key={event}>
                <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{event}</code></TableCell>
                <TableCell><Badge variant="outline">{domain}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{desc}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-2">60 event types total. Subscribe to specific events or use <code className="bg-muted px-1 rounded">*</code> to receive all.</p>
      </CardContent>
    </Card>

    {/* Event Filtering */}
    <Card>
      <CardHeader><CardTitle>3b. Event Filtering (Topic Subscriptions)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          When registering a webhook, you can specify which event types to receive using the <code className="bg-muted px-1 rounded">events</code> array. If omitted or empty, the endpoint receives all events (backward compatible).
        </p>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Register a webhook that only receives payment events
POST /v1/gateway/merchants/webhooks
{
  "merchant_id": "mch_uuid",
  "url": "https://yourapp.com/webhooks/payments",
  "events": [
    "charge.successful",
    "charge.failed",
    "payout.completed",
    "refund.completed"
  ],
  "active": true
}

// Register a second endpoint for onboarding events only
POST /v1/gateway/merchants/webhooks
{
  "merchant_id": "mch_uuid",
  "url": "https://yourapp.com/webhooks/onboarding",
  "events": [
    "onboarding_application.approved",
    "onboarding_application.rejected",
    "merchant_kyb.verified",
    "merchant_kyb.failed"
  ],
  "active": true
}`}
        </pre>
        <p className="text-xs text-muted-foreground">You can update subscribed events at any time via PATCH. Events not in your filter are silently dropped -- they do not count toward delivery attempts or rate limits.</p>
      </CardContent>
    </Card>

    {/* Payload Format */}
    <Card>
      <CardHeader><CardTitle>4. Payload Format</CardTitle></CardHeader>
      <CardContent>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Headers
X-KOB-Signature: hmac_sha256=a1b2c3d4e5f6...
X-KOB-Timestamp: 1711100000
Content-Type: application/json

// Body
{
  "event_type": "charge.successful",
  "event_id": "evt_abc123",
  "created_at": "2026-03-22T10:00:00Z",
  "data": {
    "id": "chg_uuid",
    "amount": 5000,
    "currency": "XAF",
    "status": "successful",
    "channel": "mobile_money",
    "merchant_id": "mch_uuid",
    "tx_ref": "order_001",
    "provider": "flutterwave",
    "provider_ref": "FLW-MOCK-xxx"
  }
}`}
        </pre>
      </CardContent>
    </Card>

    <Separator />
    <h2 className="text-2xl font-bold">Signature Verification</h2>

    {/* KOB Outbound Signature */}
    <Card>
      <CardHeader><CardTitle>KOB → Your Server (HMAC-SHA256)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Outbound webhooks from KOB to your endpoint use HMAC-SHA256 with your webhook secret.</p>
        <div>
          <h4 className="font-semibold text-sm mb-2">Node.js</h4>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`const crypto = require('crypto');

function verifyKOBWebhook(payload, signature, timestamp, secret) {
  const signed = \`\${timestamp}.\${JSON.stringify(payload)}\`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

app.post('/webhooks/kob', express.json(), (req, res) => {
  const sig = req.headers['x-kob-signature']?.replace('hmac_sha256=', '');
  const ts  = req.headers['x-kob-timestamp'];
  if (!verifyKOBWebhook(req.body, sig, ts, process.env.KOB_WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  // Process event idempotently using event_id
  console.log('Event:', req.body.event_type, req.body.event_id);
  res.status(200).send('OK');
});`}
          </pre>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-2">Python (Flask)</h4>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`import hmac, hashlib

@app.route('/webhooks/kob', methods=['POST'])
def kob_webhook():
    sig = request.headers.get('X-KOB-Signature', '').replace('hmac_sha256=', '')
    ts  = request.headers.get('X-KOB-Timestamp', '')
    body = request.get_data(as_text=True)
    expected = hmac.new(
        WEBHOOK_SECRET.encode(), f"{ts}.{body}".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return 'Invalid signature', 401
    event = request.get_json()
    print(f"Event: {event['event_type']} {event['event_id']}")
    return 'OK', 200`}
          </pre>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-2">PHP</h4>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`<?php
$payload   = file_get_contents('php://input');
$signature = str_replace('hmac_sha256=', '', $_SERVER['HTTP_X_KOB_SIGNATURE'] ?? '');
$timestamp = $_SERVER['HTTP_X_KOB_TIMESTAMP'] ?? '';
$expected  = hash_hmac('sha256', "$timestamp.$payload", $webhookSecret);

if (!hash_equals($expected, $signature)) {
    http_response_code(401);
    exit('Invalid signature');
}
$event = json_decode($payload, true);
// Process $event['event_type']
http_response_code(200);`}
          </pre>
        </div>
      </CardContent>
    </Card>

    {/* Stripe Inbound */}
    <Card>
      <CardHeader><CardTitle>Stripe → KOB (Inbound)</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">KOB verifies Stripe webhooks using Stripe's <code className="bg-muted px-1 rounded">constructEvent()</code> with the <code className="bg-muted px-1 rounded">stripe-signature</code> header and endpoint secret.</p>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Stripe sends:
Headers:
  stripe-signature: t=1711100000,v1=<HMAC-SHA256>

// KOB validates using Stripe SDK internally
// Events handled: payment_intent.succeeded, charge.refunded, charge.dispute.*`}
        </pre>
      </CardContent>
    </Card>

    {/* Flutterwave Inbound */}
    <Card>
      <CardHeader><CardTitle>Flutterwave → KOB (Inbound)</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">KOB verifies the <code className="bg-muted px-1 rounded">verif-hash</code> header against the configured encryption key.</p>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Flutterwave sends:
Headers:
  verif-hash: <HMAC hash matching FLUTTERWAVE_ENCRYPTION_KEY>

// Events handled: charge.completed, transfer.completed, refund.*`}
        </pre>
      </CardContent>
    </Card>

    {/* PayPal Inbound — Certificate-Based */}
    <Card className="border-2 border-primary/20">
      <CardHeader><CardTitle>PayPal → KOB (Certificate-Based Verification)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">PayPal uses a <strong>certificate-based</strong> signature model — not simple HMAC. KOB verifies using PayPal's <code className="bg-muted px-1 rounded">POST /v1/notifications/verify-webhook-signature</code> API.</p>
        <div>
          <h4 className="font-semibold text-sm mb-2">Required Headers (sent by PayPal)</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Header</TableHead>
                <TableHead>Example</TableHead>
                <TableHead>Purpose</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["paypal-auth-algo", "SHA256withRSA", "Signature algorithm"],
                ["paypal-cert-url", "https://api.paypal.com/v1/notifications/certs/CERT-xxx", "Signing certificate URL"],
                ["paypal-transmission-id", "69cd13f0-d67a-11e5-baa3-778b53f4ae55", "Unique delivery ID"],
                ["paypal-transmission-sig", "(base64 string)", "RSA signature"],
                ["paypal-transmission-time", "2026-03-22T10:00:00Z", "Transmission timestamp"],
              ].map(([header, example, purpose]) => (
                <TableRow key={header}>
                  <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{header}</code></TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{example}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{purpose}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-2">Verification Flow</h4>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Step 1: Extract all 5 paypal-* headers from incoming request
// Step 2: POST to PayPal's verification endpoint:
POST https://api-m.paypal.com/v1/notifications/verify-webhook-signature
Authorization: Bearer <PayPal OAuth token>
{
  "auth_algo": "SHA256withRSA",
  "cert_url": "https://api.paypal.com/v1/notifications/certs/CERT-xxx",
  "transmission_id": "69cd13f0-d67a-...",
  "transmission_sig": "<base64-signature>",
  "transmission_time": "2026-03-22T10:00:00Z",
  "webhook_id": "<PAYPAL_WEBHOOK_ID>",
  "webhook_event": { /* raw event body */ }
}

// Step 3: Check response
{ "verification_status": "SUCCESS" }  // Accept
{ "verification_status": "FAILURE" }  // Reject with 401`}
          </pre>
        </div>
        <p className="text-sm text-muted-foreground">Events handled: <code className="bg-muted px-1 rounded">PAYMENT.CAPTURE.COMPLETED</code>, <code className="bg-muted px-1 rounded">CHECKOUT.ORDER.APPROVED</code>, <code className="bg-muted px-1 rounded">PAYOUTS-ITEM.*</code></p>
      </CardContent>
    </Card>

    <Separator />

    {/* Deduplication */}
    <Card>
      <CardHeader><CardTitle>Deduplication &amp; Idempotency</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">All webhook events (inbound and outbound) are deduplicated:</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li><strong>Inbound</strong>: Stored in <code className="bg-muted px-1 rounded">webhook_inbox</code> keyed by <code className="bg-muted px-1 rounded">{'{provider}_{event_id}'}</code>. Duplicates return <code className="bg-muted px-1 rounded">200 already_processed</code>.</li>
          <li><strong>Outbound</strong>: Each delivery attempt is logged. Use <code className="bg-muted px-1 rounded">event_id</code> in your handler for idempotent processing.</li>
        </ul>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Your handler should be idempotent:
app.post('/webhooks/kob', (req, res) => {
  const eventId = req.body.event_id;
  
  // Check if already processed
  if (await db.webhookEvents.exists(eventId)) {
    return res.status(200).send('Already processed');
  }
  
  // Process and mark as handled
  await processEvent(req.body);
  await db.webhookEvents.insert({ event_id: eventId, processed_at: new Date() });
  res.status(200).send('OK');
});`}
        </pre>
      </CardContent>
    </Card>

    {/* Retry Policy */}
    <Card>
      <CardHeader><CardTitle>Retry Policy &amp; Dead Letters</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Failed deliveries (non-2xx or timeout after 30s) are retried with exponential backoff:</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Attempt</TableHead>
              <TableHead>Delay</TableHead>
              <TableHead>Cumulative</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { attempt: 1, delay: "1 min", cumulative: "1 min" },
              { attempt: 2, delay: "5 min", cumulative: "6 min" },
              { attempt: 3, delay: "30 min", cumulative: "36 min" },
              { attempt: 4, delay: "2 hrs", cumulative: "~2.5 hrs" },
              { attempt: 5, delay: "8 hrs", cumulative: "~10.5 hrs" },
              { attempt: 6, delay: "24 hrs", cumulative: "~34.5 hrs" },
              { attempt: 7, delay: "48 hrs", cumulative: "~82.5 hrs" },
            ].map(r => (
              <TableRow key={r.attempt}>
                <TableCell className="text-sm">{r.attempt}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.delay}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.cumulative}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">After 7 failures, the event enters the <strong>dead-letter queue</strong>. Failed events are retained for 30 days.</p>

        <div className="mt-4">
          <h4 className="font-semibold text-sm mb-2">Replay Failed Events via API</h4>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`# List dead-letter events
GET /v1/gateway/merchants/webhooks/{webhookId}/dead-letters?merchant_id=mch_uuid

# Replay a specific failed event
POST /v1/gateway/merchants/webhooks/{webhookId}/dead-letters/{eventId}/replay
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
{
  "merchant_id": "mch_uuid"
}

# Response
{
  "replayed": true,
  "event_id": "evt_abc123",
  "delivery_id": "del_new_uuid",
  "status": "pending"
}`}
          </pre>
        </div>
      </CardContent>
    </Card>

    {/* Secret Rotation */}
    <Card>
      <CardHeader><CardTitle>Webhook Secret Rotation</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Rotate your webhook secret without downtime:</p>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`# Rotate the secret
curl -X POST https://api.kangopenbanking.com/v1/gateway-webhooks-router (action: rotate_secret) \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "merchant_id": "mch_uuid" }'

# Response: { "webhook_id": "wh_uuid", "new_secret": "whsec_new_...", "warning": "Store securely" }`}
        </pre>
        <p className="text-xs text-muted-foreground">After rotation, update your verification code with the new secret. The old secret is immediately invalidated.</p>
      </CardContent>
    </Card>

    {/* Delivery Logs */}
    <Card>
      <CardHeader><CardTitle>Delivery Logs</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">View delivery history for any webhook endpoint:</p>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`GET /v1/gateway/merchants/webhooks/{webhookId}/deliveries?merchant_id=mch_uuid

// Response
{
  "data": [
    {
      "id": "del_uuid",
      "event_type": "charge.successful",
      "status": "delivered",
      "response_code": 200,
      "attempt_count": 1,
      "delivered_at": "2026-03-22T10:00:01Z"
    },
    {
      "id": "del_uuid2",
      "event_type": "payout.failed",
      "status": "failed",
      "response_code": 500,
      "attempt_count": 7,
      "error": "Connection refused"
    }
  ]
}`}
        </pre>
      </CardContent>
    </Card>

    {/* Best Practices */}
    <Card>
      <CardHeader><CardTitle>Best Practices</CardTitle></CardHeader>
      <CardContent>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li><strong>Always verify signatures</strong> — never trust payload content without cryptographic verification</li>
          <li><strong>Return 200 immediately</strong> — process events asynchronously via a queue to avoid timeouts</li>
          <li><strong>Deduplicate by event_id</strong> — your handler must be idempotent; the same event may be delivered more than once</li>
          <li><strong>Use HTTPS only</strong> — webhook URLs must use TLS; plain HTTP endpoints are rejected</li>
          <li><strong>Log raw payloads</strong> — store the full payload for debugging and reconciliation</li>
          <li><strong>Monitor delivery health</strong> — check the delivery logs dashboard for failed events</li>
          <li><strong>Rotate secrets periodically</strong> — use the rotate-secret endpoint every 90 days</li>
        </ul>
      </CardContent>
    </Card>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Upgrading to Webhooks v2</h3>
      <p className="text-sm text-muted-foreground">
        For multi-endpoint support, per-endpoint secrets, event filtering, and delivery logs, upgrade to <a href="/developer/gateway/webhooks-v2" className="text-primary underline font-semibold">Webhooks v2</a>. Both versions can run simultaneously during migration.
      </p>
    </div>

    <AutoDocNavigation />
  </div>
);

export default GatewayWebhooksGuide;
