import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const IdempotencyGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Idempotency Guide | Kang Open Banking" description="Idempotency-Key header usage, collision behavior, and expiry for safe API retries." />
    <div>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Idempotency</h1>
      <p className="text-muted-foreground mt-2">
        The Kang API supports idempotent requests to safely retry operations without creating duplicate resources. 
        This is critical for payment operations where network failures can leave the outcome uncertain.
      </p>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">How It Works</h3>
      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
        <li>Include an <code className="bg-muted px-1 rounded">Idempotency-Key</code> header with a unique UUID in your POST request</li>
        <li>If the request is new, the API processes it and caches the response for 24 hours</li>
        <li>If the same key is reused with the same parameters, the cached response is returned (HTTP 200)</li>
        <li>If the same key is reused with different parameters, a <code className="bg-muted px-1 rounded">409 Conflict</code> error is returned</li>
      </ol>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Example Request</h3>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50000,
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237670000000"
  }'`}
      </pre>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Supported Endpoints</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li><code className="bg-muted px-1 rounded">POST /v1/gateway/charges</code> — Create charges</li>
        <li><code className="bg-muted px-1 rounded">POST /v1/gateway/payouts</code> — Create payouts</li>
        <li><code className="bg-muted px-1 rounded">POST /v1/gateway/refunds</code> — Issue refunds</li>
        <li><code className="bg-muted px-1 rounded">POST /v1/wallets/:id/credit</code> — Wallet credits</li>
        <li><code className="bg-muted px-1 rounded">POST /v1/wallets/:id/debit</code> — Wallet debits</li>
        <li><code className="bg-muted px-1 rounded">POST /v1/escrow</code> — Create escrow holds</li>
        <li><code className="bg-muted px-1 rounded">POST /v1/payouts/instant</code> — Instant payouts</li>
      </ul>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Key Rules</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Keys must be UUIDv4 format</li>
        <li>Keys expire after <strong>24 hours</strong></li>
        <li>Only POST endpoints support idempotency</li>
        <li>GET, PUT, DELETE are inherently idempotent and don't need the header</li>
        <li>Generate a new key for each logically distinct operation</li>
      </ul>
    </div>

    <AutoDocNavigation />
  </div>
);

export default IdempotencyGuide;
