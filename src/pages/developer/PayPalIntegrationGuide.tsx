import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ArrowRight, Shield, Wallet, Globe } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const PayPalIntegrationGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="PayPal Integration Guide | Kang Open Banking" description="Send payouts and withdraw to PayPal accounts. Supports batch payouts, webhook events, and OAuth2 authentication." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway — PayPal</Badge>
      <h1 className="text-3xl font-bold">PayPal Integration Guide</h1>
      <p className="text-muted-foreground mt-2">
        Send payouts to PayPal recipients, withdraw KOB account balances to PayPal, and receive real-time webhook events — all through the unified gateway API.
      </p>
    </div>

    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>
        <strong>Currency Note:</strong> PayPal does not directly support XAF. Payouts must use PayPal-supported currencies (USD, EUR, GBP). Use the <code className="bg-muted px-1 rounded">/v1/gateway/exchange-rate</code> endpoint for conversion before initiating PayPal payouts.
      </AlertDescription>
    </Alert>

    {/* Overview */}
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> PayPal Capabilities</CardTitle></CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-3 border rounded-lg">
            <Badge variant="outline" className="mb-2">Payouts</Badge>
            <p className="text-sm text-muted-foreground">Send money to any PayPal user via email, phone, or PayPal ID. Supports batch payouts up to 15,000 items.</p>
          </div>
          <div className="p-3 border rounded-lg">
            <Badge variant="outline" className="mb-2">Withdrawals</Badge>
            <p className="text-sm text-muted-foreground">Withdraw KOB account balance to a PayPal email address. Automatic reversal on failure.</p>
          </div>
          <div className="p-3 border rounded-lg">
            <Badge variant="outline" className="mb-2">Webhooks</Badge>
            <p className="text-sm text-muted-foreground">Real-time event notifications for payout success, failure, and status changes with signature verification.</p>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Authentication */}
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Shield className="h-5 w-5" /> Authentication</h2>
      <p className="text-muted-foreground mb-4">
        PayPal integration uses OAuth2 client_credentials flow. Credentials are managed server-side — you don't need to handle PayPal tokens directly. All endpoints use standard KOB Bearer authentication.
      </p>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm mb-2 font-medium">Internal OAuth2 Token Flow (handled automatically):</p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm"><code>{`POST https://api-m.paypal.com/v1/oauth2/token
Authorization: Basic {base64(client_id:client_secret)}
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials

→ { "access_token": "...", "expires_in": 32400 }`}</code></pre>
          <p className="text-xs text-muted-foreground mt-2">Tokens are cached and auto-refreshed with a 5-minute safety buffer before expiry.</p>
        </CardContent>
      </Card>
    </div>

    {/* Create PayPal Payout */}
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Wallet className="h-5 w-5" /> PayPal Payouts</h2>
      <ApiEndpoint method="POST" endpoint="/v1/gateway/payouts/paypal" description="Create a PayPal payout to send money to a recipient."
        requestBody={JSON.stringify({
          merchant_id: "mch_uuid",
          amount: 5000,
          currency: "USD",
          recipient_type: "EMAIL",
          receiver: "recipient@example.com",
          note: "Invoice payment",
          tx_ref: "paypal_pay_001"
        }, null, 2)}
        response={JSON.stringify({
          id: "payout_uuid",
          batch_id: "PP-BATCH-123",
          status: "processing",
          provider: "paypal",
          amount: 5000,
          currency: "USD",
          fee_amount: 325,
          net_amount: 4675,
          recipient_type: "EMAIL",
          receiver: "recipient@example.com",
          tx_ref: "paypal_pay_001"
        }, null, 2)}
        parameters={[
          { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
          { name: "amount", type: "number", required: true, description: "Amount in smallest currency unit (cents)" },
          { name: "currency", type: "string", required: true, description: "ISO 4217 currency (USD, EUR, GBP — not XAF)" },
          { name: "recipient_type", type: "string", required: true, description: "EMAIL, PHONE, or PAYPAL_ID" },
          { name: "receiver", type: "string", required: true, description: "Recipient identifier (email, phone, or PayPal ID)" },
          { name: "note", type: "string", required: false, description: "Note to recipient" },
          { name: "tx_ref", type: "string", required: true, description: "Your unique transaction reference" },
        ]}
      />
    </div>

    {/* Withdraw to PayPal */}
    <div>
      <h2 className="text-2xl font-bold mb-4">Withdraw to PayPal</h2>
      <p className="text-muted-foreground mb-4">
        Withdraw from a KOB account to a PayPal email. The account is debited immediately; on webhook failure, the debit is automatically reversed.
      </p>
      <ApiEndpoint method="POST" endpoint="/v1/gateway/withdraw-to-paypal" description="Withdraw KOB balance to a PayPal account."
        requestBody={JSON.stringify({
          amount: 10000,
          account_id: "uuid-of-kob-account",
          paypal_email: "user@example.com",
          currency: "USD",
          narration: "Balance withdrawal"
        }, null, 2)}
        response={JSON.stringify({
          id: "withdrawal_uuid",
          amount: 10000,
          fee_amount: 500,
          total_debited: 10500,
          currency: "USD",
          status: "processing",
          paypal_email: "user@example.com",
          batch_id: "PP-BATCH-456",
          tx_ref: "WD-PP-xxx"
        }, null, 2)}
        parameters={[
          { name: "amount", type: "number", required: true, description: "Withdrawal amount in smallest unit" },
          { name: "account_id", type: "uuid", required: true, description: "KOB account to debit" },
          { name: "paypal_email", type: "string", required: true, description: "PayPal recipient email" },
          { name: "currency", type: "string", required: false, description: "Currency (default: USD)" },
          { name: "narration", type: "string", required: false, description: "Withdrawal description" },
        ]}
      />
    </div>

    {/* Webhook Events */}
    <Card>
      <CardHeader><CardTitle>PayPal Webhook Events</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2">PayPal Event</th><th className="text-left py-2">KOB Status</th><th className="text-left py-2">Description</th></tr></thead>
            <tbody>
              {[
                ["PAYMENT.PAYOUTS-ITEM.SUCCEEDED", "successful", "Payout was delivered to recipient"],
                ["PAYMENT.PAYOUTS-ITEM.FAILED", "failed", "Payout failed — funds returned"],
                ["PAYMENT.PAYOUTS-ITEM.BLOCKED", "failed", "Payout blocked by PayPal risk"],
                ["PAYMENT.PAYOUTS-ITEM.UNCLAIMED", "pending", "Recipient hasn't claimed the payout"],
                ["PAYMENT.PAYOUTS-ITEM.RETURNED", "failed", "Payout returned — triggers debit reversal"],
                ["PAYMENT.PAYOUTS-ITEM.REFUNDED", "failed", "Payout was refunded"],
                ["PAYMENT.PAYOUTS-ITEM.REVERSED", "failed", "Payout was reversed"],
              ].map(([event, status, desc]) => (
                <tr key={event} className="border-b">
                  <td className="py-2 font-mono text-xs">{event}</td>
                  <td className="py-2"><Badge variant={status === 'successful' ? 'default' : status === 'failed' ? 'destructive' : 'secondary'}>{status}</Badge></td>
                  <td className="text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">PayPal webhook signatures are verified via the <code>POST /v1/notifications/verify-webhook-signature</code> API before processing.</p>
      </CardContent>
    </Card>

    {/* Fee Structure */}
    <Card>
      <CardHeader><CardTitle>Fee Structure</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="p-3 border rounded-lg text-center">
            <p className="text-2xl font-bold">3.5%</p>
            <p className="text-muted-foreground">Variable rate</p>
          </div>
          <div className="p-3 border rounded-lg text-center">
            <p className="text-2xl font-bold">150 XAF</p>
            <p className="text-muted-foreground">Fixed fee (~$0.25)</p>
          </div>
          <div className="p-3 border rounded-lg text-center">
            <p className="text-2xl font-bold">PayPal</p>
            <p className="text-muted-foreground">Provider fees apply separately</p>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Error Codes */}
    <Card>
      <CardHeader><CardTitle>Error Codes</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
          <Badge variant="destructive">PAYPAL_001</Badge>
          <span>Missing required fields in payout request</span>
          <Badge variant="destructive">PAYPAL_WD_001</Badge>
          <span>Missing required fields in withdrawal request</span>
          <Badge variant="destructive">PAYPAL_500</Badge>
          <span>Internal error or PayPal API failure</span>
          <Badge variant="destructive">PAYPAL_WD_500</Badge>
          <span>Withdrawal processing failure</span>
        </div>
      </CardContent>
    </Card>

    <DocNavigation
      previousPage={{ title: "Payouts", path: "/developer/gateway/payouts" }}
      nextPage={{ title: "Webhooks", path: "/developer/gateway/webhooks" }}
    />
  </div>
);

export default PayPalIntegrationGuide;
