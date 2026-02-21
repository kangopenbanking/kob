import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GatewayChargeEventsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Charge Events API | Kang Open Banking" description="Track the full lifecycle of every charge with granular event timelines." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Charge Events & Timeline</h1>
      <p className="text-muted-foreground mt-2">Every charge emits lifecycle events as it moves through processing stages. Use the events API to build transaction timelines, debug payment issues, and provide customers with detailed status updates.</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Event Types</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { type: "charge.created", desc: "Charge record created, pending provider" },
            { type: "charge.processing", desc: "Provider has accepted the charge" },
            { type: "charge.successful", desc: "Payment confirmed by provider" },
            { type: "charge.failed", desc: "Provider rejected or error occurred" },
            { type: "charge.cancelled", desc: "Charge cancelled before processing" },
            { type: "charge.refunded", desc: "Full or partial refund issued" },
            { type: "charge.created_via_token", desc: "Charge created using a saved token" },
            { type: "charge.disputed", desc: "Customer filed a dispute/chargeback" },
          ].map(e => (
            <div key={e.type} className="flex gap-3 items-start">
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded whitespace-nowrap">{e.type}</code>
              <span className="text-sm text-muted-foreground">{e.desc}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    <ApiEndpoint method="GET" endpoint="/v1/gateway/charges/{chargeId}/events" description="Retrieve the full event timeline for a charge, ordered chronologically."
      response={JSON.stringify({ data: [
        { id: "evt_1", charge_id: "chg_uuid", event_type: "charge.created", details: { channel: "mobile_money", amount: 5000, provider: "flutterwave" }, created_at: "2026-02-21T10:00:00Z" },
        { id: "evt_2", charge_id: "chg_uuid", event_type: "charge.processing", details: { provider_ref: "FLW-1234" }, created_at: "2026-02-21T10:00:01Z" },
        { id: "evt_3", charge_id: "chg_uuid", event_type: "charge.successful", details: { provider_ref: "FLW-1234" }, created_at: "2026-02-21T10:00:05Z" },
      ] }, null, 2)}
      parameters={[
        { name: "chargeId", type: "uuid", required: true, description: "The charge ID to fetch events for" },
      ]}
    />
  </div>
);

export default GatewayChargeEventsGuide;
