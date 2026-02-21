import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const GatewayQuickstart = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway API Quickstart | Kang Open Banking" description="Get started with the Kang Open Banking Payment Gateway API — create charges, payouts, and handle webhooks." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Gateway API Quickstart</h1>
      <p className="text-muted-foreground mt-2">Accept payments via Mobile Money, Cards, and Bank Transfers using the unified <code>/v1/gateway/*</code> namespace.</p>
    </div>

    <Card>
      <CardHeader><CardTitle>1. Authenticate</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-muted-foreground">All Gateway endpoints require a Bearer token from OAuth 2.0 token exchange.</p>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm"><code>{`POST /v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_SECRET&scope=gateway.charges gateway.payouts`}</code></pre>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>2. Create a Merchant</CardTitle></CardHeader>
      <CardContent>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm"><code>{`POST /v1/gateway/merchants
{
  "business_name": "Acme Corp",
  "business_email": "payments@acme.cm",
  "environment": "sandbox"
}`}</code></pre>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>3. Create Your First Charge</CardTitle></CardHeader>
      <CardContent>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm"><code>{`POST /v1/gateway/charges
Idempotency-Key: unique-key-123
{
  "merchant_id": "mch_uuid",
  "amount": 5000,
  "currency": "XAF",
  "channel": "mobile_money",
  "customer_phone": "237677123456",
  "tx_ref": "order_001"
}`}</code></pre>
        <p className="mt-3 text-muted-foreground">Response returns a canonical charge object with <code>status: "processing"</code> and the provider reference.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>4. Set Up Webhooks</CardTitle></CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Configure your merchant's <code>webhook_url</code> to receive events like <code>charge.successful</code>, <code>payout.completed</code>, and <code>dispute.created</code>. All events are HMAC-SHA256 signed.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Canonical Status Mapping</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2">Provider Status</th><th className="text-left py-2">Gateway Status</th></tr></thead>
            <tbody>
              <tr className="border-b"><td className="py-2">Flutterwave: successful</td><td><Badge>successful</Badge></td></tr>
              <tr className="border-b"><td className="py-2">Flutterwave: pending</td><td><Badge variant="secondary">processing</Badge></td></tr>
              <tr className="border-b"><td className="py-2">Stripe: succeeded</td><td><Badge>successful</Badge></td></tr>
              <tr className="border-b"><td className="py-2">Stripe: requires_action</td><td><Badge variant="outline">pending</Badge></td></tr>
              <tr><td className="py-2">Stripe: canceled</td><td><Badge variant="destructive">cancelled</Badge></td></tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default GatewayQuickstart;
