import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const GatewayFundingGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Account Funding & Withdrawals API | Kang Open Banking" description="Add funds to KOB accounts and withdraw to external banks via Mobile Money, Card, and Bank Transfer." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Account Funding & Withdrawals (Legacy)</h1>
      <p className="text-muted-foreground mt-2">Add funds to KOB accounts via Mobile Money (MTN/Orange), Card (Stripe), or Bank Transfer (Flutterwave). Withdraw from KOB accounts to any external bank.</p>
      <Alert className="mt-3">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Recommended:</strong> Use the new <a href="/developer/gateway/funding-intents" className="text-primary underline font-semibold">Funding Intents API</a> for full lifecycle tracking, idempotency, PayPal support, and webhook-based finalization. This endpoint remains available for backward compatibility.
        </AlertDescription>
      </Alert>
    </div>

    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>
        All endpoints require user authentication. Fund-account charges are auto-credited on webhook completion. Withdrawals debit immediately and reverse on failure.
      </AlertDescription>
    </Alert>

    {/* Fund Account */}
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ArrowDownToLine className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Fund Account</h2>
      </div>
      <p className="text-muted-foreground">Add funds to a user's KOB account by creating a charge via Flutterwave (Mobile Money/Bank) or Stripe (Card).</p>

      <ApiEndpoint method="POST" endpoint="/v1/gateway/fund-account" description="Initiate funding of a KOB account. Routes to Flutterwave or Stripe based on channel. Card payments return a next_action with client_secret for Stripe Elements confirmation."
        requestBody={JSON.stringify({ amount: 50000, currency: "XAF", channel: "mobile_money", account_id: "acc_uuid", source_phone: "237677123456" }, null, 2)}
        response={JSON.stringify({ id: "chg_uuid", account_id: "acc_uuid", amount: 50000, currency: "XAF", channel: "mobile_money", provider: "flutterwave", status: "processing", fee_amount: 1250, net_amount: 48750, tx_ref: "fund_acc12345_1709001234567", redirect_url: "https://checkout.flutterwave.com/...", next_action: null, created_at: "2026-02-26T10:00:00Z" }, null, 2)}
        parameters={[
          { name: "amount", type: "number", required: true, description: "Amount to fund" },
          { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
          { name: "channel", type: "string", required: true, description: "mobile_money | card | bank_transfer" },
          { name: "account_id", type: "uuid", required: true, description: "Target KOB account to credit" },
          { name: "source_phone", type: "string", required: false, description: "Required for mobile_money" },
          { name: "source_email", type: "string", required: false, description: "Required for card" },
        ]}
      />
    </div>

    {/* Card Funding Example */}
    <Card>
      <CardHeader>
        <CardTitle>Card Funding Example</CardTitle>
        <CardDescription>Fund via Stripe card payment — response includes <code>next_action.client_secret</code> for Stripe Elements confirmation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST "https://api.kangopenbanking.com/v1/gateway-fund-account" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "amount": 100000,
    "currency": "XAF",
    "channel": "card",
    "account_id": "your-account-uuid",
    "source_email": "john@example.com"
  }'`}
        </pre>
        <p className="text-sm text-muted-foreground">
          <strong>Card response:</strong> The <code>next_action</code> field will contain <code>{`{ "type": "stripe_confirm", "client_secret": "pi_xxx_secret_xxx" }`}</code>. Use this with Stripe.js <code>confirmCardPayment()</code> on the frontend.
        </p>
      </CardContent>
    </Card>

    {/* Withdraw to Bank */}
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ArrowUpFromLine className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Withdraw to Bank</h2>
      </div>
      <p className="text-muted-foreground">Withdraw funds from a KOB account to an external bank account via Flutterwave transfers. Balance is debited immediately; reversed if the payout fails.</p>

      <ApiEndpoint method="POST" endpoint="/v1/gateway/withdraw-to-bank" description="Initiate withdrawal from a KOB account to an external bank."
        requestBody={JSON.stringify({ amount: 25000, account_id: "acc_uuid", bank_code: "SGCM", account_number: "1234567890", beneficiary_name: "Jean Dupont", narration: "Salary withdrawal" }, null, 2)}
        response={JSON.stringify({ id: "pay_uuid", account_id: "acc_uuid", amount: 25000, fee_amount: 575, total_debited: 25575, currency: "XAF", channel: "bank_transfer", status: "processing", beneficiary_name: "Jean Dupont", beneficiary_account: "1234567890", beneficiary_bank: "SGCM", tx_ref: "withdraw_acc12345_1709001234567", created_at: "2026-02-26T10:05:00Z" }, null, 2)}
        parameters={[
          { name: "amount", type: "number", required: true, description: "Amount to withdraw" },
          { name: "account_id", type: "uuid", required: true, description: "Source KOB account to debit" },
          { name: "bank_code", type: "string", required: false, description: "Bank code (e.g., SGCM)" },
          { name: "account_number", type: "string", required: true, description: "Beneficiary account number" },
          { name: "beneficiary_name", type: "string", required: true, description: "Recipient name" },
          { name: "narration", type: "string", required: false, description: "Transfer narration" },
        ]}
      />
    </div>

    {/* Webhook Flow */}
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle>Webhook Lifecycle</CardTitle>
        <CardDescription>How fund-account and withdraw-to-bank are finalized</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-semibold mb-1">1. Fund Account Flow</p>
          <p className="text-sm text-muted-foreground">User initiates → Provider charge created → Provider webhook fires → <code>gateway-webhook-flutterwave</code> detects <code>metadata.fund_account: true</code> → Account balance auto-credited → Transaction recorded.</p>
        </div>
        <div>
          <p className="font-semibold mb-1">2. Withdraw to Bank Flow</p>
          <p className="text-sm text-muted-foreground">User initiates → Balance debited immediately → Flutterwave payout created → Transfer webhook fires → If successful: transaction marked as Booked. If failed: debit reversed, balance restored.</p>
        </div>
        <div>
          <p className="font-semibold mb-1">3. Fee Calculation</p>
          <p className="text-sm text-muted-foreground">Fees are dynamically resolved from the <code>fee_structures</code> table using the unified resolution engine (merchant → institution → platform). Use <code>/gateway-fee-estimate</code> to preview fees before initiating transactions.</p>
        </div>
      </CardContent>
    </Card>

    <AutoDocNavigation />
  </div>
);

export default GatewayFundingGuide;
