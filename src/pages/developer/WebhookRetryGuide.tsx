import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const WebhookRetryGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Webhook Delivery & Retry Policy | Kang Open Banking" description="Webhook delivery attempts, exponential backoff schedule, timeout handling, and dead-letter replay for Kang Open Banking." />
    <div>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Webhook Delivery &amp; Retry Policy</h1>
      <p className="text-muted-foreground mt-2">
        The Kang API delivers webhook events with automatic retries and exponential backoff.
        This page documents the delivery lifecycle, retry schedule, and dead-letter handling.
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">Parameter</th>
            <th className="text-left py-2 font-semibold">Value</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          <tr className="border-b"><td className="py-2">Maximum delivery attempts</td><td>7</td></tr>
          <tr className="border-b"><td className="py-2">Timeout per attempt</td><td>10 seconds</td></tr>
          <tr className="border-b"><td className="py-2">Expected response</td><td>HTTP 200 within 5 seconds</td></tr>
          <tr className="border-b"><td className="py-2">Signature algorithm</td><td>HMAC-SHA256</td></tr>
          <tr className="border-b"><td className="py-2">Signature header</td><td><code className="bg-muted px-1 rounded">X-KOB-Signature</code></td></tr>
          <tr className="border-b"><td className="py-2">Dead-letter retention</td><td>30 days</td></tr>
          <tr><td className="py-2">Manual replay</td><td>Available via API</td></tr>
        </tbody>
      </table>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Retry Schedule (Exponential Backoff)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-semibold">Attempt</th>
              <th className="text-left py-2 font-semibold">Delay After Failure</th>
              <th className="text-left py-2 font-semibold">Cumulative Time</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b"><td className="py-2">1 (initial)</td><td>Immediate</td><td>0</td></tr>
            <tr className="border-b"><td className="py-2">2</td><td>1 minute</td><td>~1 minute</td></tr>
            <tr className="border-b"><td className="py-2">3</td><td>5 minutes</td><td>~6 minutes</td></tr>
            <tr className="border-b"><td className="py-2">4</td><td>30 minutes</td><td>~36 minutes</td></tr>
            <tr className="border-b"><td className="py-2">5</td><td>2 hours</td><td>~2.5 hours</td></tr>
            <tr className="border-b"><td className="py-2">6</td><td>8 hours</td><td>~10.5 hours</td></tr>
            <tr><td className="py-2">7 (final)</td><td>24 hours</td><td>~34.5 hours</td></tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        After all 7 attempts fail, the event is moved to the dead-letter queue and retained for 30 days.
      </p>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Delivery Headers</h3>
      <p className="text-sm text-muted-foreground mb-2">Every webhook delivery includes these headers:</p>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`X-KOB-Signature: sha256=a1b2c3d4e5f6...
X-KOB-Timestamp: 1711108800
X-KOB-Event-Type: charge.completed
X-KOB-Event-ID: evt_abc123def456
X-KOB-Delivery-Attempt: 1
Content-Type: application/json`}
      </pre>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Signature Verification</h3>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`// Node.js — Verify webhook signature
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const received = signature.replace('sha256=', '');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(received, 'hex')
  );
}

// In your webhook handler:
app.post('/webhooks/kob', (req, res) => {
  const sig = req.headers['x-kob-signature'];
  if (!verifyWebhookSignature(req.rawBody, sig, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process event idempotently (use X-KOB-Event-ID for dedup)
  const eventId = req.headers['x-kob-event-id'];
  if (alreadyProcessed(eventId)) {
    return res.status(200).send('Already processed');
  }
  
  handleEvent(req.body);
  res.status(200).send('OK'); // Respond within 5 seconds
});`}
      </pre>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Dead-Letter Replay</h3>
      <p className="text-sm text-muted-foreground mb-2">
        Failed events can be replayed via the Webhooks v2 API:
      </p>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`POST /v1/webhooks/v2/endpoints/{endpointId}/replay
Authorization: Bearer sk_live_...
Content-Type: application/json

{
  "event_ids": ["evt_abc123", "evt_def456"],
  "replay_all_failed": false
}`}
      </pre>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Best Practices</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Always respond with HTTP 200 within 5 seconds -- defer heavy processing to a background queue</li>
        <li>Deduplicate events by <code className="bg-muted px-1 rounded">X-KOB-Event-ID</code> to handle retries safely</li>
        <li>Verify signatures on every delivery before processing</li>
        <li>Monitor your dead-letter queue and set up alerts for accumulating failures</li>
        <li>Use the <code className="bg-muted px-1 rounded">X-KOB-Delivery-Attempt</code> header to track retry progression in your logs</li>
      </ul>
    </div>

    <AutoDocNavigation />
  </div>
);

export default WebhookRetryGuide;
