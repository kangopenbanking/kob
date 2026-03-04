import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

const InstantPayoutsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Instant Payouts API | Kang Open Banking" description="Send instant payouts via bank transfer, mobile money, push-to-card (Visa Direct), with rail selection and cancellation." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Instant Payouts API</h1>
      <p className="text-muted-foreground mt-2">
        Send payouts instantly via the fastest available rail. Supports bank transfer, mobile money, and push-to-card (Visa Direct). 
        Choose between <code className="bg-muted px-1 rounded">standard</code> (T+1) and <code className="bg-muted px-1 rounded">instant</code> delivery speeds.
      </p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/payouts/instant" description="Create an instant payout with automatic rail selection."
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Source merchant ID" },
        { name: "amount", type: "number", required: true, description: "Payout amount" },
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "speed", type: "string", required: true, description: "Delivery speed: standard or instant" },
        { name: "destination", type: "object", required: true, description: "Destination details (bank account, mobile number, or card)" },
        { name: "narration", type: "string", required: false, description: "Payout description" },
      ]}
      response={JSON.stringify({
        data: {
          payout_id: "po_inst_001", status: "processing", speed: "instant", rail: "mobile_money",
          amount: 50000, currency: "XAF", estimated_arrival: "2026-03-01T10:02:00Z",
          fee: { amount: 250, currency: "XAF" }, created_at: "2026-03-01T10:00:00Z"
        }
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/payouts/rails" description="List available payout rails for a given currency and destination type."
      parameters={[
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "destination_type", type: "string", required: false, description: "bank_account, mobile_money, or card" },
      ]}
      response={JSON.stringify({
        data: [
          { rail: "mobile_money", speed: "instant", estimated_time: "< 2 minutes", currencies: ["XAF", "XOF"], fee_percentage: 0.5 },
          { rail: "bank_transfer", speed: "standard", estimated_time: "1-2 business days", currencies: ["XAF", "EUR", "USD"], fee_percentage: 0.25 },
          { rail: "push_to_card", speed: "instant", estimated_time: "< 30 minutes", currencies: ["USD", "EUR"], fee_percentage: 1.0 },
        ]
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/payouts/push-to-card" description="Push funds directly to a Visa or Mastercard via Visa Direct / Mastercard Send."
      parameters={[
        { name: "card_token", type: "string", required: true, description: "Tokenized card identifier" },
        { name: "amount", type: "number", required: true, description: "Amount in destination currency" },
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "narration", type: "string", required: false, description: "Payout description" },
      ]}
      response={JSON.stringify({
        data: { payout_id: "po_ptc_001", status: "processing", rail: "visa_direct", estimated_arrival: "2026-03-01T10:30:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/payouts/cancel" description="Cancel a pending payout before it is processed."
      parameters={[
        { name: "payout_id", type: "uuid", required: true, description: "Payout ID to cancel" },
        { name: "reason", type: "string", required: false, description: "Cancellation reason" },
      ]}
      response={JSON.stringify({
        data: { payout_id: "po_inst_001", status: "cancelled", cancelled_at: "2026-03-01T10:01:00Z" }
      }, null, 2)}
    />

    <DocNavigation
      previousPage={{ title: "Compliance Screening", path: "/developer/gateway/compliance" }}
      nextPage={{ title: "Treasury", path: "/developer/gateway/treasury" }}
    />
  </div>
);

export default InstantPayoutsGuide;
