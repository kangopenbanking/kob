import { MermaidDiagram } from "@/components/developer/MermaidDiagram";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Globe, Shield, Zap, RefreshCw } from "lucide-react";

const architectureDiagram = `sequenceDiagram
    participant Client as Client App
    participant API as KOB API
    participant Compliance as Compliance Engine
    participant Provider as Pay-in Provider
    participant Payout as Payout Provider
    participant Webhook as Client Webhook

    Client->>API: POST /remittance-engine?action=create_quote
    API-->>Client: Quote (rate, fees, expiry)
    Client->>API: POST /remittance-outbound?action=send
    API->>Compliance: Run compliance checks
    Compliance-->>API: Approved / Review
    API-->>Client: Transfer created (status: created)
    Client->>API: POST /remittance-payin-intent?action=create_stripe_intent
    API->>Provider: Create PaymentIntent
    Provider-->>API: client_secret
    API-->>Client: Pay-in intent (client_secret)
    Provider->>API: Webhook: payment_intent.succeeded
    API->>API: Confirm pay-in → status: pending
    API->>Payout: Initiate payout (MoMo/Bank)
    Payout-->>API: Payout ref
    Payout->>API: Webhook: payout.completed
    API->>API: Status → credited → settled
    API->>Webhook: remittance.transfer.completed`;

export default function RemittanceOverview() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">v4.4.0</Badge>
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Cameroon-First</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Remittance API</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Send money across borders with gateway-grade reliability. The KOB Remittance API supports
          pay-in via Stripe, PayPal, and Flutterwave MoMo, with payout to Mobile Money, bank accounts,
          PayPal, and KOB wallets. Built for the CEMAC corridor with XAF as the default currency.
        </p>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: Globe, title: "Multi-Corridor", desc: "CM↔CM, FR→CM, GB→CM, US→CM with configurable corridors" },
          { icon: Shield, title: "Compliance Built-in", desc: "Per-transfer limits, velocity checks, and manual review workflows" },
          { icon: Zap, title: "Real-time Webhooks", desc: "8 event types with HMAC-SHA256 signatures and delivery logs" },
          { icon: RefreshCw, title: "Full Lifecycle", desc: "Quote → Pay-in → Compliance → Payout → Settlement → Reconciliation" },
        ].map((f) => (
          <Card key={f.title} className="border border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <f.icon className="h-4 w-4 text-primary" />
                {f.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Architecture Diagram */}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">End-to-End Flow</h2>
        <p className="text-muted-foreground">
          The complete remittance lifecycle from quote to settlement:
        </p>
        <MermaidDiagram chart={architectureDiagram} />
      </div>

      {/* Quick Example */}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Quick Start</h2>
        <p className="text-muted-foreground">Create a quote and initiate a transfer in 3 API calls:</p>

        <h3 className="text-lg font-medium mt-4">1. Get a Quote</h3>
        <CodeBlock
          title="Create Quote"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-engine \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create_quote",
    "from_country": "FR",
    "to_country": "CM",
    "send_amount": 100,
    "send_currency": "EUR",
    "receive_currency": "XAF"
  }'`
          }]}
        />

        <h3 className="text-lg font-medium mt-4">2. Create Transfer</h3>
        <CodeBlock
          title="Send Money"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-outbound \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Idempotency-Key: rem_txn_001_20260325" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "send",
    "quote_id": "quote_xxx",
    "recipient_name": "Jean Dupont",
    "recipient_phone": "+237670000000",
    "payout_method": "momo_mtn"
  }'`
          }]}
        />

        <h3 className="text-lg font-medium mt-4">3. Fund via Stripe</h3>
        <CodeBlock
          title="Create Pay-in Intent"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-payin-intent \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create_stripe_intent",
    "remittance_id": "rem_xxx"
  }'`
          }]}
        />
      </div>

      {/* API Endpoints Summary */}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">API Endpoints</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium">Edge Function</th>
                <th className="text-left py-3 px-2 font-medium">Action</th>
                <th className="text-left py-3 px-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[
                ["remittance-engine", "list_corridors", "List available corridors"],
                ["remittance-engine", "create_quote", "Get FX quote with fees"],
                ["remittance-outbound", "send", "Create transfer"],
                ["remittance-outbound", "track", "Track transfer status"],
                ["remittance-outbound", "cancel", "Cancel transfer"],
                ["remittance-payin-intent", "create_stripe_intent", "Fund via Stripe card"],
                ["remittance-payin-intent", "create_paypal_order", "Fund via PayPal"],
                ["remittance-payin-intent", "create_flw_momo", "Fund via MoMo"],
                ["remittance-payin-intent", "create_kob_wallet", "Fund via KOB wallet"],
                ["remittance-client-webhooks", "register", "Register webhook endpoint"],
                ["remittance-client-webhooks", "rotate_secret", "Rotate signing secret"],
                ["remittance-client-webhooks", "list_deliveries", "View delivery logs"],
              ].map(([fn, act, desc]) => (
                <tr key={`${fn}-${act}`}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{fn}</td>
                  <td className="py-2 px-2 font-mono text-xs">{act}</td>
                  <td className="py-2 px-2 text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-2 pt-4 border-t border-border">
        <p className="text-sm font-medium">Next Steps</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Corridors & Quotes", path: "/developer/remittance/corridors-quotes" },
            { label: "Create Transfer", path: "/developer/remittance/create-transfer" },
            { label: "Pay-in Methods", path: "/developer/remittance/payin-methods" },
            { label: "Webhooks", path: "/developer/remittance/webhooks" },
          ].map((link) => (
            <a key={link.path} href={link.path} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              {link.label} <ArrowRight className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
