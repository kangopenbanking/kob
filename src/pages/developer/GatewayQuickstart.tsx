import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { KOB_API_VERSION } from "@/config/version";

const GatewayQuickstart = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO
      title="Gateway Quickstart (10 min) | Kang Open Banking"
      description="Create a merchant, get API keys, accept your first payment, handle webhooks, and issue a refund — all in under 10 minutes."
      canonical="https://kangopenbanking.com/developer/gateway/quickstart"
      ogImage="https://kangopenbanking.com/images/og-gateway-quickstart.png"
    />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Gateway Quickstart</h1>
      <p className="text-muted-foreground mt-2">Go from zero to your first payment in under 10 minutes. This guide uses the sandbox environment with test credentials.</p>
      <p className="text-sm text-muted-foreground mt-1">Last updated: 10 April 2026 | Contact: developers@kangopenbanking.com</p>
      <p className="text-xs text-muted-foreground mt-1">Docs generated from API spec v{KOB_API_VERSION}</p>
    </div>

    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-2">📋 Prerequisites</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>A KOB developer account (<a href="/auth" className="text-primary underline">Sign up</a>)</li>
          <li>Sandbox API credentials (available in your dashboard after signup)</li>
          <li><code className="bg-muted px-1 rounded">curl</code> or any HTTP client (Postman, Insomnia)</li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Step 1 — Authenticate</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Exchange your sandbox client credentials for a Bearer token.</p>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs"><code>{`curl -X POST https://api.kangopenbanking.com/v1/oauth-token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials\\
&client_id=sb_client_test_cm_001\\
&client_secret=sb_secret_test_cm_001\\
&scope=gateway.charges gateway.payouts gateway.merchants"

# Response
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "gateway.charges gateway.payouts gateway.merchants"
}`}</code></pre>
        <p className="text-xs text-muted-foreground">💡 Save the <code className="bg-muted px-1 rounded">access_token</code> — you'll use it for all subsequent requests.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Step 2 — Create a Merchant</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs"><code>{`curl -X POST https://api.kangopenbanking.com/v1/gateway-merchant-router \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: onboard-acme-001" \\
  -d '{
    "business_name": "Acme Cameroun SARL",
    "business_email": "payments@acme.cm",
    "country": "CM",
    "currency": "XAF",
    "environment": "sandbox"
  }'

# Response
{
  "id": "6f3d0f4c-9f4f-4d71-8f2e-3b45f7f2a1c9",
  "business_name": "Acme Cameroun SARL",
  "status": "active",
  "environment": "sandbox",
  "created_at": "2026-03-22T10:00:00Z"
}`}</code></pre>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Step 3 — Create Your First Charge (Mobile Money)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <CodeBlock
          title="Create a Mobile Money Charge"
          examples={[
            {
              language: "bash",
              label: "cURL",
              code: `curl -X POST https://api.kangopenbanking.com/v1/gateway-charges-router \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: charge-order-001" \\
  -d '{
    "merchant_id": "6f3d0f4c-9f4f-4d71-8f2e-3b45f7f2a1c9",
    "amount": 5000,
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237677123456",
    "tx_ref": "order_001",
    "description": "Test payment - Quickstart"
  }'`
            },
            {
              language: "javascript",
              label: "Node.js",
              code: `import { KangOpenBanking } from '@kang/openbanking-node';

const kob = new KangOpenBanking({
  apiKey: 'YOUR_TOKEN',
  environment: 'sandbox',
});

const charge = await kob.charges.create({
  merchant_id: '6f3d0f4c-9f4f-4d71-8f2e-3b45f7f2a1c9',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '+237677123456',
  tx_ref: 'order_001',
});
console.log(charge.data.id);     // "chg_test_xyz789"
console.log(charge.data.status); // "processing"`
            },
            {
              language: "python",
              label: "Python",
              code: `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(api_key="YOUR_TOKEN", environment="sandbox")

charge = kob.charges.create(
    merchant_id="6f3d0f4c-9f4f-4d71-8f2e-3b45f7f2a1c9",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="+237677123456",
    tx_ref="order_001",
)
print(charge["data"]["id"])     # "chg_test_xyz789"
print(charge["data"]["status"]) # "processing"`
            },
            {
              language: "go",
              label: "Go",
              code: `body, _ := json.Marshal(map[string]interface{}{
    "merchant_id":    "6f3d0f4c-9f4f-4d71-8f2e-3b45f7f2a1c9",
    "amount":         5000,
    "currency":       "XAF",
    "channel":        "mobile_money",
    "customer_phone": "+237677123456",
    "tx_ref":         "order_001",
})
req, _ := http.NewRequest("POST",
    "https://api.kangopenbanking.com/v1/gateway-charges-router",
    bytes.NewBuffer(body))
req.Header.Set("Authorization", "Bearer YOUR_TOKEN")
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Idempotency-Key", "charge-order-001")
resp, _ := http.DefaultClient.Do(req)`
            },
            {
              language: "java",
              label: "Java",
              code: `String body = """
    {"merchant_id":"6f3d0f4c-9f4f-4d71-8f2e-3b45f7f2a1c9","amount":5000,
     "currency":"XAF","channel":"mobile_money",
     "customer_phone":"+237677123456",
     "tx_ref":"order_001"}""";

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.kangopenbanking.com/v1/gateway-charges-router"))
    .header("Authorization", "Bearer YOUR_TOKEN")
    .header("Content-Type", "application/json")
    .header("Idempotency-Key", "charge-order-001")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();

HttpResponse<String> response = HttpClient.newHttpClient()
    .send(request, HttpResponse.BodyHandlers.ofString());`
            }
          ]}
        />
        <p className="text-xs text-muted-foreground">In sandbox mode, Mobile Money charges auto-complete within seconds. In production, the customer receives a USSD/STK push on their phone.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Step 4 — Verify the Charge</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs"><code>{`curl -X POST https://api.kangopenbanking.com/v1/gateway-charges-router?action=verify_charge&charge_id=chg_test_xyz789 \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Response
{
  "id": "chg_test_xyz789",
  "status": "successful",
  "verified_at": "2026-03-22T10:00:05Z",
  "amount": 5000,
  "currency": "XAF",
  "provider": "flutterwave"
}`}</code></pre>
        <p className="text-xs text-muted-foreground">✅ <strong>Best practice</strong>: Don't rely only on polling — set up a webhook (Step 5) so KOB pushes the final status to you.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Step 5 — Handle the Webhook</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Register a webhook URL and KOB will POST events like <code className="bg-muted px-1 rounded">charge.successful</code> to your server in real time.</p>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs"><code>{`# Register webhook
curl -X POST https://api.kangopenbanking.com/v1/gateway-webhooks-router \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "merchant_id": "6f3d0f4c-9f4f-4d71-8f2e-3b45f7f2a1c9",
    "url": "https://yourapp.com/webhooks/kob",
    "events": ["charge.successful", "charge.failed", "payout.completed"],
    "active": true
  }'

# You'll receive events like:
POST https://yourapp.com/webhooks/kob
X-KOB-Signature: hmac_sha256=a1b2c3...
X-KOB-Timestamp: 1711100000
{
  "event_type": "charge.successful",
  "event_id": "evt_abc123",
  "data": { "id": "chg_test_xyz789", "status": "successful", ... }
}`}</code></pre>
        <p className="text-xs text-muted-foreground">See the full <a href="/developer/gateway/webhooks" className="text-primary underline">Webhook Guide</a> for signature verification code in Node.js, Python, and PHP.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Step 6 — Issue a Refund</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs"><code>{`curl -X POST https://api.kangopenbanking.com/v1/gateway-create-refund \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: refund-order-001" \\
  -d '{
    "charge_id": "chg_test_xyz789",
    "amount": 5000,
    "reason": "customer_request"
  }'

# Response
{
  "id": "ref_test_456",
  "charge_id": "chg_test_xyz789",
  "amount": 5000,
  "currency": "XAF",
  "status": "processing"
}`}</code></pre>
      </CardContent>
    </Card>

    <Separator />

    <Card>
      <CardHeader><CardTitle>Sandbox Test Values</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">Mobile Money (Cameroon)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2">Phone</th><th className="text-left py-2">Result</th></tr></thead>
                <tbody>
                  <tr className="border-b"><td className="py-2 font-mono text-xs">+237677000001</td><td><Badge>successful</Badge></td></tr>
                  <tr className="border-b"><td className="py-2 font-mono text-xs">+237677000002</td><td><Badge variant="destructive">failed</Badge></td></tr>
                  <tr><td className="py-2 font-mono text-xs">+237677000003</td><td><Badge variant="secondary">processing (stays pending 60s)</Badge></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">Test Cards</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2">Card Number</th><th className="text-left py-2">Expiry</th><th className="text-left py-2">CVV</th><th className="text-left py-2">Result</th></tr></thead>
                <tbody>
                  <tr className="border-b"><td className="py-2 font-mono text-xs">4242 4242 4242 4242</td><td className="py-2 text-xs">12/28</td><td className="py-2 text-xs">123</td><td><Badge>successful</Badge></td></tr>
                  <tr className="border-b"><td className="py-2 font-mono text-xs">4000 0000 0000 0002</td><td className="py-2 text-xs">12/28</td><td className="py-2 text-xs">123</td><td><Badge variant="destructive">declined</Badge></td></tr>
                  <tr><td className="py-2 font-mono text-xs">4000 0025 0000 3155</td><td className="py-2 text-xs">12/28</td><td className="py-2 text-xs">123</td><td><Badge variant="outline">3D Secure required</Badge></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Canonical Status Mapping</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2">Provider Status</th><th className="text-left py-2">KOB Gateway Status</th></tr></thead>
            <tbody>
              <tr className="border-b"><td className="py-2">Flutterwave: successful</td><td><Badge>successful</Badge></td></tr>
              <tr className="border-b"><td className="py-2">Flutterwave: pending</td><td><Badge variant="secondary">processing</Badge></td></tr>
              <tr className="border-b"><td className="py-2">Stripe: succeeded</td><td><Badge>successful</Badge></td></tr>
              <tr className="border-b"><td className="py-2">Stripe: requires_action</td><td><Badge variant="outline">pending</Badge></td></tr>
              <tr className="border-b"><td className="py-2">Stripe: canceled</td><td><Badge variant="destructive">cancelled</Badge></td></tr>
              <tr className="border-b"><td className="py-2">PayPal: COMPLETED</td><td><Badge>successful</Badge></td></tr>
              <tr><td className="py-2">PayPal: DENIED</td><td><Badge variant="destructive">failed</Badge></td></tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>What's Next?</CardTitle></CardHeader>
      <CardContent>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li><a href="/developer/gateway/webhooks" className="text-primary underline font-semibold">Webhook Guide</a> — Signature verification, retry policy, sample handlers in 3 languages</li>
          <li><a href="/developer/gateway/payouts" className="text-primary underline font-semibold">Payouts</a> — Disburse funds via Mobile Money or bank transfer</li>
          <li><a href="/developer/gateway/disputes" className="text-primary underline font-semibold">Disputes</a> — Handle chargebacks and evidence submission</li>
          <li><a href="/developer/gateway/settlements" className="text-primary underline font-semibold">Settlements</a> — Configure settlement schedules and accounts</li>
          <li><a href="/developer/api-explorer" className="text-primary underline font-semibold">Full API Reference</a> — Interactive explorer for all 300+ endpoints</li>
        </ul>
      </CardContent>
    </Card>

    <AutoDocNavigation />
  </div>
);

export default GatewayQuickstart;
