import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, Wallet, CreditCard, Smartphone, Building2, ArrowRight } from "lucide-react";
import { DocNavigation } from "@/components/developer/DocNavigation";

const FundingIntentsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Funding Intents API — Add Money | Kang Open Banking" description="Fund KOB accounts via Mobile Money, Card (Stripe), PayPal, or Bank Transfer using the unified Funding Intents API." />
    <div>
      <Badge variant="outline" className="mb-2">Account Funding</Badge>
      <h1 className="text-3xl font-bold">Funding Intents API</h1>
      <p className="text-muted-foreground mt-2">
        A unified, provider-agnostic API for adding money to KOB accounts. Supports Mobile Money (Flutterwave), Card (Stripe), PayPal, and Bank Transfer with full lifecycle tracking, idempotency, and webhook-based finalization.
      </p>
    </div>

    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>
        All endpoints require user authentication via Bearer token. Write operations accept an <code>Idempotency-Key</code> header for replay safety. Funding is finalized via provider webhooks — the account balance is credited automatically on success.
      </AlertDescription>
    </Alert>

    {/* Status Lifecycle */}
    <Card>
      <CardHeader>
        <CardTitle>Funding Intent Lifecycle</CardTitle>
        <CardDescription>Status transitions from creation to completion</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
          <p>created → pending_provider → succeeded</p>
          <p>created → pending_customer_action → succeeded (redirect-based: Stripe, PayPal)</p>
          <p>created → pending_verification → succeeded (bank transfer)</p>
          <p>any non-final → failed</p>
          <p>any non-final → cancelled (user-initiated)</p>
          <p>any non-final → expired (auto after 24h via reconciliation)</p>
        </div>
      </CardContent>
    </Card>

    {/* Create Funding Intent */}
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Create Funding Intent</h2>
      </div>

      <ApiEndpoint method="POST" endpoint="/v1/gateway/create-funding-intent" description="Initiate funding of a KOB account. Routes to the appropriate provider based on method."
        requestBody={JSON.stringify({ amount: 50000, currency: "XAF", method: "mobile_money", account_id: "acc-uuid", customer: { phone: "237677123456" }, return_url: "https://myapp.com/callback" }, null, 2)}
        response={JSON.stringify({ id: "fi-uuid", account_id: "acc-uuid", amount: 50000, currency: "XAF", method: "mobile_money", provider: "flutterwave", status: "pending_customer_action", fee_amount: 1250, net_amount: 48750, reference: "fi_acc12345_1709001234567", next_action: { type: "redirect", redirect_url: "https://checkout.flutterwave.com/..." }, created_at: "2026-02-27T10:00:00Z", expires_at: "2026-03-01T10:00:00Z" }, null, 2)}
        parameters={[
          { name: "amount", type: "number", required: true, description: "Amount to fund" },
          { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
          { name: "method", type: "string", required: true, description: "mobile_money | card | paypal | bank_transfer" },
          { name: "account_id", type: "uuid", required: true, description: "Target KOB account to credit" },
          { name: "customer.phone", type: "string", required: false, description: "Required for mobile_money" },
          { name: "customer.email", type: "string", required: false, description: "Required for card/paypal" },
          { name: "return_url", type: "string", required: false, description: "Redirect URL after provider action" },
          { name: "metadata", type: "object", required: false, description: "Custom metadata" },
        ]}
      />
    </div>

    {/* Provider-Specific Flows */}
    <Tabs defaultValue="momo">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="momo" className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> MoMo</TabsTrigger>
        <TabsTrigger value="card" className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Card</TabsTrigger>
        <TabsTrigger value="paypal" className="flex items-center gap-1"><Wallet className="h-3 w-3" /> PayPal</TabsTrigger>
        <TabsTrigger value="bank" className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Bank</TabsTrigger>
      </TabsList>

      <TabsContent value="momo" className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Mobile Money (Flutterwave)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">1. Create intent with <code>method: "mobile_money"</code> and <code>customer.phone</code></p>
            <p className="text-sm text-muted-foreground">2. User receives USSD prompt or is redirected to MoMo approval page</p>
            <p className="text-sm text-muted-foreground">3. Flutterwave webhook fires → account auto-credited</p>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X POST "https://api.kangopenbanking.com/functions/v1/gateway-create-funding-intent" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"amount":50000,"method":"mobile_money","account_id":"acc-uuid","customer":{"phone":"237677123456"}}'`}
            </pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="card" className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Card Payment (Stripe)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">1. Create intent with <code>method: "card"</code></p>
            <p className="text-sm text-muted-foreground">2. Response includes <code>next_action.client_secret</code> — use Stripe.js to confirm</p>
            <p className="text-sm text-muted-foreground">3. Stripe webhook <code>payment_intent.succeeded</code> → account auto-credited</p>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`// Client-side confirmation with Stripe.js
const { error } = await stripe.confirmCardPayment(intent.next_action.client_secret, {
  payment_method: { card: cardElement }
});`}
            </pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="paypal" className="space-y-4">
        <Card>
          <CardHeader><CardTitle>PayPal</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">1. Create intent with <code>method: "paypal"</code></p>
            <p className="text-sm text-muted-foreground">2. Response includes <code>next_action.approval_url</code> — redirect user to PayPal</p>
            <p className="text-sm text-muted-foreground">3. PayPal webhook <code>PAYMENT.CAPTURE.COMPLETED</code> → account auto-credited</p>
            <p className="text-sm text-muted-foreground"><strong>Note:</strong> XAF is auto-converted to EUR at the current rate for PayPal processing.</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="bank" className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Bank Transfer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">1. Create intent with <code>method: "bank_transfer"</code></p>
            <p className="text-sm text-muted-foreground">2. Response includes <code>next_action.bank_transfer_instructions</code> with account details and reference</p>
            <p className="text-sm text-muted-foreground">3. User transfers funds to the specified bank account with the unique reference</p>
            <p className="text-sm text-muted-foreground">4. Admin verifies receipt → account credited within 24-48h</p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    {/* Get / List / Cancel */}
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Manage Funding Intents</h2>

      <ApiEndpoint method="GET" endpoint="/v1/gateway/get-funding-intent?id={id}" description="Retrieve a single funding intent with its event history."
        response={JSON.stringify({ id: "fi-uuid", status: "succeeded", amount: 50000, events: [{ event_type: "created" }, { event_type: "webhook_succeeded" }] }, null, 2)}
        parameters={[
          { name: "id", type: "uuid", required: true, description: "Funding intent ID" },
          { name: "account_id", type: "uuid", required: false, description: "Filter by account" },
        ]}
      />

      <ApiEndpoint method="GET" endpoint="/v1/gateway/list-funding-intents" description="List funding intents with filters and pagination."
        response={JSON.stringify({ data: [{ id: "fi-uuid", status: "succeeded", amount: 50000 }], total: 1, limit: 25, offset: 0 }, null, 2)}
        parameters={[
          { name: "account_id", type: "uuid", required: false, description: "Filter by account" },
          { name: "status", type: "string", required: false, description: "Filter by status" },
          { name: "from", type: "datetime", required: false, description: "Start date filter" },
          { name: "to", type: "datetime", required: false, description: "End date filter" },
          { name: "limit", type: "number", required: false, description: "Page size (default 25)" },
          { name: "offset", type: "number", required: false, description: "Offset (default 0)" },
        ]}
      />

      <ApiEndpoint method="POST" endpoint="/v1/gateway/cancel-funding-intent" description="Cancel a non-final funding intent. Idempotent."
        requestBody={JSON.stringify({ id: "fi-uuid" }, null, 2)}
        response={JSON.stringify({ id: "fi-uuid", status: "cancelled" }, null, 2)}
        parameters={[
          { name: "id", type: "uuid", required: true, description: "Funding intent ID" },
        ]}
      />
    </div>

    {/* Webhook Finalization */}
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle>Webhook Finalization</CardTitle>
        <CardDescription>How funding intents are completed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p><strong>Flutterwave:</strong> <code>gateway-webhook-flutterwave</code> matches intent by <code>reference</code> (tx_ref) → credits account on success</p>
        <p><strong>Stripe:</strong> <code>gateway-webhook-stripe</code> matches intent by <code>provider_reference</code> (PaymentIntent ID) → credits account on success</p>
        <p><strong>PayPal:</strong> <code>gateway-webhook-paypal</code> handles <code>CHECKOUT.ORDER.APPROVED</code> (auto-captures) and <code>PAYMENT.CAPTURE.COMPLETED</code> → credits account</p>
        <p><strong>Bank Transfer:</strong> Verified manually or via bank statement matching → admin marks intent succeeded</p>
        <p className="mt-2"><strong>Reconciliation:</strong> A background job polls provider APIs every 15 minutes for stuck intents (&gt;30 min). Intents older than 24h are auto-expired.</p>
      </CardContent>
    </Card>

    {/* Fee Schedule */}
    <Card>
      <CardHeader>
        <CardTitle>Fee Schedule</CardTitle>
        <CardDescription>Fees by funding method</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="space-y-1"><p className="font-semibold">Mobile Money</p><p className="text-muted-foreground">2.5% + 0 XAF</p></div>
          <div className="space-y-1"><p className="font-semibold">Card</p><p className="text-muted-foreground">3.5% + 100 XAF</p></div>
          <div className="space-y-1"><p className="font-semibold">PayPal</p><p className="text-muted-foreground">3.5% + 150 XAF</p></div>
          <div className="space-y-1"><p className="font-semibold">Bank Transfer</p><p className="text-muted-foreground">2% + 75 XAF</p></div>
        </div>
      </CardContent>
    </Card>

    {/* Error Codes */}
    <Card>
      <CardHeader>
        <CardTitle>Error Codes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><code>invalid_amount</code><span className="text-muted-foreground">Amount must be &gt; 0</span></div>
          <div className="flex justify-between"><code>invalid_method</code><span className="text-muted-foreground">Must be mobile_money, card, paypal, or bank_transfer</span></div>
          <div className="flex justify-between"><code>missing_account_id</code><span className="text-muted-foreground">account_id is required</span></div>
          <div className="flex justify-between"><code>account_not_found</code><span className="text-muted-foreground">Account doesn't exist or isn't owned by user</span></div>
          <div className="flex justify-between"><code>already_final</code><span className="text-muted-foreground">Intent is already in a terminal state</span></div>
        </div>
      </CardContent>
    </Card>

    <DocNavigation
      previousPage={{ title: "Account Funding (Legacy)", path: "/developer/gateway/funding" }}
      nextPage={{ title: "Payouts API", path: "/developer/gateway/payouts" }}
    />
  </div>
);

export default FundingIntentsGuide;
