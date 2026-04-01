import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Info } from "lucide-react";

const GatewayMerchantWalletGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Merchant Wallet API | Kang Open Banking" description="Real-time merchant balances across currencies — available, pending, and ledger balances that update on every charge, refund, settlement, and payout." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Merchant Wallet / Balances API</h1>
      <p className="text-muted-foreground mt-2">Retrieve real-time merchant balances across currencies. Balances update automatically on charge completion, refund, settlement, and payout.</p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        Every merchant has a wallet per currency. Balances are updated atomically on every financial event. The three-state model separates cleared funds from in-transit amounts, giving you precise control over what's available for payouts versus what's still settling.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-2">Balance Updates</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li><strong>Charge completed</strong> → <code className="bg-muted px-1 rounded">pending</code> increases (funds settling)</li>
          <li><strong>Settlement paid</strong> → <code className="bg-muted px-1 rounded">pending</code> decreases, <code className="bg-muted px-1 rounded">available</code> increases</li>
          <li><strong>Payout initiated</strong> → <code className="bg-muted px-1 rounded">available</code> decreases</li>
          <li><strong>Refund processed</strong> → <code className="bg-muted px-1 rounded">available</code> decreases (or <code className="bg-muted px-1 rounded">pending</code> if pre-settlement)</li>
        </ul>
      </div>
    </div>

    {/* Balance Types */}
    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Balance Types</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li><strong>available_balance</strong> — Cleared funds available for payout or withdrawal</li>
        <li><strong>pending_balance</strong> — Funds from successful charges awaiting settlement (T+1 to T+2 depending on channel)</li>
        <li><strong>ledger_balance</strong> — Total of available + pending (source of truth for accounting/reconciliation)</li>
      </ul>
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="GET" endpoint="/v1/gateway/balances?merchant_id={id}" description="Retrieve all wallet balances for a merchant, grouped by currency."
      response={JSON.stringify({ data: [
        { id: "wal_uuid_1", merchant_id: "mch_uuid", currency: "XAF", available_balance: 500000, pending_balance: 25000, ledger_balance: 525000, updated_at: "2026-02-22T10:00:00Z" },
        { id: "wal_uuid_2", merchant_id: "mch_uuid", currency: "USD", available_balance: 1200, pending_balance: 300, ledger_balance: 1500, updated_at: "2026-02-22T10:00:00Z" },
      ] }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "currency", type: "string", required: false, description: "Filter by currency (omit for all)" },
      ]}
    />

    {/* Code Example */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Code Example</h2>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Check if sufficient balance before initiating a payout
const balances = await fetch('/v1/gateway/balances?merchant_id=mch_uuid&currency=XAF', {
  headers: { 'Authorization': 'Bearer sk_live_...' }
}).then(r => r.json());

const xafBalance = balances.data[0];
const payoutAmount = 100000;

if (xafBalance.available_balance >= payoutAmount) {
  // Safe to initiate payout
  await fetch('/v1/gateway/payouts', { ... });
} else {
  console.log(\`Insufficient: \${xafBalance.available_balance} < \${payoutAmount}\`);
  console.log(\`Pending settlement: \${xafBalance.pending_balance}\`);
}`}
      </pre>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>User Wallets vs Merchant Wallets</strong> — This endpoint shows <em>merchant</em> balances (aggregated from charges). For <em>user-facing</em> custodial wallets with credit/debit operations, see the <a href="/developer/gateway/wallets" className="text-primary underline">Wallets API</a>.
      </AlertDescription>
    </Alert>

    <AutoDocNavigation />
  </div>
);

export default GatewayMerchantWalletGuide;
