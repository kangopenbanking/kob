import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

const EscrowGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Escrow API | Kang Open Banking" description="Create escrow holds for marketplace transactions. Fund, release, refund, and freeze escrow sub-wallets." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Escrow API</h1>
      <p className="text-muted-foreground mt-2">
        Escrow sub-wallets enable marketplace transactions where funds are held securely until conditions are met. 
        Supports creation, funding, release, refund, and freeze operations for multi-party settlement flows.
      </p>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Escrow Lifecycle</h3>
      <div className="flex flex-wrap gap-2 text-sm">
        {["created", "funded", "released", "refunded", "frozen", "expired"].map(s => (
          <span key={s} className="bg-primary/10 text-primary px-2 py-1 rounded font-mono">{s}</span>
        ))}
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        Escrow wallets transition through these states. Only <code>funded</code> escrows can be released or refunded.
      </p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/escrow" description="Create a new escrow hold."
      parameters={[
        { name: "payer_wallet_id", type: "uuid", required: true, description: "Wallet funding the escrow" },
        { name: "payee_wallet_id", type: "uuid", required: true, description: "Wallet receiving funds on release" },
        { name: "amount", type: "number", required: true, description: "Escrow amount" },
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "description", type: "string", required: false, description: "Purpose of the escrow" },
        { name: "expires_at", type: "string", required: false, description: "ISO 8601 expiry timestamp" },
      ]}
      response={JSON.stringify({
        data: { id: "esc_001", status: "created", amount: 100000, currency: "XAF", payer_wallet_id: "wal_a", payee_wallet_id: "wal_b", created_at: "2026-03-01T10:00:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/escrow/:escrow_id/fund" description="Fund the escrow by debiting the payer wallet."
      response={JSON.stringify({
        data: { id: "esc_001", status: "funded", funded_at: "2026-03-01T10:05:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/escrow/:escrow_id/release" description="Release escrowed funds to the payee wallet."
      parameters={[
        { name: "amount", type: "number", required: false, description: "Partial release amount (omit for full release)" },
      ]}
      response={JSON.stringify({
        data: { id: "esc_001", status: "released", released_amount: 100000, released_at: "2026-03-02T14:00:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/escrow/:escrow_id/refund" description="Refund escrowed funds back to the payer wallet."
      response={JSON.stringify({
        data: { id: "esc_001", status: "refunded", refunded_at: "2026-03-02T14:00:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/escrow/:escrow_id/freeze" description="Freeze an escrow for dispute investigation."
      parameters={[
        { name: "reason", type: "string", required: true, description: "Freeze reason" },
      ]}
      response={JSON.stringify({
        data: { id: "esc_001", status: "frozen", frozen_at: "2026-03-02T15:00:00Z", reason: "dispute_opened" }
      }, null, 2)}
    />

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Use Cases</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li><strong>Marketplaces</strong> — Hold buyer payment until seller delivers goods</li>
        <li><strong>Freelance platforms</strong> — Milestone-based release of project funds</li>
        <li><strong>Rental deposits</strong> — Secure tenant deposits with automatic expiry</li>
        <li><strong>Trade finance</strong> — Hold funds pending document verification</li>
      </ul>
    </div>

    <DocNavigation
      previousPage={{ title: "Wallets", path: "/developer/gateway/wallets" }}
      nextPage={{ title: "Compliance Screening", path: "/developer/gateway/compliance" }}
    />
  </div>
);

export default EscrowGuide;
