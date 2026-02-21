import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GatewaySettlementsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Settlements API | Kang Open Banking" description="View settlement schedules, reports, and payout records." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Settlements API</h1>
      <p className="text-muted-foreground mt-2">Track how collected funds are settled to your merchant bank account or mobile wallet, including fee deductions.</p>
    </div>

    <Card>
      <CardHeader><CardTitle>Settlement Lifecycle</CardTitle></CardHeader>
      <CardContent>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Charges are collected and fees deducted</li>
          <li>Net amounts accumulate over the settlement period</li>
          <li>Settlement record created with period_start / period_end</li>
          <li>Payout initiated to merchant's account</li>
          <li>Status transitions: pending → processing → paid</li>
        </ol>
      </CardContent>
    </Card>

    <ApiEndpoint method="GET" endpoint="/v1/gateway/settlements?merchant_id={id}&limit=50&offset=0" description="List merchant settlements."
      response={JSON.stringify({ data: [{ id: "stl_uuid", merchant_id: "mch_uuid", amount: 450000, currency: "XAF", status: "paid", period_start: "2026-02-01", period_end: "2026-02-07", charges_count: 120, fees_total: 15750, net_amount: 434250, settled_at: "2026-02-08T08:00:00Z" }], total: 1 }, null, 2)}
    />
  </div>
);

export default GatewaySettlementsGuide;
