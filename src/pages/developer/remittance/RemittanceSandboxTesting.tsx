import { CodeBlock } from "@/components/developer/CodeBlock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RemittanceSandboxTesting() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-3">
        <Badge variant="outline" className="text-xs font-mono">Sandbox</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Sandbox Testing</h1>
        <p className="text-lg text-muted-foreground">
          Test the complete remittance flow in sandbox mode without moving real money.
        </p>
      </div>

      {/* Setup */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Getting Started</h2>
        <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2 ml-2">
          <li>Sign up and get sandbox API keys from the Developer Portal</li>
          <li>Use the sandbox base URL for all API calls</li>
          <li>Test corridors are pre-seeded (CM→CM, FR→CM, GB→CM, US→CM)</li>
          <li>Stripe test mode accepts card <code className="text-xs bg-muted px-1 py-0.5 rounded">4242 4242 4242 4242</code></li>
          <li>MoMo sandbox accepts any phone number starting with <code className="text-xs bg-muted px-1 py-0.5 rounded">+237670</code></li>
        </ol>
      </div>

      {/* E2E Flow */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Full E2E Test Flow</h2>
        <CodeBlock
          title="Step 1: List Corridors"
          examples={[{
            language: "bash",
            code: `curl "https://api.kangopenbanking.com/v1/remittance-engine?action=list_corridors&to_country=CM" \\
  -H "Authorization: Bearer SANDBOX_TOKEN"`
          }]}
        />
        <CodeBlock
          title="Step 2: Create Quote"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-engine \\
  -H "Authorization: Bearer SANDBOX_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"create_quote","from_country":"FR","to_country":"CM","send_amount":50,"send_currency":"EUR","receive_currency":"XAF"}'`
          }]}
        />
        <CodeBlock
          title="Step 3: Send Transfer"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-outbound \\
  -H "Authorization: Bearer SANDBOX_TOKEN" \\
  -H "Idempotency-Key: test_$(date +%s)" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"send","quote_id":"qt_xxx","recipient_name":"Test User","recipient_phone":"+237670000001","payout_method":"momo_mtn"}'`
          }]}
        />
        <CodeBlock
          title="Step 4: Fund via Stripe (sandbox)"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-payin-intent \\
  -H "Authorization: Bearer SANDBOX_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"create_stripe_intent","remittance_id":"rem_xxx"}'`
          }]}
        />
        <CodeBlock
          title="Step 5: Track Status"
          examples={[{
            language: "bash",
            code: `curl "https://api.kangopenbanking.com/v1/remittance-outbound?action=track&remittance_id=rem_xxx" \\
  -H "Authorization: Bearer SANDBOX_TOKEN"`
          }]}
        />
      </div>

      {/* Test Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Provider</th>
                <th className="text-left py-2">Test Credential</th>
                <th className="text-left py-2">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr><td className="py-2">Stripe</td><td className="font-mono text-xs">4242 4242 4242 4242</td><td>Success</td></tr>
              <tr><td className="py-2">Stripe</td><td className="font-mono text-xs">4000 0000 0000 0002</td><td>Declined</td></tr>
              <tr><td className="py-2">MTN MoMo</td><td className="font-mono text-xs">+237670000001</td><td>Success</td></tr>
              <tr><td className="py-2">Orange MoMo</td><td className="font-mono text-xs">+237690000001</td><td>Success</td></tr>
              <tr><td className="py-2">PayPal</td><td className="font-mono text-xs">test@sandbox.paypal.com</td><td>Success</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Webhook Testing */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Testing Webhooks</h2>
        <p className="text-muted-foreground">
          Use a tool like <strong>ngrok</strong> or <strong>webhook.site</strong> to receive test webhooks:
        </p>
        <CodeBlock
          title="Register Test Webhook"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-client-webhooks \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "register",
    "client_id": "sandbox_client",
    "url": "https://webhook.site/your-unique-id",
    "events": ["remittance.transfer.created", "remittance.payin.succeeded", "remittance.transfer.completed"]
  }'`
          }]}
        />
      </div>
    </div>
  );
}
