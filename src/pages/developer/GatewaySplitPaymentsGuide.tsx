import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";

const GatewaySplitPaymentsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Split Payments & Subaccounts API | Kang Open Banking" description="Marketplace split payments and subaccount management for payment distribution." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Split Payments & Subaccounts</h1>
      <p className="text-muted-foreground mt-2">Create subaccounts for marketplace sellers or partners, then automatically split charge proceeds among them. Supports both percentage and flat-amount splits.</p>
    </div>

    <h2 className="text-2xl font-semibold mt-8">Subaccounts</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/subaccounts" description="Register a subaccount for a merchant. Each subaccount has a split type and value."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", subaccount_name: "Seller A", settlement_bank: "SGCM", account_number: "1234567890", split_type: "percentage", split_value: 20, currency: "XAF", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "sub_uuid", merchant_id: "mch_uuid", subaccount_name: "Seller A", split_type: "percentage", split_value: 20, is_active: true, created_at: "2026-02-21T12:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Parent merchant ID" },
        { name: "subaccount_name", type: "string", required: true, description: "Subaccount display name" },
        { name: "split_type", type: "string", required: false, description: "percentage | flat (default: percentage)" },
        { name: "split_value", type: "number", required: true, description: "Split amount: 0-100 for percentage, fixed amount for flat" },
        { name: "settlement_bank", type: "string", required: false, description: "Bank code for settlement" },
        { name: "account_number", type: "string", required: false, description: "Bank account number" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/subaccounts?merchant_id={id}" description="List all subaccounts for a merchant."
      response={JSON.stringify({ data: [{ id: "sub_uuid", subaccount_name: "Seller A", split_type: "percentage", split_value: 20, is_active: true }] }, null, 2)}
    />

    <h2 className="text-2xl font-semibold mt-8">Using Splits in Charges</h2>
    <p className="text-muted-foreground mb-4">Pass a <code>subaccounts</code> array when creating a charge to automatically split the net amount:</p>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges" description="Create a charge with split payments. Each subaccount receives its calculated share of the net amount."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", amount: 50000, currency: "XAF", channel: "mobile_money", customer_phone: "237677123456", tx_ref: "mkt_001", subaccounts: [{ subaccount_id: "sub_uuid" }] }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", amount: 50000, fee_amount: 2000, net_amount: 48000, status: "processing", splits: [{ subaccount_id: "sub_uuid", split_type: "percentage", split_value: 20, split_amount: 9600 }] }, null, 2)}
    />
  </div>
);

export default GatewaySplitPaymentsGuide;
