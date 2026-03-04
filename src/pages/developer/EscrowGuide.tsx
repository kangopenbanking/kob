import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocNavigation } from "@/components/developer/DocNavigation";
import { Info } from "lucide-react";

const EscrowGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Escrow API | Kang Open Banking" description="Create escrow holds for marketplace transactions — fund, release (full/partial), refund, and freeze escrow sub-wallets with webhook lifecycle." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Escrow API</h1>
      <p className="text-muted-foreground mt-2">
        Escrow sub-wallets enable marketplace transactions where funds are held securely until conditions are met. 
        Supports creation, funding, partial/full release, refund, and freeze operations for multi-party settlement flows.
      </p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        An escrow acts as a neutral holding wallet between a payer and payee. When a buyer pays, funds move from their wallet into the escrow — not directly to the seller. The platform controls when funds are released (e.g. after delivery confirmation) or refunded (e.g. dispute resolution). This protects both parties.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Escrow Lifecycle</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {[
            { label: "created", color: "primary" },
            { label: "funded", color: "primary" },
            { label: "released / refunded", color: "primary" },
          ].map((step, i) => (
            <span key={step.label}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step.label}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Escrows can also be <span className="text-destructive font-medium">frozen</span> at any point for dispute investigation, and auto-expire if an <code className="bg-muted px-1 rounded">expires_at</code> is set.
        </p>
      </div>
    </div>

    {/* Escrow States */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Escrow States</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>State</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Allowed Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { state: "created", desc: "Escrow provisioned, awaiting funding", actions: "Fund" },
            { state: "funded", desc: "Payer wallet debited, funds held in escrow", actions: "Release, Refund, Freeze" },
            { state: "released", desc: "Funds transferred to payee wallet", actions: "None" },
            { state: "refunded", desc: "Funds returned to payer wallet", actions: "None" },
            { state: "frozen", desc: "Escrow locked for investigation", actions: "Release, Refund (after unfreeze)" },
            { state: "expired", desc: "Auto-expired after expires_at", actions: "Auto-refunded to payer" },
          ].map(s => (
            <TableRow key={s.state}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{s.state}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.desc}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.actions}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Use Cases */}
    <div className="grid sm:grid-cols-2 gap-3">
      {[
        { title: "Marketplaces", desc: "Hold buyer payment until seller delivers goods and buyer confirms receipt." },
        { title: "Freelance Platforms", desc: "Milestone-based release — fund escrow at project start, release per milestone." },
        { title: "Rental Deposits", desc: "Secure tenant deposits with automatic expiry and refund after lease ends." },
        { title: "Trade Finance", desc: "Hold funds pending document verification or customs clearance." },
      ].map(c => (
        <div key={c.title} className="border rounded-lg p-3">
          <h4 className="font-medium text-sm">{c.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
        </div>
      ))}
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="POST" endpoint="/v1/escrow" description="Create a new escrow hold between a payer and payee wallet."
      parameters={[
        { name: "payer_wallet_id", type: "uuid", required: true, description: "Wallet funding the escrow" },
        { name: "payee_wallet_id", type: "uuid", required: true, description: "Wallet receiving funds on release" },
        { name: "amount", type: "number", required: true, description: "Escrow amount" },
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "description", type: "string", required: false, description: "Purpose of the escrow" },
        { name: "expires_at", type: "string", required: false, description: "ISO 8601 expiry timestamp (auto-refunds on expiry)" },
      ]}
      response={JSON.stringify({
        data: { id: "esc_001", status: "created", amount: 100000, currency: "XAF", payer_wallet_id: "wal_a", payee_wallet_id: "wal_b", created_at: "2026-03-01T10:00:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/escrow/:escrow_id/fund" description="Fund the escrow by debiting the payer's wallet. Escrow transitions to funded."
      response={JSON.stringify({
        data: { id: "esc_001", status: "funded", funded_at: "2026-03-01T10:05:00Z", amount: 100000, currency: "XAF" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/escrow/:escrow_id/release" description="Release funds to the payee. Supports partial release for milestone-based flows."
      parameters={[
        { name: "amount", type: "number", required: false, description: "Partial release amount (omit for full release)" },
      ]}
      response={JSON.stringify({
        data: { id: "esc_001", status: "released", released_amount: 100000, released_at: "2026-03-02T14:00:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/escrow/:escrow_id/refund" description="Refund the full remaining escrow balance back to the payer's wallet."
      response={JSON.stringify({
        data: { id: "esc_001", status: "refunded", refunded_amount: 100000, refunded_at: "2026-03-02T14:00:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/escrow/:escrow_id/freeze" description="Freeze an escrow for dispute investigation. Blocks release and refund until unfrozen."
      parameters={[
        { name: "reason", type: "string", required: true, description: "Freeze reason (e.g. dispute_opened, fraud_investigation)" },
      ]}
      response={JSON.stringify({
        data: { id: "esc_001", status: "frozen", frozen_at: "2026-03-02T15:00:00Z", reason: "dispute_opened" }
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/escrow/:escrow_id" description="Retrieve escrow details and current state."
      response={JSON.stringify({
        data: { id: "esc_001", status: "funded", amount: 100000, released_amount: 0, currency: "XAF", payer_wallet_id: "wal_a", payee_wallet_id: "wal_b", expires_at: "2026-04-01T10:00:00Z", created_at: "2026-03-01T10:00:00Z" }
      }, null, 2)}
    />

    {/* Code Example */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Code Example: Marketplace Escrow</h2>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// 1. Buyer places order → Create & fund escrow
const escrow = await fetch('/v1/escrow', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer sk_live_...', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payer_wallet_id: 'buyer_wallet',
    payee_wallet_id: 'seller_wallet',
    amount: 50000, currency: 'XAF',
    description: 'Order #12345 - Electronics',
    expires_at: '2026-04-01T00:00:00Z'
  })
});
const { data: { id } } = await escrow.json();

// 2. Fund the escrow (debits buyer's wallet)
await fetch(\`/v1/escrow/\${id}/fund\`, { method: 'POST', headers: { ... } });

// 3. Buyer confirms delivery → Release to seller
await fetch(\`/v1/escrow/\${id}/release\`, { method: 'POST', headers: { ... } });

// OR: Dispute opened → Freeze for investigation
await fetch(\`/v1/escrow/\${id}/freeze\`, {
  method: 'POST', headers: { ... },
  body: JSON.stringify({ reason: 'buyer_dispute' })
});`}
      </pre>
    </div>

    {/* Webhook Events */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Webhook Events</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { event: "escrow.created", desc: "New escrow hold provisioned" },
            { event: "escrow.funded", desc: "Payer wallet debited, funds held in escrow" },
            { event: "escrow.released", desc: "Funds released to payee (full or partial)" },
            { event: "escrow.refunded", desc: "Funds returned to payer wallet" },
            { event: "escrow.frozen", desc: "Escrow locked for dispute investigation" },
            { event: "escrow.expired", desc: "Escrow auto-expired and funds returned to payer" },
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
        <strong>Partial Releases</strong> — Use partial releases for milestone-based payments. For example, release 30% on project start, 50% on delivery, and 20% after a review period. Track remaining balance via the <code className="bg-muted px-1 rounded">GET /v1/escrow/:id</code> endpoint.
      </AlertDescription>
    </Alert>

    <DocNavigation
      previousPage={{ title: "Wallets", path: "/developer/gateway/wallets" }}
      nextPage={{ title: "Compliance Screening", path: "/developer/gateway/compliance" }}
    />
  </div>
);

export default EscrowGuide;
