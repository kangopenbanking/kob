import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

const TreasuryGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Treasury API | Kang Open Banking" description="Manage prefunded float balances that power instant payouts via Visa Direct, Mastercard Send, and mobile money. Monitor utilization, trigger replenishment, and configure auto-replenishment rules." />
    <div>
      <Badge variant="outline" className="mb-2">Treasury</Badge>
      <h1 className="text-3xl font-bold">Treasury API</h1>
      <p className="text-muted-foreground mt-2">
        Manage the prefunded float pools that power instant payouts. The Treasury API provides real-time visibility into float balances, per-rail utilization, and replenishment — ensuring your platform can process instant payouts 24/7 without interruption.
      </p>
    </div>

    {/* Why Treasury Matters */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Why Treasury Matters</h2>
      <p className="text-sm text-muted-foreground">
        Instant payout rails (Visa Direct, Mastercard Send, MoMo) cannot wait for real-time bank transfers to fund each transaction. Instead, they debit from a <strong>pre-loaded float pool</strong> managed by the Treasury API. When a payout is submitted with <code className="bg-muted px-1 rounded">speed: "instant"</code>, the Instant Rail Router verifies sufficient float before dispatching to the provider.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Prefunding Model</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Load Float", "Instant Payout Submitted", "Float Debited", "Provider Dispatches", "Settlement Replenishes Float"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          If float is insufficient and the payout uses <code className="bg-muted px-1 rounded">speed: "auto"</code>, it automatically falls back to standard bank transfer rails. 
          With <code className="bg-muted px-1 rounded">speed: "instant"</code>, the payout fails with error <code className="bg-muted px-1 rounded">GW_006</code>.
        </p>
      </div>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>Connection to Instant Payouts</strong> — Treasury float is what powers the <a href="/developer/gateway/instant-payouts" className="text-primary underline">Instant Payouts API</a>. 
        Without adequate float, instant rails are unavailable. Monitor your float levels and configure auto-replenishment to ensure continuous payout availability.
      </AlertDescription>
    </Alert>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="GET" endpoint="/v1/treasury/balance" description="Retrieve current treasury float balance by currency."
      parameters={[
        { name: "currency", type: "string", required: false, description: "Filter by currency (omit for all)" },
      ]}
      response={JSON.stringify({
        data: [
          { currency: "XAF", available: 50000000, reserved: 5000000, total: 55000000, low_threshold: 10000000, status: "healthy" },
          { currency: "USD", available: 25000, reserved: 2000, total: 27000, low_threshold: 5000, status: "healthy" },
        ]
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/treasury/utilization" description="Get per-rail float utilization statistics for the last 24 hours."
      parameters={[
        { name: "currency", type: "string", required: false, description: "Filter by currency" },
      ]}
      response={JSON.stringify({
        data: [
          { rail: "mobile_money", currency: "XAF", total_disbursed_24h: 12500000, transactions_24h: 342, avg_payout_size: 36550, float_utilization_pct: 25.0 },
          { rail: "visa_direct", currency: "USD", total_disbursed_24h: 8500, transactions_24h: 28, avg_payout_size: 303, float_utilization_pct: 34.0 },
          { rail: "mc_send", currency: "EUR", total_disbursed_24h: 3200, transactions_24h: 12, avg_payout_size: 266, float_utilization_pct: 18.0 },
        ]
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/treasury/replenish" description="Request a float replenishment from the settlement pool, bank transfer, or manual deposit."
      parameters={[
        { name: "currency", type: "string", required: true, description: "Currency to replenish" },
        { name: "amount", type: "number", required: true, description: "Replenishment amount" },
        { name: "source", type: "string", required: true, description: "Funding source: settlement_pool, bank_transfer, manual" },
      ]}
      response={JSON.stringify({
        data: { replenishment_id: "rep_001", status: "pending", amount: 20000000, currency: "XAF", source: "settlement_pool", estimated_arrival: "2026-03-01T12:00:00Z" }
      }, null, 2)}
    />

    {/* Auto-Replenishment */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Auto-Replenishment</h2>
      <p className="text-sm text-muted-foreground">
        Configure a <code className="bg-muted px-1 rounded">low_threshold</code> per currency. When float drops below this level, the system dispatches a <code className="bg-muted px-1 rounded">treasury.float.low</code> webhook event. 
        If auto-replenishment is enabled, the system automatically initiates a replenishment from the settlement pool to restore float to the target level.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-2">Threshold Example</h3>
        <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">
{`{
  "currency": "XAF",
  "low_threshold": 10000000,
  "target_level": 50000000,
  "auto_replenish": true,
  "source": "settlement_pool"
}`}
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          When XAF float drops below 10,000,000, the system auto-replenishes to 50,000,000 from the settlement pool.
        </p>
      </div>
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
            { event: "treasury.float.low", desc: "Float has dropped below the configured low_threshold for a currency" },
            { event: "treasury.replenishment.initiated", desc: "A replenishment request has been submitted" },
            { event: "treasury.replenishment.completed", desc: "Float has been successfully replenished" },
            { event: "treasury.replenishment.failed", desc: "Replenishment failed — manual intervention may be required" },
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
      <h3 className="font-semibold mb-2">Float Monitoring Best Practices</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Set <code className="bg-muted px-1 rounded">low_threshold</code> to cover at least 4 hours of peak payout volume</li>
        <li>Enable the <code className="bg-muted px-1 rounded">treasury.float.low</code> webhook and route it to your operations team</li>
        <li>Use the <code className="bg-muted px-1 rounded">/v1/treasury/utilization</code> endpoint to forecast replenishment needs</li>
        <li>Consider enabling auto-replenishment from the settlement pool for uninterrupted 24/7 payouts</li>
      </ul>
    </div>

    <DocNavigation
      previousPage={{ title: "Instant Payouts", path: "/developer/gateway/instant-payouts" }}
      nextPage={{ title: "Webhooks v2", path: "/developer/gateway/webhooks-v2" }}
    />
  </div>
);

export default TreasuryGuide;
