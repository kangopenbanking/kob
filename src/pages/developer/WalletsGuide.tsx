import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

const WalletsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Wallets API | Kang Open Banking" description="Full custodial wallet infrastructure — create programmatic wallets, credit/debit with idempotency, freeze/unfreeze, retrieve statements, and track three-state balances." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Wallets API</h1>
      <p className="text-muted-foreground mt-2">
        Full custodial wallet infrastructure for your platform. Create programmatic wallet accounts, hold and track balances with a three-state model, perform ledger operations (credit/debit), freeze/unfreeze wallets, and retrieve paginated transaction statements — all via a unified REST API.
      </p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        Kang Open Banking provides <strong>full custodial wallet infrastructure</strong> — not just open banking account aggregation. 
        When you create a wallet via the API, KOB provisions a dedicated ledger account backed by institutional settlement pools. 
        Your platform holds funds on behalf of users, with every credit and debit recorded atomically in a double-entry ledger.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Wallet Lifecycle</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">Create</span>
          <span>→</span>
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">Credit</span>
          <span>→</span>
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">Debit</span>
          <span>→</span>
          <span className="bg-destructive/10 text-destructive px-3 py-1 rounded-full font-medium">Freeze</span>
          <span>→</span>
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">Unfreeze</span>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Wallets are created in <code className="bg-muted px-1 rounded">active</code> status. Frozen wallets reject all credits and debits until unfrozen. Wallets support multi-currency — create separate wallets per currency for the same owner.
        </p>
      </div>
    </div>

    {/* Three-State Balance Model */}
    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Three-State Balance Model</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li><strong>available</strong> — Cleared funds ready for use or withdrawal</li>
        <li><strong>pending</strong> — Funds awaiting settlement or clearance (e.g. incoming MoMo deposit not yet confirmed)</li>
        <li><strong>ledger</strong> — Total accounting balance (<code className="bg-muted px-1 rounded">available + pending</code>). This is the source-of-truth for reconciliation</li>
      </ul>
    </div>

    {/* Use Cases */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Use Cases</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { title: "Marketplace Payee Balances", desc: "Hold seller earnings until payout thresholds are met or settlement windows close." },
          { title: "Gig-Economy Worker Wallets", desc: "Credit driver/rider wallets after each trip and allow on-demand withdrawals." },
          { title: "Prepaid Card Funding", desc: "Fund virtual cards from wallet balances for e-commerce or business travel spend." },
          { title: "Loyalty & Rewards Ledger", desc: "Track points/cashback as wallet credits with full audit trail." },
        ].map(c => (
          <div key={c.title} className="border rounded-lg p-3">
            <h4 className="font-medium text-sm">{c.title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>

    {/* API Endpoints */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="POST" endpoint="/v1/wallets" description="Create a new custodial wallet. Create multiple wallets per owner for multi-currency support."
      parameters={[
        { name: "owner_id", type: "uuid", required: true, description: "User ID that owns this wallet" },
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code (e.g. XAF, USD, EUR)" },
        { name: "label", type: "string", required: false, description: "Human-readable wallet label" },
      ]}
      response={JSON.stringify({
        data: { id: "wal_abc123", owner_id: "usr_xyz", currency: "XAF", label: "Main Wallet", available: 0, pending: 0, ledger: 0, status: "active", created_at: "2026-03-01T10:00:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/wallets/:wallet_id" description="Retrieve wallet details and current balances."
      parameters={[
        { name: "wallet_id", type: "uuid", required: true, description: "Wallet identifier" },
      ]}
      response={JSON.stringify({
        data: { id: "wal_abc123", owner_id: "usr_xyz", currency: "XAF", label: "Main Wallet", available: 150000, pending: 25000, ledger: 175000, status: "active", updated_at: "2026-03-01T14:30:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/wallets/:wallet_id/credit" description="Credit funds to a wallet. Requires Idempotency-Key header."
      parameters={[
        { name: "amount", type: "number", required: true, description: "Amount to credit in minor or major units" },
        { name: "description", type: "string", required: false, description: "Reason for the credit" },
        { name: "reference", type: "string", required: false, description: "External reference ID" },
      ]}
      response={JSON.stringify({
        data: { transaction_id: "txn_cr_001", wallet_id: "wal_abc123", type: "credit", amount: 50000, balance_after: { available: 200000, pending: 25000, ledger: 225000 }, created_at: "2026-03-01T15:00:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/wallets/:wallet_id/debit" description="Debit funds from a wallet. Fails if insufficient available balance."
      parameters={[
        { name: "amount", type: "number", required: true, description: "Amount to debit" },
        { name: "description", type: "string", required: false, description: "Reason for the debit" },
        { name: "reference", type: "string", required: false, description: "External reference ID" },
      ]}
      response={JSON.stringify({
        data: { transaction_id: "txn_db_002", wallet_id: "wal_abc123", type: "debit", amount: 10000, balance_after: { available: 190000, pending: 25000, ledger: 215000 }, created_at: "2026-03-01T15:05:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/wallets/:wallet_id/freeze" description="Freeze a wallet to prevent all credits and debits."
      parameters={[
        { name: "reason", type: "string", required: true, description: "Reason for freezing (e.g. compliance_hold, fraud_investigation)" },
      ]}
      response={JSON.stringify({
        data: { wallet_id: "wal_abc123", status: "frozen", frozen_at: "2026-03-01T16:00:00Z", reason: "compliance_hold" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/wallets/:wallet_id/unfreeze" description="Unfreeze a previously frozen wallet, restoring credit and debit operations."
      parameters={[
        { name: "reason", type: "string", required: true, description: "Reason for unfreezing (e.g. investigation_cleared, compliance_approved)" },
      ]}
      response={JSON.stringify({
        data: { wallet_id: "wal_abc123", status: "active", unfrozen_at: "2026-03-02T09:00:00Z", reason: "investigation_cleared" }
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/wallets/:wallet_id/statement" description="Retrieve paginated wallet transaction history."
      parameters={[
        { name: "from", type: "string", required: false, description: "ISO 8601 start date" },
        { name: "to", type: "string", required: false, description: "ISO 8601 end date" },
        { name: "limit", type: "number", required: false, description: "Results per page (default 25, max 100)" },
        { name: "cursor", type: "string", required: false, description: "Pagination cursor from previous response" },
      ]}
      response={JSON.stringify({
        data: [
          { id: "txn_cr_001", type: "credit", amount: 50000, description: "Deposit", balance_after: 200000, created_at: "2026-03-01T15:00:00Z" },
          { id: "txn_db_002", type: "debit", amount: 10000, description: "Transfer out", balance_after: 190000, created_at: "2026-03-01T15:05:00Z" },
        ],
        has_more: true,
        next_cursor: "cur_abc456"
      }, null, 2)}
    />

    {/* Code Examples */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Code Examples</h2>
      <div className="space-y-3">
        <h3 className="font-medium text-sm">Create a Wallet (curl)</h3>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`curl -X POST https://api.kangopenbanking.com/v1/wallets \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "owner_id": "usr_xyz",
    "currency": "XAF",
    "label": "Main Wallet"
  }'`}
        </pre>

        <h3 className="font-medium text-sm">Credit a Wallet (Node.js)</h3>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`const response = await fetch(
  'https://api.kangopenbanking.com/v1/wallets/wal_abc123/credit',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk_live_...',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'credit_unique_key_001'
    },
    body: JSON.stringify({
      amount: 50000,
      description: 'Marketplace sale payout',
      reference: 'order_12345'
    })
  }
);
const { data } = await response.json();
console.log(data.balance_after); // { available: 200000, pending: 25000, ledger: 225000 }`}
        </pre>
      </div>
    </div>

    {/* Idempotency */}
    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Idempotency</h3>
      <p className="text-sm text-muted-foreground">
        All credit and debit operations require an <code className="bg-muted px-1 rounded">Idempotency-Key</code> header. 
        Duplicate requests with the same key within 24 hours will return the original response without re-executing the operation.
        See the <a href="/developer/api/idempotency" className="text-primary underline">Idempotency Guide</a> for details.
      </p>
    </div>

    {/* Webhook Events */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Webhook Events</h2>
      <p className="text-sm text-muted-foreground">
        Subscribe to wallet events via <a href="/developer/gateway/webhooks-v2" className="text-primary underline">Webhooks v2</a> to receive real-time notifications.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { event: "wallet.created", desc: "A new wallet has been provisioned" },
            { event: "wallet.credited", desc: "Funds were added to the wallet" },
            { event: "wallet.debited", desc: "Funds were deducted from the wallet" },
            { event: "wallet.frozen", desc: "Wallet was frozen (all operations suspended)" },
            { event: "wallet.unfrozen", desc: "Wallet was unfrozen (operations resumed)" },
          ].map(e => (
            <TableRow key={e.event}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.event}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>Multi-Currency Support</strong> — Create separate wallets per currency for the same owner. For example, a marketplace seller can hold XAF, USD, and EUR balances simultaneously, each with independent ledger tracking.
      </AlertDescription>
    </Alert>

    <AutoDocNavigation />
  </div>
);

export default WalletsGuide;
