import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GatewayWebhooksGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Webhooks Guide | Kang Open Banking" description="Receive real-time event notifications with HMAC-SHA256 signed webhooks." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Webhooks Guide</h1>
      <p className="text-muted-foreground mt-2">The Gateway delivers signed webhook events to your configured endpoint for real-time notifications.</p>
    </div>

    <Card>
      <CardHeader><CardTitle>Event Types</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2">Event</th><th className="text-left py-2">Description</th></tr></thead>
            <tbody>
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
                <tr key={event} className="border-b"><td className="py-2 font-mono text-xs">{event}</td><td className="text-muted-foreground">{desc}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Signature Verification</CardTitle></CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-3">Every webhook includes <code>X-KOB-Signature</code> and <code>X-KOB-Timestamp</code> headers. Verify using HMAC-SHA256:</p>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm"><code>{`const crypto = require('crypto');

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
}`}</code></pre>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Retry Policy</CardTitle></CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Failed deliveries are retried up to 7 times with exponential backoff (2, 4, 8, 16, 32, 64, 128 minutes). After 7 failures the event is marked as <code>failed</code>.</p>
      </CardContent>
    </Card>
  </div>
);

export default GatewayWebhooksGuide;
