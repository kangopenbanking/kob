import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

const WebhooksV2Guide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Webhooks v2 API | Kang Open Banking" description="Multi-endpoint webhook management with per-endpoint secrets, event filtering, and delivery logs." />
    <div>
      <Badge variant="outline" className="mb-2">Webhooks</Badge>
      <h1 className="text-3xl font-bold">Webhooks v2 — Multi-Endpoint Management</h1>
      <p className="text-muted-foreground mt-2">
        Register multiple webhook endpoints per merchant, each with its own signing secret and event filter. 
        Inspect delivery logs, retry failed deliveries, and rotate secrets without downtime.
      </p>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Key Improvements over v1</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li><strong>Multiple endpoints</strong> — Register up to 10 endpoints per merchant</li>
        <li><strong>Per-endpoint secrets</strong> — Each endpoint gets a unique <code className="bg-muted px-1 rounded">whsec_*</code> signing key</li>
        <li><strong>Event filtering</strong> — Subscribe to specific event types per endpoint</li>
        <li><strong>Delivery logs</strong> — Full request/response logging for debugging</li>
        <li><strong>7-attempt retry</strong> — Exponential backoff with configurable retry policy</li>
      </ul>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/webhooks/v2/endpoints" description="Register a new webhook endpoint."
      parameters={[
        { name: "url", type: "string", required: true, description: "HTTPS endpoint URL" },
        { name: "events", type: "string[]", required: true, description: "Event types to subscribe to" },
        { name: "description", type: "string", required: false, description: "Human-readable label" },
      ]}
      response={JSON.stringify({
        data: { id: "we_001", url: "https://example.com/webhooks", secret: "whsec_abc123...", events: ["charge.completed", "payout.completed"], status: "active", created_at: "2026-03-01T10:00:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/webhooks/v2/endpoints" description="List all registered webhook endpoints."
      response={JSON.stringify({
        data: [
          { id: "we_001", url: "https://example.com/webhooks", events: ["charge.completed"], status: "active" },
          { id: "we_002", url: "https://example.com/payouts", events: ["payout.*"], status: "active" },
        ]
      }, null, 2)}
    />

    <ApiEndpoint method="DELETE" endpoint="/v1/webhooks/v2/endpoints/:endpoint_id" description="Delete a webhook endpoint."
      response={JSON.stringify({ data: { deleted: true } }, null, 2)}
    />

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Signature Verification</h3>
      <p className="text-sm text-muted-foreground mb-2">
        Every webhook delivery includes an <code className="bg-muted px-1 rounded">X-Kang-Signature</code> header containing the HMAC-SHA256 signature of the request body using the endpoint's secret.
      </p>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}
      </pre>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Available Event Types</h3>
      <div className="grid grid-cols-2 gap-2 text-sm font-mono text-muted-foreground">
        {[
          "charge.completed", "charge.failed", "charge.refunded",
          "payout.completed", "payout.failed", "payout.reversed",
          "subscription.created", "subscription.cancelled",
          "dispute.opened", "dispute.resolved",
          "wallet.credited", "wallet.debited",
          "escrow.funded", "escrow.released",
          "treasury.float.low",
        ].map(e => <span key={e}>{e}</span>)}
      </div>
    </div>

    <DocNavigation
      previousPage={{ title: "Treasury", path: "/developer/gateway/treasury" }}
      nextPage={{ title: "SLA Monitoring", path: "/developer/gateway/sla" }}
    />
  </div>
);

export default WebhooksV2Guide;
