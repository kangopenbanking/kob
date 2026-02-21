import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GatewayRefundsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Refunds API | Kang Open Banking" description="Refund card payments via Stripe or compensate MoMo charges with a payout." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Refunds API</h1>
      <p className="text-muted-foreground mt-2">Refund successful charges. Card charges are refunded via Stripe. MoMo charges are compensated via a payout to the customer.</p>
    </div>

    <Card>
      <CardHeader><CardTitle>Refund Behavior by Channel</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <p><strong>Card (Stripe):</strong> Standard Stripe refund to original payment method.</p>
        <p><strong>Mobile Money (Flutterwave):</strong> Compensation payout to the customer's phone number since MoMo providers don't support reversals.</p>
      </CardContent>
    </Card>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/refunds" description="Create a refund for a successful charge."
      requestBody={JSON.stringify({ charge_id: "chg_uuid", amount: 5000, reason: "Customer request" }, null, 2)}
      response={JSON.stringify({ id: "ref_uuid", charge_id: "chg_uuid", amount: 5000, currency: "XAF", status: "processing", provider: "stripe", reason: "Customer request" }, null, 2)}
      parameters={[
        { name: "charge_id", type: "uuid", required: true, description: "The charge to refund" },
        { name: "amount", type: "number", required: false, description: "Partial refund amount (defaults to full charge)" },
        { name: "reason", type: "string", required: false, description: "Reason for refund" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/refunds?id={refundId}" description="Retrieve a refund by ID." />
    <ApiEndpoint method="GET" endpoint="/v1/gateway/refunds?limit=50&offset=0" description="List refunds." />
  </div>
);

export default GatewayRefundsGuide;
