import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const GatewaySettlementsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Settlements API | Kang Open Banking" description="Track settlement schedules, review fee deductions, and monitor payouts to your merchant bank account or mobile wallet." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Settlements API</h1>
      <p className="text-muted-foreground mt-2">Track how collected funds are settled to your merchant bank account or mobile wallet. Settlements aggregate charges over a period, deduct fees, and disburse the net amount automatically.</p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        Settlements are processed automatically at the end of each settlement window. The system aggregates all successful charges, deducts platform fees and any refunds, then initiates a payout to the merchant's configured bank account or mobile wallet.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Settlement Pipeline</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Charges Collected", "Fees Deducted", "Refunds Subtracted", "Settlement Created", "Payout Initiated", "Funds Received"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* Settlement Schedule */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Settlement Schedule</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead>Settlement Window</TableHead>
            <TableHead>Payout Speed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Card (Stripe)</TableCell>
            <TableCell className="text-sm text-muted-foreground">T+2 business days (rolling)</TableCell>
            <TableCell className="text-sm text-muted-foreground">1–2 days after settlement</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Mobile Money</TableCell>
            <TableCell className="text-sm text-muted-foreground">T+1 (next business day)</TableCell>
            <TableCell className="text-sm text-muted-foreground">Same day</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Bank Transfer</TableCell>
            <TableCell className="text-sm text-muted-foreground">T+2 business days</TableCell>
            <TableCell className="text-sm text-muted-foreground">1–2 days after settlement</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    {/* Status Lifecycle */}
    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-3">Status Lifecycle</h3>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">pending</span>
        <span>→</span>
        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">processing</span>
        <span>→</span>
        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">paid</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Settlements in <code className="bg-muted px-1 rounded">pending</code> are accumulating charges. <code className="bg-muted px-1 rounded">processing</code> means the payout is in transit. <code className="bg-muted px-1 rounded">paid</code> confirms funds have been delivered.</p>
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="GET" endpoint="/v1/gateway/settlements?merchant_id={id}&status={status}&limit=50&offset=0" description="List merchant settlements with optional status and date filters."
      response={JSON.stringify({ data: [{ id: "stl_uuid", merchant_id: "mch_uuid", amount: 450000, currency: "XAF", status: "paid", period_start: "2026-02-01", period_end: "2026-02-07", charges_count: 120, fees_total: 15750, refunds_total: 5000, net_amount: 429250, settled_at: "2026-02-08T08:00:00Z" }], total: 1, limit: 50, offset: 0 }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/settlements/{settlementId}" description="Retrieve a single settlement with full breakdown."
      response={JSON.stringify({ id: "stl_uuid", merchant_id: "mch_uuid", amount: 450000, currency: "XAF", status: "paid", period_start: "2026-02-01", period_end: "2026-02-07", charges_count: 120, fees_total: 15750, refunds_total: 5000, net_amount: 429250, payout_destination: { type: "bank_account", bank: "AFRILAND", account: "****7890" }, settled_at: "2026-02-08T08:00:00Z" }, null, 2)}
    />

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
            { event: "settlement.created", desc: "A new settlement period has been finalized" },
            { event: "settlement.processing", desc: "Payout initiated to merchant's account" },
            { event: "settlement.paid", desc: "Funds delivered to merchant" },
            { event: "settlement.failed", desc: "Settlement payout failed — will be retried" },
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
      <h3 className="font-semibold mb-2">Settlement Reconciliation</h3>
      <p className="text-sm text-muted-foreground">
        Each settlement includes a <code className="bg-muted px-1 rounded">charges_count</code>, <code className="bg-muted px-1 rounded">fees_total</code>, and <code className="bg-muted px-1 rounded">refunds_total</code> for full reconciliation. 
        Cross-reference with the <a href="/developer/gateway/charges" className="text-primary underline">Charges API</a> using the settlement period dates to get individual transaction details.
      </p>
    </div>

    <AutoDocNavigation />
  </div>
);

export default GatewaySettlementsGuide;
