import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

const TreasuryGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Treasury API | Kang Open Banking" description="Manage float balances and replenishment for institutional treasury operations." />
    <div>
      <Badge variant="outline" className="mb-2">Treasury</Badge>
      <h1 className="text-3xl font-bold">Treasury API</h1>
      <p className="text-muted-foreground mt-2">
        Manage institutional float balances used for processing payouts and instant transfers. 
        Monitor float levels and trigger replenishment when balances drop below thresholds.
      </p>
    </div>

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

    <ApiEndpoint method="POST" endpoint="/v1/treasury/replenish" description="Request a float replenishment from the settlement pool."
      parameters={[
        { name: "currency", type: "string", required: true, description: "Currency to replenish" },
        { name: "amount", type: "number", required: true, description: "Replenishment amount" },
        { name: "source", type: "string", required: true, description: "Funding source: settlement_pool, bank_transfer, manual" },
      ]}
      response={JSON.stringify({
        data: { replenishment_id: "rep_001", status: "pending", amount: 20000000, currency: "XAF", estimated_arrival: "2026-03-01T12:00:00Z" }
      }, null, 2)}
    />

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Float Monitoring</h3>
      <p className="text-sm text-muted-foreground">
        When float drops below the configured <code className="bg-muted px-1 rounded">low_threshold</code>, a <code className="bg-muted px-1 rounded">treasury.float.low</code> webhook event is dispatched. 
        Configure auto-replenishment rules to maintain adequate float levels for uninterrupted payout processing.
      </p>
    </div>

    <DocNavigation
      previousPage={{ title: "Instant Payouts", path: "/developer/gateway/instant-payouts" }}
      nextPage={{ title: "Webhooks v2", path: "/developer/gateway/webhooks-v2" }}
    />
  </div>
);

export default TreasuryGuide;
