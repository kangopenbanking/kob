import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";

const GatewayMerchantWalletGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Merchant Wallet API | Kang Open Banking" description="Check merchant available, pending, and ledger balances across currencies." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Merchant Wallet / Balances API</h1>
      <p className="text-muted-foreground mt-2">Retrieve real-time merchant balances across currencies. Balances update automatically on charge completion, settlement, and payout.</p>
    </div>

    <ApiEndpoint method="GET" endpoint="/v1/gateway/balances?merchant_id={id}" description="Retrieve all wallet balances for a merchant, grouped by currency."
      response={JSON.stringify({ data: [{ id: "wal_uuid", merchant_id: "mch_uuid", currency: "XAF", available_balance: 500000, pending_balance: 25000, ledger_balance: 525000, updated_at: "2026-02-22T10:00:00Z" }] }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
      ]}
    />

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Balance Types</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li><strong>available_balance</strong> — Funds available for payout</li>
        <li><strong>pending_balance</strong> — Funds from successful charges awaiting settlement</li>
        <li><strong>ledger_balance</strong> — Total of available + pending (accounting balance)</li>
      </ul>
    </div>
  </div>
);

export default GatewayMerchantWalletGuide;
