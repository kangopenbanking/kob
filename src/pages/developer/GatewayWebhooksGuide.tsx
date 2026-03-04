import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocNavigation } from "@/components/developer/DocNavigation";

const GatewayWebhooksGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Webhooks Guide | Kang Open Banking" description="Receive real-time event notifications with HMAC-SHA256 signed webhooks — event types, signature verification, and retry policy." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Webhooks Guide (v1)</h1>
      <p className="text-muted-foreground mt-2">The Gateway delivers HMAC-SHA256 signed webhook events to your configured endpoint for real-time notifications on all payment lifecycle events.</p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        When a payment event occurs (charge succeeds, payout completes, dispute opened), the gateway sends an HTTP POST to your registered webhook URL. The payload is signed with your webhook secret, allowing you to verify authenticity. If your endpoint doesn't respond with 2xx, the delivery is retried with exponential backoff.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Webhook Delivery Flow</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Event Occurs", "Payload Signed", "POST to Your URL", "Verify Signature", "Process Event", "Return 200 OK"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Upgrading to Webhooks v2</h3>
      <p className="text-sm text-muted-foreground">
        For multi-endpoint support, per-endpoint secrets, event filtering, and delivery logs, upgrade to <a href="/developer/gateway/webhooks-v2" className="text-primary underline font-semibold">Webhooks v2</a>. Both versions can run simultaneously during migration.
      </p>
    </div>

    {/* Event Types */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Event Types</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            ["charge.successful", "A charge completed successfully"],
            ["charge.failed", "A charge failed"],
            ["payout.completed", "A payout was disbursed"],
            ["payout.failed", "A payout failed"],
            ["refund.completed", "A refund was processed"],
            ["refund.failed", "A refund failed"],
            ["dispute.created", "A card dispute was opened"],
            ["dispute.won", "A dispute was resolved in your favor"],
            ["dispute.lost", "A dispute was lost"],
            ["settlement.paid", "A settlement was paid out"],
            ["paypal.payout.succeeded", "A PayPal payout was delivered"],
            ["paypal.payout.failed", "A PayPal payout failed"],
            ["paypal.payout.blocked", "A PayPal payout was blocked by risk"],
            ["paypal.payout.returned", "A PayPal payout was returned"],
          ].map(([event, desc]) => (
            <TableRow key={event}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{event}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{desc}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Payload Example */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Payload Format</h2>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`{
  "event_type": "charge.successful",
  "event_id": "evt_abc123",
  "created_at": "2026-03-01T10:00:00Z",
  "data": {
    "id": "chg_uuid",
    "amount": 5000,
    "currency": "XAF",
    "status": "successful",
    "channel": "mobile_money",
    "merchant_id": "mch_uuid",
    "tx_ref": "order_001"
  }
}`}
      </pre>
    </div>

    {/* Signature Verification */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Signature Verification</h2>
      <p className="text-sm text-muted-foreground mb-2">
        Every webhook includes <code className="bg-muted px-1 rounded">X-KOB-Signature</code> and <code className="bg-muted px-1 rounded">X-KOB-Timestamp</code> headers. Always verify the signature before processing.
      </p>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`const crypto = require('crypto');

function verifyWebhook(payload, signature, timestamp, secret) {
  const signed = \`\${timestamp}.\${JSON.stringify(payload)}\`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signed)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Express middleware
app.post('/webhooks', express.json(), (req, res) => {
  const sig = req.headers['x-kob-signature'];
  const ts = req.headers['x-kob-timestamp'];

  if (!verifyWebhook(req.body, sig, ts, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  switch (req.body.event_type) {
    case 'charge.successful':
      // Fulfill order
      break;
    case 'payout.failed':
      // Alert operations team
      break;
  }
  res.status(200).send('OK');
});`}
      </pre>
    </div>

    {/* Retry Policy */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Retry Policy</h2>
      <p className="text-sm text-muted-foreground mb-2">
        Failed deliveries (non-2xx response or timeout) are retried up to 7 times with exponential backoff:
      </p>
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
            { attempt: 1, delay: "2 min", cumulative: "2 min" },
            { attempt: 2, delay: "4 min", cumulative: "6 min" },
            { attempt: 3, delay: "8 min", cumulative: "14 min" },
            { attempt: 4, delay: "16 min", cumulative: "30 min" },
            { attempt: 5, delay: "32 min", cumulative: "62 min" },
            { attempt: 6, delay: "64 min", cumulative: "~2 hrs" },
            { attempt: 7, delay: "128 min", cumulative: "~4 hrs" },
          ].map(r => (
            <TableRow key={r.attempt}>
              <TableCell className="text-sm">{r.attempt}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.delay}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.cumulative}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">After 7 failures, the event is marked as <code className="bg-muted px-1 rounded">failed</code>. Events are never deleted — you can always retrieve them via the API.</p>
    </div>

    {/* Best Practices */}
    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Best Practices</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li><strong>Always verify signatures</strong> before processing webhook payloads</li>
        <li><strong>Return 200 quickly</strong> — process events asynchronously to avoid timeouts</li>
        <li><strong>Handle duplicates</strong> — use <code className="bg-muted px-1 rounded">event_id</code> for idempotent processing</li>
        <li><strong>Use HTTPS</strong> — webhook URLs must use TLS (plain HTTP is rejected)</li>
        <li><strong>Log everything</strong> — store raw payloads for debugging and reconciliation</li>
      </ul>
    </div>

    <DocNavigation
      previousPage={{ title: "Tokenization", path: "/developer/gateway/tokenization" }}
      nextPage={{ title: "Merchant Wallet", path: "/developer/gateway/merchant-wallet" }}
    />
  </div>
);

export default GatewayWebhooksGuide;
