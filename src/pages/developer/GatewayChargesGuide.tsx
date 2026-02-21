import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";

const GatewayChargesGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Charges API | Kang Open Banking" description="Create and manage payment charges via Mobile Money, Cards, and Bank Transfers." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Charges API</h1>
      <p className="text-muted-foreground mt-2">Collect payments from customers via mobile_money, card, or bank_transfer channels through a single endpoint.</p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges" description="Create a new charge. Routes automatically to Flutterwave (MoMo) or Stripe (card) based on channel."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", amount: 5000, currency: "XAF", channel: "mobile_money", customer_phone: "237677123456", tx_ref: "order_001", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", merchant_id: "mch_uuid", amount: 5000, currency: "XAF", channel: "mobile_money", status: "processing", provider: "flutterwave", provider_ref: "FLW-1234", fee_amount: 200, net_amount: 4800, tx_ref: "order_001", created_at: "2026-02-21T10:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "amount", type: "number", required: true, description: "Amount in minor or major units (XAF = major)" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
        { name: "channel", type: "string", required: true, description: "mobile_money | card | bank_transfer" },
        { name: "customer_phone", type: "string", required: false, description: "Required for mobile_money" },
        { name: "customer_email", type: "string", required: false, description: "Required for card" },
        { name: "tx_ref", type: "string", required: true, description: "Your unique transaction reference" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/charges?id={chargeId}" description="Retrieve a charge by ID with latest provider status."
      response={JSON.stringify({ id: "chg_uuid", status: "successful", amount: 5000, currency: "XAF", channel: "mobile_money" }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/charges?merchant_id={id}&status={status}&channel={channel}&from={date}&to={date}&limit=50&offset=0" description="List charges with filters."
      response={JSON.stringify({ data: [], total: 0, limit: 50, offset: 0 }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/{chargeId}/verify" description="Verify a charge by polling the provider (Flutterwave or Stripe) for the latest status and syncing it to the gateway."
      response={JSON.stringify({ id: "chg_uuid", status: "successful", provider: "flutterwave", provider_ref: "FLW-1234", amount: 5000, currency: "XAF", channel: "mobile_money", verified_at: "2026-02-21T10:05:00Z" }, null, 2)}
      parameters={[
        { name: "chargeId", type: "uuid", required: true, description: "The charge ID to verify against the provider" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/{chargeId}/cancel" description="Cancel a pending charge before it is processed by the provider."
      response={JSON.stringify({ id: "chg_uuid", status: "cancelled", cancelled_at: "2026-02-21T10:02:00Z" }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/fee-estimate?amount={amount}&channel={channel}&currency={currency}" description="Preview transaction fees and net amount before creating a charge."
      response={JSON.stringify({ amount: 5000, currency: "XAF", channel: "mobile_money", fee_amount: 200, net_amount: 4800, fee_percentage: "3%", fixed_fee: 50 }, null, 2)}
      parameters={[
        { name: "amount", type: "number", required: true, description: "Transaction amount" },
        { name: "channel", type: "string", required: true, description: "mobile_money | card | bank_transfer" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
      ]}
    />
  </div>
);

export default GatewayChargesGuide;
