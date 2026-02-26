import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";

const GatewayChargesGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Charges API | Kang Open Banking" description="Create and manage payment charges via Mobile Money, Cards, and Bank Transfers. Includes OTP validation, preauthorization, and fee passthrough." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Charges API</h1>
      <p className="text-muted-foreground mt-2">Collect payments from customers via mobile_money, card, or bank_transfer channels through a single endpoint. Supports OTP validation, preauthorization (auth + capture), and configurable fee bearer. To fund a KOB user account directly, see <a href="/developer/gateway/funding" className="text-primary underline">Account Funding</a>.</p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges" description="Create a new charge. Routes automatically to Flutterwave (MoMo) or Stripe (card) based on channel. Supports fee_bearer and capture_mode overrides."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", amount: 5000, currency: "XAF", channel: "mobile_money", customer_phone: "237677123456", tx_ref: "order_001", fee_bearer: "merchant", capture_mode: "auto", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", merchant_id: "mch_uuid", amount: 5000, currency: "XAF", channel: "mobile_money", status: "processing", provider: "flutterwave", provider_ref: "FLW-1234", fee_amount: 200, net_amount: 4800, capture_mode: "auto", tx_ref: "order_001", created_at: "2026-02-22T10:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "amount", type: "number", required: true, description: "Amount in minor or major units (XAF = major)" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
        { name: "channel", type: "string", required: true, description: "mobile_money | card | bank_transfer | apple_pay | google_pay | ussd" },
        { name: "customer_phone", type: "string", required: false, description: "Required for mobile_money" },
        { name: "customer_email", type: "string", required: false, description: "Required for card" },
        { name: "tx_ref", type: "string", required: true, description: "Your unique transaction reference" },
        { name: "fee_bearer", type: "string", required: false, description: "merchant (default) or customer — who pays the transaction fee" },
        { name: "capture_mode", type: "string", required: false, description: "auto (default) or manual — for preauthorization flows" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/validate" description="Submit an OTP to complete a pending charge that requires validation (common with mobile money)."
      requestBody={JSON.stringify({ charge_id: "chg_uuid", otp: "123456" }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", status: "successful", message: "Charge validated" }, null, 2)}
      parameters={[
        { name: "charge_id", type: "uuid", required: true, description: "The pending charge ID" },
        { name: "otp", type: "string", required: true, description: "OTP received by the customer" },
        { name: "flw_ref", type: "string", required: false, description: "Flutterwave reference (auto-resolved if omitted)" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/preauth" description="Create a preauthorized charge — hold funds on a card without capturing. Uses Stripe PaymentIntent with capture_method=manual."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", amount: 50000, currency: "USD", customer_email: "john@example.com", tx_ref: "preauth_001" }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", status: "authorized", capture_mode: "manual", captured_amount: 0, client_secret: "pi_xxx_secret_yyy" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "amount", type: "number", required: true, description: "Amount to authorize" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default USD" },
        { name: "tx_ref", type: "string", required: true, description: "Unique transaction reference" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/{chargeId}/capture" description="Capture a previously authorized charge (full or partial)."
      requestBody={JSON.stringify({ amount: 25000 }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", status: "successful", captured_amount: 25000 }, null, 2)}
      parameters={[
        { name: "chargeId", type: "uuid", required: true, description: "The authorized charge ID" },
        { name: "amount", type: "number", required: false, description: "Partial capture amount (omit for full capture)" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/{chargeId}/void" description="Release an authorized hold without capturing any funds."
      response={JSON.stringify({ id: "chg_uuid", status: "voided" }, null, 2)}
      parameters={[
        { name: "chargeId", type: "uuid", required: true, description: "The authorized charge ID to void" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/charges?id={chargeId}" description="Retrieve a charge by ID with latest provider status."
      response={JSON.stringify({ id: "chg_uuid", status: "successful", amount: 5000, currency: "XAF", channel: "mobile_money", capture_mode: "auto" }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/charges?merchant_id={id}&status={status}&channel={channel}&from={date}&to={date}&limit=50&offset=0" description="List charges with filters."
      response={JSON.stringify({ data: [], total: 0, limit: 50, offset: 0 }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/{chargeId}/verify" description="Verify a charge by polling the provider (Flutterwave or Stripe) for the latest status and syncing it to the gateway."
      response={JSON.stringify({ id: "chg_uuid", status: "successful", provider: "flutterwave", provider_ref: "FLW-1234", amount: 5000, currency: "XAF", channel: "mobile_money", verified_at: "2026-02-22T10:05:00Z" }, null, 2)}
      parameters={[
        { name: "chargeId", type: "uuid", required: true, description: "The charge ID to verify against the provider" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/{chargeId}/cancel" description="Cancel a pending charge before it is processed by the provider."
      response={JSON.stringify({ id: "chg_uuid", status: "cancelled", cancelled_at: "2026-02-22T10:02:00Z" }, null, 2)}
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
