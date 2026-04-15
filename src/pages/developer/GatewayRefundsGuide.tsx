import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Info } from "lucide-react";

const GatewayRefundsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Refunds API | Kang Open Banking" description="Refund card payments via Stripe or compensate MoMo charges with an automated payout. Full and partial refunds with webhook lifecycle." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Refunds API</h1>
      <p className="text-muted-foreground mt-2">Refund successful charges — full or partial. Card charges are refunded via Stripe. Mobile Money charges are compensated via an automated payout to the customer's phone number.</p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        The refund engine detects the original charge's payment channel and routes the refund to the correct provider automatically. Card refunds go back to the original card via Stripe. MoMo refunds create a compensation payout since mobile money providers don't support transaction reversals.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Refund by Channel</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Mechanism</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead>Partial Supported</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Card (Stripe)</TableCell>
              <TableCell className="text-sm text-muted-foreground">Standard Stripe refund to original card</TableCell>
              <TableCell className="text-sm text-muted-foreground">5–10 business days</TableCell>
              <TableCell className="text-sm text-muted-foreground">Yes</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Mobile Money</TableCell>
              <TableCell className="text-sm text-muted-foreground">Compensation payout to customer phone</TableCell>
              <TableCell className="text-sm text-muted-foreground">Instant (MoMo)</TableCell>
              <TableCell className="text-sm text-muted-foreground">Yes</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Bank Transfer</TableCell>
              <TableCell className="text-sm text-muted-foreground">Reverse payout to originating account</TableCell>
              <TableCell className="text-sm text-muted-foreground">1–2 business days</TableCell>
              <TableCell className="text-sm text-muted-foreground">Yes</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>MoMo Compensation</strong> — Since MoMo providers don't support native reversals, refunds for mobile money charges are processed as automated payouts to the customer's phone number. The refund record tracks both the original charge and the compensation payout.
      </AlertDescription>
    </Alert>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/refunds" description="Create a refund for a successful charge. Supports full and partial refunds."
      requestBody={JSON.stringify({ charge_id: "chg_uuid", amount: 5000, reason: "Customer request" }, null, 2)}
      response={JSON.stringify({ id: "ref_uuid", charge_id: "chg_uuid", amount: 5000, currency: "XAF", status: "processing", provider: "stripe", reason: "Customer request", created_at: "2026-02-22T10:00:00Z" }, null, 2)}
      parameters={[
        { name: "charge_id", type: "uuid", required: true, description: "The charge to refund" },
        { name: "amount", type: "number", required: false, description: "Partial refund amount (defaults to full charge amount)" },
        { name: "reason", type: "string", required: false, description: "Reason for refund" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/refunds?id={refundId}" description="Retrieve a refund by ID."
      response={JSON.stringify({ id: "ref_uuid", charge_id: "chg_uuid", amount: 5000, currency: "XAF", status: "completed", provider: "stripe", reason: "Customer request", completed_at: "2026-02-22T10:05:00Z" }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/refunds?merchant_id={id}&status={status}&limit=50&offset=0" description="List refunds with filters."
      response={JSON.stringify({ data: [], total: 0, limit: 50, offset: 0 }, null, 2)}
    />

    {/* Code Example */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Code Example</h2>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-refund \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: refund_order_001" \\
  -d '{
    "charge_id": "chg_uuid",
    "amount": 2500,
    "reason": "Partial refund - item returned"
  }'`}
      </pre>
    </div>

    {/* Webhook Events */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Webhook Events</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { event: "refund.processing", desc: "Refund has been initiated with the provider" },
            { event: "refund.completed", desc: "Refund was successfully processed" },
            { event: "refund.failed", desc: "Refund failed — merchant balance restored" },
          ].map(e => (
            <TableRow key={e.event}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.event}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Refund Limits</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Total refunds cannot exceed the original charge amount</li>
        <li>Multiple partial refunds allowed until the original amount is fully refunded</li>
        <li>Refunds must be initiated within 180 days of the original charge</li>
        <li>Card refunds: Original transaction fees are <strong>not</strong> returned by Stripe</li>
      </ul>
    </div>

    <AutoDocNavigation />
  </div>
);

export default GatewayRefundsGuide;
