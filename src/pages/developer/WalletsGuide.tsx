import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

const WalletsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Wallets API | Kang Open Banking" description="Create and manage custodial wallets with three-state balance model. Credit, debit, freeze, and retrieve wallet statements." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Wallets API</h1>
      <p className="text-muted-foreground mt-2">
        Create and manage custodial wallets for your users. The Wallets API provides a full lifecycle for wallet management including credits, debits, freezing, and statement retrieval with a three-state balance model.
      </p>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Three-State Balance Model</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li><strong>available</strong> — Cleared funds ready for use or withdrawal</li>
        <li><strong>pending</strong> — Funds awaiting settlement or clearance</li>
        <li><strong>ledger</strong> — Total accounting balance (available + pending)</li>
      </ul>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/wallets" description="Create a new custodial wallet for a user."
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

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Idempotency</h3>
      <p className="text-sm text-muted-foreground">
        All credit and debit operations require an <code className="bg-muted px-1 rounded">Idempotency-Key</code> header. 
        Duplicate requests with the same key within 24 hours will return the original response without re-executing the operation.
      </p>
    </div>

    <DocNavigation
      previousPage={{ title: "Merchant Wallet", path: "/developer/gateway/merchant-wallet" }}
      nextPage={{ title: "Escrow", path: "/developer/gateway/escrow" }}
    />
  </div>
);

export default WalletsGuide;
