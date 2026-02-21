import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";

const GatewayTokenizationGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Customer Tokenization API | Kang Open Banking" description="Save customer payment methods and charge them later using tokens." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Customer Tokenization</h1>
      <p className="text-muted-foreground mt-2">Store customer profiles with saved payment methods (tokens). Use tokens to charge returning customers without re-collecting payment details — ideal for subscriptions, one-click checkout, and recurring billing.</p>
    </div>

    <h2 className="text-2xl font-semibold mt-8">Customers</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/customers" description="Create a customer profile linked to your merchant account."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", email: "john@example.com", name: "John Doe", phone: "+237677123456", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "cust_uuid", merchant_id: "mch_uuid", email: "john@example.com", name: "John Doe", phone: "+237677123456", created_at: "2026-02-21T12:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "email", type: "string", required: true, description: "Customer email (unique per merchant)" },
        { name: "name", type: "string", required: false, description: "Customer display name" },
        { name: "phone", type: "string", required: false, description: "Phone number" },
      ]}
    />

    <h2 className="text-2xl font-semibold mt-8">Token Charges</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/token" description="Charge a saved payment method. The token contains the channel and provider information. Routes to the original payment provider automatically."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", token_id: "tok_uuid", amount: 10000, currency: "XAF", tx_ref: "recurring_001", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", merchant_id: "mch_uuid", amount: 10000, currency: "XAF", channel: "card", status: "successful", provider: "stripe", fee_amount: 400, net_amount: 9600, tx_ref: "recurring_001" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "token_id", type: "uuid", required: true, description: "Saved payment token ID" },
        { name: "amount", type: "number", required: true, description: "Amount to charge" },
        { name: "tx_ref", type: "string", required: true, description: "Your unique transaction reference" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
      ]}
    />
  </div>
);

export default GatewayTokenizationGuide;
