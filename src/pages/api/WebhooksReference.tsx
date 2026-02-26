import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const webhookEvents = [
  { event: "charge.created", domain: "Charge", description: "New charge initiated" },
  { event: "charge.processing", domain: "Charge", description: "Charge is being processed" },
  { event: "charge.successful", domain: "Charge", description: "Charge completed successfully" },
  { event: "charge.failed", domain: "Charge", description: "Charge failed" },
  { event: "charge.cancelled", domain: "Charge", description: "Charge was cancelled" },
  { event: "charge.voided", domain: "Charge", description: "Charge was voided" },
  { event: "charge.captured", domain: "Charge", description: "Pre-authorized charge captured" },
  { event: "charge.refunded", domain: "Charge", description: "Charge was refunded" },
  { event: "charge.dispute.created", domain: "Dispute", description: "Dispute opened on charge" },
  { event: "charge.dispute.won", domain: "Dispute", description: "Dispute resolved in merchant's favour" },
  { event: "charge.dispute.lost", domain: "Dispute", description: "Dispute resolved against merchant" },
  { event: "charge.dispute.closed", domain: "Dispute", description: "Dispute case closed" },
  { event: "payout.created", domain: "Payout", description: "Payout initiated" },
  { event: "payout.completed", domain: "Payout", description: "Payout successful" },
  { event: "payout.failed", domain: "Payout", description: "Payout failed" },
  { event: "payout.reversed", domain: "Payout", description: "Payout was reversed" },
  { event: "refund.created", domain: "Refund", description: "Refund initiated" },
  { event: "refund.completed", domain: "Refund", description: "Refund processed" },
  { event: "refund.failed", domain: "Refund", description: "Refund failed" },
  { event: "settlement.created", domain: "Settlement", description: "Settlement batch created" },
  { event: "settlement.completed", domain: "Settlement", description: "Settlement paid out" },
  { event: "consent.authorized", domain: "Consent", description: "AISP consent granted" },
  { event: "consent.revoked", domain: "Consent", description: "AISP consent revoked" },
  { event: "account.updated", domain: "Account", description: "Account details changed" },
];

export default function WebhooksReference() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">API Reference</Badge>
        <h1 className="text-4xl font-bold mb-4">Webhooks Reference</h1>
        <p className="text-xl text-muted-foreground">Complete catalogue of 24 webhook event types with signature verification guide.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card><CardHeader><CardTitle>Webhook Payload Format</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4"><pre className="text-xs text-muted-foreground">{`{
  "event": "charge.successful",
  "data": { ... },
  "timestamp": "2026-02-26T10:30:00Z",
  "webhook_id": "wh_abc123"
}

Headers:
  X-Webhook-Signature: sha256=<HMAC-SHA256 of body>
  X-Webhook-ID: wh_abc123
  X-Webhook-Timestamp: 1740000000`}</pre></div>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Event Types ({webhookEvents.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Event</th><th className="text-left p-3 font-semibold">Domain</th><th className="text-left p-3 font-semibold">Description</th></tr></thead>
                <tbody className="text-muted-foreground">
                  {webhookEvents.map((e) => (
                    <tr key={e.event} className="border-b"><td className="p-3 font-mono text-xs">{e.event}</td><td className="p-3"><Badge variant="outline">{e.domain}</Badge></td><td className="p-3">{e.description}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Signature Verification</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4"><pre className="text-xs text-muted-foreground">{`// Node.js example
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from('sha256=' + expected)
  );
}`}</pre></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
