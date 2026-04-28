import { CodeBlock } from "@/components/developer/CodeBlock";
import { MermaidDiagram } from "@/components/developer/MermaidDiagram";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const payinFlow = `sequenceDiagram
    participant Client as Your App
    participant KOB as KOB API
    participant Stripe as Stripe
    participant PayPal as PayPal

    rect rgb(240,249,255)
    Note over Client,Stripe: Stripe Card Pay-in
    Client->>KOB: create_stripe_intent
    KOB->>Stripe: Create PaymentIntent
    Stripe-->>KOB: client_secret
    KOB-->>Client: {client_secret, intent_id}
    Client->>Stripe: Confirm payment (Stripe.js)
    Stripe->>KOB: Webhook: payment_intent.succeeded
    KOB->>KOB: confirm_payin → status: pending
    end

    rect rgb(255,248,240)
    Note over Client,PayPal: PayPal Pay-in
    Client->>KOB: create_paypal_order
    KOB-->>Client: {provider_ref, intent_id}
    Client->>PayPal: Redirect to PayPal checkout
    PayPal->>KOB: Webhook: CHECKOUT.ORDER.APPROVED
    KOB->>KOB: confirm_payin → status: pending
    end`;

export default function RemittancePayinMethods() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-3">
        <Badge variant="outline" className="text-xs font-mono">remittance-payin-intent</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Pay-in Methods</h1>
        <p className="text-lg text-muted-foreground">
          Fund remittance transfers using Stripe cards, PayPal, Flutterwave MoMo, or KOB wallet.
        </p>
      </div>

      <MermaidDiagram chart={payinFlow} />

      {/* Stripe */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Stripe Card</h2>
        <p className="text-muted-foreground">
          Create a Stripe PaymentIntent to collect card payment. Use the returned <code className="text-xs bg-muted px-1 py-0.5 rounded">client_secret</code> with
          Stripe.js on the frontend.
        </p>
        <CodeBlock
          title="Create Stripe Intent"
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
        <CodeBlock
          title="Response"
          examples={[{
            language: "json",
            code: JSON.stringify({
              intent_id: "pi_xxx",
              provider: "stripe",
              client_secret: "pi_xxx_secret_yyy",
              payment_intent_id: "pi_xxx",
              status: "pending",
            }, null, 2),
          }]}
        />
      </div>

      {/* PayPal */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">PayPal</h2>
        <CodeBlock
          title="Create PayPal Order"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-payin-intent \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create_paypal_order",
    "remittance_id": "rem_xxx"
  }'`
          }]}
        />
      </div>

      {/* Flutterwave MoMo */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Flutterwave MoMo</h2>
        <CodeBlock
          title="Initiate MoMo Charge"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-payin-intent \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create_flw_momo",
    "remittance_id": "rem_xxx",
    "phone_number": "+237670000000",
    "momo_provider": "MTN"
  }'`
          }]}
        />
      </div>

      {/* KOB Wallet */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">KOB Wallet</h2>
        <p className="text-muted-foreground">
          Instant funding from the user's KOB wallet. The transfer moves to <code className="text-xs bg-muted px-1 py-0.5 rounded">pending</code> immediately.
        </p>
        <CodeBlock
          title="Wallet Debit"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-payin-intent \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create_kob_wallet",
    "remittance_id": "rem_xxx"
  }'`
          }]}
        />
      </div>

      {/* Method Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Method Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Method</th>
                <th className="text-left py-2">Speed</th>
                <th className="text-left py-2">Currencies</th>
                <th className="text-left py-2">Best For</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr><td className="py-2">Stripe Card</td><td>Instant</td><td>EUR, GBP, USD</td><td>International senders</td></tr>
              <tr><td className="py-2">PayPal</td><td>~1 min</td><td>EUR, USD, GBP</td><td>US/EU senders</td></tr>
              <tr><td className="py-2">MoMo (FLW)</td><td>~30s</td><td>XAF</td><td>Cameroon domestic</td></tr>
              <tr><td className="py-2">KOB Wallet</td><td>Instant</td><td>XAF</td><td>Existing KOB users</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
