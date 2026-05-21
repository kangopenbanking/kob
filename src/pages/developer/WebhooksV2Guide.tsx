import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Info } from "lucide-react";

const WebhooksV2Guide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO
      title="Webhooks v2 API"
      description="Multi-endpoint webhook management with per-endpoint signing secrets, event filtering, delivery logs, retry policies, and secret rotation."
      canonical="https://kangopenbanking.com/developer/gateway/webhooks-v2"
      keywords="webhooks v2, hmac sha256, idempotent delivery, retry, signing secret rotation"
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Developer", url: "/developer" },
        { name: "Gateway", url: "/developer/gateway" },
        { name: "Webhooks v2", url: "/developer/gateway/webhooks-v2" },
      ]}
    />
    <div>
      <Badge variant="outline" className="mb-2">Webhooks</Badge>
      <h1 className="text-3xl font-bold">Webhooks v2 — Multi-Endpoint Management</h1>
      <p className="text-muted-foreground mt-2">
        Register multiple webhook endpoints per merchant, each with its own signing secret and event filter. 
        Inspect delivery logs, retry failed deliveries, and rotate secrets without downtime.
      </p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        Webhooks v2 replaces the single-endpoint model with a multi-endpoint architecture. Each endpoint has its own signing secret, event subscriptions, and delivery log. When an event occurs, the system delivers it to all matching endpoints in parallel. Failed deliveries are retried with exponential backoff.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Delivery Pipeline</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Event Occurs", "Match Endpoints", "Sign Payload", "Deliver (parallel)", "Log Response", "Retry on Failure"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* Key Features */}
    <div className="grid sm:grid-cols-2 gap-3">
      {[
        { title: "Multiple Endpoints", desc: "Register up to 10 endpoints per merchant. Route different events to different services." },
        { title: "Per-Endpoint Secrets", desc: "Each endpoint gets a unique whsec_* signing key. Rotate independently." },
        { title: "Event Filtering", desc: "Subscribe to specific events or use wildcards (e.g. payout.*). No noise from irrelevant events." },
        { title: "Delivery Logs", desc: "Full request/response logging for debugging. See HTTP status, response body, and timing." },
        { title: "7-Attempt Retry", desc: "Exponential backoff: 2, 4, 8, 16, 32, 64, 128 minutes. Auto-disable after 7 failures." },
        { title: "Secret Rotation", desc: "Rotate signing secrets with zero downtime. Both old and new secrets are valid during rotation." },
      ].map(f => (
        <div key={f.title} className="border rounded-lg p-3">
          <h4 className="font-medium text-sm">{f.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
        </div>
      ))}
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="POST" endpoint="/v1/webhooks/v2/endpoints" description="Register a new webhook endpoint with event subscriptions."
      parameters={[
        { name: "url", type: "string", required: true, description: "HTTPS endpoint URL" },
        { name: "events", type: "string[]", required: true, description: "Event types to subscribe to (supports wildcards)" },
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

    <ApiEndpoint method="PATCH" endpoint="/v1/webhooks/v2/endpoints/:endpoint_id" description="Update an endpoint's URL, events, or status."
      parameters={[
        { name: "url", type: "string", required: false, description: "New HTTPS endpoint URL" },
        { name: "events", type: "string[]", required: false, description: "Updated event subscriptions" },
        { name: "status", type: "string", required: false, description: "active or disabled" },
      ]}
      response={JSON.stringify({
        data: { id: "we_001", url: "https://example.com/v2/webhooks", events: ["charge.*", "payout.*"], status: "active" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/webhooks/v2/endpoints/:endpoint_id/rotate-secret" description="Rotate the signing secret. Old secret remains valid for 24 hours."
      response={JSON.stringify({
        data: { id: "we_001", new_secret: "whsec_new456...", old_secret_valid_until: "2026-03-02T10:00:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/webhooks/v2/endpoints/:endpoint_id/deliveries" description="List delivery attempts for an endpoint. Includes HTTP status, response, and timing."
      parameters={[
        { name: "limit", type: "number", required: false, description: "Results per page (default 25)" },
        { name: "status", type: "string", required: false, description: "Filter: successful, failed, pending" },
      ]}
      response={JSON.stringify({
        data: [
          { id: "del_001", event_type: "charge.completed", status: "successful", http_status: 200, response_time_ms: 145, attempted_at: "2026-03-01T10:01:00Z" },
          { id: "del_002", event_type: "payout.completed", status: "failed", http_status: 500, retry_count: 2, next_retry_at: "2026-03-01T10:09:00Z" },
        ]
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/webhooks/v2/endpoints/:endpoint_id/deliveries/:delivery_id/retry" description="Manually retry a failed delivery."
      response={JSON.stringify({
        data: { id: "del_002", status: "pending", retry_count: 3, attempted_at: "2026-03-01T10:10:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="DELETE" endpoint="/v1/webhooks/v2/endpoints/:endpoint_id" description="Delete a webhook endpoint."
      response={JSON.stringify({ data: { deleted: true } }, null, 2)}
    />

    {/* Signature Verification */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Signature Verification</h2>
      <p className="text-sm text-muted-foreground">
        Every webhook delivery includes an <code className="bg-muted px-1 rounded">X-Kang-Signature</code> header. Verify it to ensure the payload hasn't been tampered with.
      </p>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
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
}

// Express middleware example
app.post('/webhooks', (req, res) => {
  const signature = req.headers['x-kang-signature'];
  if (!verifyWebhook(JSON.stringify(req.body), signature, 'whsec_...')) {
    return res.status(401).send('Invalid signature');
  }
  // Process event
  const { event_type, data } = req.body;
  console.log(\`Received: \${event_type}\`, data);
  res.status(200).send('OK');
});`}
      </pre>
    </div>

    {/* Available Event Types */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Available Event Types</h2>
      <p className="text-sm text-muted-foreground mb-2">
        Use wildcards to subscribe to all events in a category (e.g. <code className="bg-muted px-1 rounded">payout.*</code>).
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Events</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { cat: "Charges", events: "charge.successful, charge.failed, charge.authorized, charge.captured, charge.voided, charge.refunded" },
            { cat: "Payouts", events: "payout.processing, payout.completed, payout.failed, payout.reversed, payout.cancelled" },
            { cat: "Subscriptions", events: "subscription.created, subscription.cancelled, subscription.charge.successful, subscription.charge.failed" },
            { cat: "Disputes", events: "dispute.opened, dispute.won, dispute.lost, dispute.closed" },
            { cat: "Wallets", events: "wallet.created, wallet.credited, wallet.debited, wallet.frozen, wallet.unfrozen" },
            { cat: "Escrow", events: "escrow.created, escrow.funded, escrow.released, escrow.refunded, escrow.frozen, escrow.expired" },
            { cat: "Settlements", events: "settlement.created, settlement.processing, settlement.paid, settlement.failed" },
            { cat: "Treasury", events: "treasury.float.low, treasury.replenishment.completed, treasury.replenishment.failed" },
            { cat: "Compliance", events: "compliance.screening.passed, compliance.screening.flagged, compliance.screening.blocked" },
          ].map(c => (
            <TableRow key={c.cat}>
              <TableCell className="font-medium text-sm">{c.cat}</TableCell>
              <TableCell className="text-xs text-muted-foreground font-mono">{c.events}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>Migration from v1</strong> — Webhooks v1 (single endpoint) continues to work. v2 endpoints receive events independently. You can run both simultaneously during migration. See the <a href="/developer/gateway/webhooks" className="text-primary underline">Webhooks v1 Guide</a> for the legacy format.
      </AlertDescription>
    </Alert>

    <AutoDocNavigation />
  </div>
);

export default WebhooksV2Guide;
