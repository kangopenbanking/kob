import { CodeBlock } from "@/components/developer/CodeBlock";
import { MermaidDiagram } from "@/components/developer/MermaidDiagram";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const webhookFlow = `sequenceDiagram
    participant Provider as Pay-in Provider
    participant KOB as KOB Platform
    participant Client as Your Webhook URL

    Provider->>KOB: Inbound webhook (Stripe/PayPal/FLW)
    KOB->>KOB: Verify signature + dedupe
    KOB->>KOB: Update transfer status
    KOB->>Client: POST remittance.payin.succeeded
    Note over KOB,Client: HMAC-SHA256 signed
    Client-->>KOB: 200 OK
    KOB->>KOB: Mark delivery as "sent"`;

export default function RemittanceWebhooks() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-3">
        <Badge variant="outline" className="text-xs font-mono">remittance-client-webhooks</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Webhooks</h1>
        <p className="text-lg text-muted-foreground">
          Receive real-time notifications for remittance lifecycle events. Register endpoints,
          verify signatures, and monitor delivery logs.
        </p>
      </div>

      <MermaidDiagram chart={webhookFlow} />

      {/* Event Types */}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Event Types</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium">Event</th>
                <th className="text-left py-3 px-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[
                ["remittance.transfer.created", "New transfer initiated"],
                ["remittance.payin.succeeded", "Pay-in confirmed by provider"],
                ["remittance.payin.failed", "Pay-in failed or rejected"],
                ["remittance.payout.succeeded", "Funds delivered to recipient"],
                ["remittance.payout.failed", "Payout failed"],
                ["remittance.transfer.completed", "Full lifecycle complete"],
                ["remittance.transfer.cancelled", "Transfer cancelled"],
                ["remittance.transfer.refunded", "Transfer refunded to sender"],
              ].map(([event, desc]) => (
                <tr key={event}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{event}</td>
                  <td className="py-2 px-2 text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Register Endpoint</h2>
        <CodeBlock
          title="POST register"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-client-webhooks \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "register",
    "client_id": "your_client_id",
    "url": "https://your-server.com/webhooks/remittance",
    "events": [
      "remittance.transfer.created",
      "remittance.payin.succeeded",
      "remittance.payout.succeeded",
      "remittance.transfer.completed"
    ]
  }'`
          }]}
        />
        <CodeBlock
          title="Response (201)"
          examples={[{
            language: "json",
            code: JSON.stringify({
              endpoint_id: "ep_xxx",
              url: "https://your-server.com/webhooks/remittance",
              events: ["remittance.transfer.created", "remittance.payin.succeeded", "remittance.payout.succeeded", "remittance.transfer.completed"],
              secret: "whsec_a1b2c3d4e5f6...",
              secret_last_four: "f6...",
              is_active: true,
              message: "Save this secret — it will not be shown again.",
            }, null, 2),
          }]}
        />
      </div>

      {/* Signature Verification */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Verify Signatures</h2>
        <p className="text-muted-foreground">
          Every webhook includes an <code className="text-xs bg-muted px-1 py-0.5 rounded">x-webhook-signature</code> header
          containing an HMAC-SHA256 signature.
        </p>
        <CodeBlock
          title="Node.js Verification"
          examples={[
            {
              language: "javascript",
              label: "Node.js",
              code: `const crypto = require('crypto');

function verifyRemittanceWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`,
            },
            {
              language: "python",
              label: "Python",
              code: `import hmac, hashlib, json

def verify_remittance_webhook(payload: dict, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)`,
            },
          ]}
        />
      </div>

      {/* Rotate Secret */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Rotate Secret</h2>
        <CodeBlock
          title="POST rotate_secret"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-client-webhooks \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "rotate_secret",
    "endpoint_id": "ep_xxx"
  }'`
          }]}
        />
      </div>

      {/* Delivery Logs */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Delivery Logs</h2>
        <CodeBlock
          title="GET list_deliveries"
          examples={[{
            language: "bash",
            code: `curl "https://api.kangopenbanking.com/v1/remittance-client-webhooks?action=list_deliveries&endpoint_id=ep_xxx" \\
  -H "Content-Type: application/json"`
          }]}
        />
      </div>

      {/* Webhook Payload */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Sample Payload</h2>
        <CodeBlock
          title="Webhook Payload"
          examples={[{
            language: "json",
            code: JSON.stringify({
              event: "remittance.payout.succeeded",
              data: {
                transfer_id: "rem_xxx",
                status: "credited",
                send_amount: 100,
                send_currency: "EUR",
                receive_amount: 63250,
                receive_currency: "XAF",
                payout_method: "momo_mtn",
                recipient_phone: "+237670****00",
              },
              remittance_id: "rem_xxx",
              created_at: "2026-03-25T19:15:00Z",
            }, null, 2),
          }]}
        />
      </div>

      {/* Retry Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retry Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Failed deliveries are retried with exponential backoff:
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b"><th className="text-left py-1">Attempt</th><th className="text-left py-1">Delay</th></tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr><td className="py-1">1</td><td>Immediate</td></tr>
              <tr><td className="py-1">2</td><td>30 seconds</td></tr>
              <tr><td className="py-1">3</td><td>2 minutes</td></tr>
              <tr><td className="py-1">4</td><td>10 minutes</td></tr>
              <tr><td className="py-1">5</td><td>1 hour</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
