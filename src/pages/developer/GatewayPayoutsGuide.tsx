import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";

const GatewayPayoutsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Payouts API | Kang Open Banking" description="Send payouts to bank accounts and mobile wallets — single and batch." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Payouts API</h1>
      <p className="text-muted-foreground mt-2">Disburse funds to beneficiaries via bank transfer or mobile money. Supports single and batch payouts. For user account withdrawals to external banks, see the <a href="/developer/gateway/funding" className="text-primary underline">Account Funding & Withdrawals</a> guide.</p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payouts" description="Create a single payout."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", amount: 10000, currency: "XAF", channel: "mobile_money", beneficiary_phone: "237677123456", beneficiary_name: "Jean Dupont", narration: "Salary payment", tx_ref: "pay_001" }, null, 2)}
      response={JSON.stringify({ id: "pay_uuid", status: "processing", provider: "flutterwave", fee_amount: 350, tx_ref: "pay_001" }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payout-batches" description="Create a batch of payouts."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", currency: "XAF", items: [{ amount: 5000, channel: "mobile_money", beneficiary_phone: "237677111111", beneficiary_name: "Alice" }, { amount: 8000, channel: "bank_transfer", beneficiary_account: "123456789", beneficiary_bank: "AFRILAND", beneficiary_name: "Bob" }] }, null, 2)}
      response={JSON.stringify({ id: "batch_uuid", status: "processing", total_amount: 13000, item_count: 2, completed_count: 0, failed_count: 0 }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/payouts?id={payoutId}" description="Retrieve a single payout." />
    <ApiEndpoint method="GET" endpoint="/v1/gateway/payouts?merchant_id={id}&status={status}&limit=50&offset=0" description="List payouts with filters." />
  </div>
);

export default GatewayPayoutsGuide;
