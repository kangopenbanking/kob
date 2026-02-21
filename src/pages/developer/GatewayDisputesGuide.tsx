import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GatewayDisputesGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Disputes API | Kang Open Banking" description="Manage card payment disputes and submit evidence." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Disputes API</h1>
      <p className="text-muted-foreground mt-2">Handle card chargebacks from Stripe. Disputes are automatically created when Stripe sends dispute webhook events.</p>
    </div>

    <Card>
      <CardHeader><CardTitle>Dispute Statuses</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">open</Badge>
          <Badge variant="secondary">under_review</Badge>
          <Badge>won</Badge>
          <Badge variant="destructive">lost</Badge>
          <Badge variant="secondary">closed</Badge>
        </div>
      </CardContent>
    </Card>

    <ApiEndpoint method="GET" endpoint="/v1/gateway/disputes?limit=50&offset=0" description="List disputes for your merchants."
      response={JSON.stringify({ data: [{ id: "dsp_uuid", charge_id: "chg_uuid", amount: 5000, currency: "XAF", status: "open", reason: "fraudulent", evidence_due_by: "2026-03-01T00:00:00Z", provider: "stripe" }], total: 1 }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/disputes/{disputeId}" description="Retrieve a single dispute by ID."
      response={JSON.stringify({ id: "dsp_uuid", charge_id: "chg_uuid", amount: 5000, currency: "XAF", status: "open", reason: "fraudulent", evidence_due_by: "2026-03-01T00:00:00Z", provider: "stripe", created_at: "2026-02-20T14:00:00Z" }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/disputes/{disputeId}/evidence" description="Submit evidence for a dispute."
      requestBody={JSON.stringify({ evidence_text: "Customer received goods on 2026-02-18.", evidence_type: "receipt", file_url: "https://storage.example.com/receipt.pdf" }, null, 2)}
      response={JSON.stringify({ id: "dsp_uuid", status: "under_review", evidence_submitted_at: "2026-02-21T10:00:00Z" }, null, 2)}
      parameters={[
        { name: "disputeId", type: "uuid", required: true, description: "The dispute to submit evidence for" },
        { name: "evidence_text", type: "string", required: true, description: "Text description of the evidence" },
        { name: "evidence_type", type: "string", required: false, description: "Type: receipt, tracking, refund_policy, etc." },
        { name: "file_url", type: "string", required: false, description: "URL to evidence file" },
      ]}
    />
  </div>
);

export default GatewayDisputesGuide;
