import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, Wallet, CreditCard, Smartphone, Building2, ArrowRight, Store, Globe } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const FundingIntentsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Funding Intents API — Add Money | Kang Open Banking" description="Fund KOB accounts via Mobile Money, Card (Stripe), PayPal, or Bank Transfer using the unified Funding Intents API. Supports end-users, merchants, institutions, and external API consumers." />
    <div>
      <Badge variant="outline" className="mb-2">Account Funding</Badge>
      <h1 className="text-3xl font-bold">Funding Intents API</h1>
      <p className="text-muted-foreground mt-2">
        A unified, provider-agnostic API for adding money to KOB accounts and merchant wallets. Supports Mobile Money (Flutterwave), Card (Stripe), PayPal, and Bank Transfer with full lifecycle tracking, idempotency, and webhook-based finalization.
      </p>
    </div>

    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>
        Endpoints accept user JWT tokens (end-user, merchant, institution) or OAuth access tokens (external API). Write operations accept an <code>Idempotency-Key</code> header for replay safety. Funding is finalized via provider webhooks.
      </AlertDescription>
    </Alert>

    {/* Consumer Types */}
    <Card>
      <CardHeader>
        <CardTitle>Consumer Types (funding_scope)</CardTitle>
        <CardDescription>Four distinct consumer types can create funding intents</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="end_user">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="end_user" className="flex items-center gap-1"><Wallet className="h-3 w-3" /> End User</TabsTrigger>
            <TabsTrigger value="merchant" className="flex items-center gap-1"><Store className="h-3 w-3" /> Merchant</TabsTrigger>
            <TabsTrigger value="institution" className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Institution</TabsTrigger>
            <TabsTrigger value="external_api" className="flex items-center gap-1"><Globe className="h-3 w-3" /> External API</TabsTrigger>
          </TabsList>

          <TabsContent value="end_user" className="space-y-3 mt-4">
            <p className="text-sm"><strong>Scope:</strong> <code>end_user</code> (default)</p>
            <p className="text-sm text-muted-foreground">End-users fund their own KOB banking accounts. The API validates that <code>account.user_id</code> matches the authenticated user.</p>
            <p className="text-sm text-muted-foreground"><strong>Auth:</strong> Bearer JWT token</p>
            <p className="text-sm text-muted-foreground"><strong>Credits:</strong> <code>account_balances</code></p>
            <p className="text-sm text-muted-foreground"><strong>Fees:</strong> Dynamically resolved from <code>fee_structures</code> (platform scope). Use <code>/gateway-fee-estimate?amount=X&channel=mobile_money</code> to preview.</p>
          </TabsContent>

          <TabsContent value="merchant" className="space-y-3 mt-4">
            <p className="text-sm"><strong>Scope:</strong> <code>merchant</code></p>
            <p className="text-sm text-muted-foreground">Merchants fund their gateway wallet balance. Requires <code>merchant_id</code> and validates ownership via <code>gateway_merchants.user_id</code>.</p>
            <p className="text-sm text-muted-foreground"><strong>Auth:</strong> Bearer JWT token (merchant user)</p>
            <p className="text-sm text-muted-foreground"><strong>Credits:</strong> <code>gateway_merchant_wallets</code> (available_balance)</p>
            <p className="text-sm text-muted-foreground"><strong>Fees:</strong> Merchant-scope fees from <code>fee_structures</code>. Use <code>/gateway-fee-estimate?amount=X&channel=mobile_money&merchant_id=UUID</code> to preview.</p>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "amount": 500000,
  "method": "mobile_money",
  "funding_scope": "merchant",
  "merchant_id": "merchant-uuid",
  "customer": { "phone": "237677123456" }
}`}
            </pre>
          </TabsContent>

          <TabsContent value="institution" className="space-y-3 mt-4">
            <p className="text-sm"><strong>Scope:</strong> <code>institution</code></p>
            <p className="text-sm text-muted-foreground">Institution owners or staff fund internal clearing/float accounts. Validates ownership via <code>institutions.user_id</code> or <code>staff_assignments</code>.</p>
            <p className="text-sm text-muted-foreground"><strong>Auth:</strong> Bearer JWT token (institution owner or staff)</p>
            <p className="text-sm text-muted-foreground"><strong>Credits:</strong> <code>account_balances</code> (institution-scoped account)</p>
            <p className="text-sm text-muted-foreground"><strong>Fees:</strong> Institution-scope fees from <code>fee_structures</code>. Use <code>/gateway-fee-estimate?amount=X&channel=bank_transfer&institution_id=UUID</code> to preview.</p>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "amount": 1000000,
  "method": "bank_transfer",
  "funding_scope": "institution",
  "account_id": "float-account-uuid",
  "target_description": "Float account top-up Q1 2026"
}`}
            </pre>
          </TabsContent>

          <TabsContent value="external_api" className="space-y-3 mt-4">
            <p className="text-sm"><strong>Scope:</strong> <code>external_api</code></p>
            <p className="text-sm text-muted-foreground">External fintech apps credit a customer's KOB account after successful payment. Uses OAuth <code>client_credentials</code> grant — no user JWT needed.</p>
            <p className="text-sm text-muted-foreground"><strong>Auth:</strong> OAuth access_token (from <code>/oauth/token</code> with <code>grant_type=client_credentials</code>)</p>
            <p className="text-sm text-muted-foreground"><strong>Credits:</strong> <code>account_balances</code> (customer account within institution scope)</p>
            <p className="text-sm text-muted-foreground"><strong>Fees:</strong> Institution-scope fees from <code>fee_structures</code>.</p>

            <Card className="bg-muted/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Step 1: Get access token</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-sm overflow-x-auto">
{`curl -X POST "https://api.kangopenbanking.com/v1/oauth-token" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "scope=funding:write"

# Response: { "access_token": "...", "token_type": "Bearer", "expires_in": 3600 }`}
                </pre>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Step 2: Create funding intent</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-sm overflow-x-auto">
{`curl -X POST "https://api.kangopenbanking.com/v1/gateway-create-funding-intent" \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "amount": 25000,
    "method": "mobile_money",
    "funding_scope": "external_api",
    "account_id": "customer-account-uuid",
    "customer": { "phone": "237677123456" }
  }'`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

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

      <ApiEndpoint method="POST" endpoint="/v1/gateway/create-funding-intent" description="Initiate funding. Routes to appropriate provider based on method and credits the target based on funding_scope."
        requestBody={JSON.stringify({ amount: 50000, currency: "XAF", method: "mobile_money", account_id: "acc-uuid", funding_scope: "end_user", customer: { phone: "237677123456" }, return_url: "https://myapp.com/callback" }, null, 2)}
        response={JSON.stringify({ id: "fi-uuid", account_id: "acc-uuid", amount: 50000, currency: "XAF", method: "mobile_money", provider: "flutterwave", status: "pending_customer_action", fee_amount: 1250, net_amount: 48750, funding_scope: "end_user", reference: "fi_acc12345_1709001234567", next_action: { type: "redirect", redirect_url: "https://checkout.flutterwave.com/..." }, created_at: "2026-02-27T10:00:00Z", expires_at: "2026-03-01T10:00:00Z" }, null, 2)}
        parameters={[
          { name: "amount", type: "number", required: true, description: "Amount to fund" },
          { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
          { name: "method", type: "string", required: true, description: "mobile_money | card | paypal | bank_transfer" },
          { name: "funding_scope", type: "string", required: false, description: "end_user (default) | merchant | institution | external_api" },
          { name: "account_id", type: "uuid", required: false, description: "Target KOB account (required for end_user, institution, external_api)" },
          { name: "merchant_id", type: "uuid", required: false, description: "Required for merchant scope" },
          { name: "target_description", type: "string", required: false, description: "Human-readable label" },
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
            <p className="text-sm text-muted-foreground">3. Flutterwave webhook fires → target auto-credited based on scope</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="card" className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Card Payment (Stripe)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">1. Create intent with <code>method: "card"</code></p>
            <p className="text-sm text-muted-foreground">2. Response includes <code>next_action.client_secret</code> — use Stripe.js to confirm</p>
            <p className="text-sm text-muted-foreground">3. Stripe webhook <code>payment_intent.succeeded</code> → target auto-credited based on scope</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="paypal" className="space-y-4">
        <Card>
          <CardHeader><CardTitle>PayPal</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">1. Create intent with <code>method: "paypal"</code></p>
            <p className="text-sm text-muted-foreground">2. Redirect user to PayPal approval URL</p>
            <p className="text-sm text-muted-foreground">3. PayPal webhook <code>PAYMENT.CAPTURE.COMPLETED</code> → target auto-credited</p>
            <p className="text-sm text-muted-foreground"><strong>Note:</strong> XAF auto-converted to EUR at current rate.</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="bank" className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Bank Transfer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">1. Create intent with <code>method: "bank_transfer"</code></p>
            <p className="text-sm text-muted-foreground">2. Response includes bank account details and unique reference</p>
            <p className="text-sm text-muted-foreground">3. Admin verifies receipt → target credited within 24-48h</p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    {/* Get / List / Cancel */}
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Manage Funding Intents</h2>

      <ApiEndpoint method="GET" endpoint="/v1/gateway/get-funding-intent?id={id}" description="Retrieve a single funding intent with its event history."
        response={JSON.stringify({ id: "fi-uuid", status: "succeeded", amount: 50000, funding_scope: "end_user", events: [{ event_type: "created" }, { event_type: "webhook_succeeded" }] }, null, 2)}
        parameters={[
          { name: "id", type: "uuid", required: true, description: "Funding intent ID" },
          { name: "account_id", type: "uuid", required: false, description: "Filter by account" },
        ]}
      />

      <ApiEndpoint method="GET" endpoint="/v1/gateway/list-funding-intents" description="List funding intents with filters and pagination."
        response={JSON.stringify({ data: [{ id: "fi-uuid", status: "succeeded", amount: 50000, funding_scope: "merchant" }], total: 1, limit: 25, offset: 0 }, null, 2)}
        parameters={[
          { name: "account_id", type: "uuid", required: false, description: "Filter by account" },
          { name: "funding_scope", type: "string", required: false, description: "Filter by scope" },
          { name: "status", type: "string", required: false, description: "Filter by status" },
          { name: "limit", type: "number", required: false, description: "Page size (default 25)" },
          { name: "offset", type: "number", required: false, description: "Offset (default 0)" },
        ]}
      />

      <ApiEndpoint method="POST" endpoint="/v1/gateway/cancel-funding-intent" description="Cancel a non-final funding intent. Idempotent."
        requestBody={JSON.stringify({ id: "fi-uuid" }, null, 2)}
        response={JSON.stringify({ id: "fi-uuid", status: "cancelled" }, null, 2)}
        parameters={[{ name: "id", type: "uuid", required: true, description: "Funding intent ID" }]}
      />
    </div>

    {/* Webhook Finalization */}
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle>Scope-Aware Webhook Finalization</CardTitle>
        <CardDescription>How funding intents are credited based on consumer type</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p><strong>end_user / institution / external_api:</strong> Credits <code>account_balances</code> + creates <code>transactions</code> record</p>
        <p><strong>merchant:</strong> Credits <code>gateway_merchant_wallets.available_balance</code> via <code>update_merchant_wallet()</code></p>
        <p className="mt-2"><strong>Reconciliation:</strong> Background job polls providers every 15 minutes. Intents older than 24h are auto-expired.</p>
      </CardContent>
    </Card>

    {/* Fee Schedule */}
    <Card>
      <CardHeader>
        <CardTitle>Fee Schedule by Scope</CardTitle>
        <CardDescription>Fees are dynamically resolved from the <code>fee_structures</code> table (merchant → institution → platform fallback). Use the <code>/gateway-fee-estimate</code> API to preview real-time fees.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-semibold mb-2">End User (Platform Scope)</p>
          <p className="text-sm text-muted-foreground">Fees configured in the admin Fee Management panel under <strong>platform</strong> scope. Varies by payment method.</p>
        </div>
        <div>
          <p className="font-semibold mb-2">Merchant</p>
          <p className="text-sm text-muted-foreground">Merchant-scope overrides in <strong>fee_structures</strong>. Falls back to platform scope if no merchant-specific entry exists.</p>
        </div>
        <div>
          <p className="font-semibold mb-2">Institution / External API</p>
          <p className="text-sm text-muted-foreground">Institution-scope overrides in <strong>fee_structures</strong>. Falls back to platform scope if no institution-specific entry exists.</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <strong>Preview API:</strong> <code>GET /gateway-fee-estimate?amount=10000&channel=mobile_money&merchant_id=UUID&institution_id=UUID</code>
        </div>
      </CardContent>
    </Card>

    {/* Error Codes */}
    <Card>
      <CardHeader><CardTitle>Error Codes</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><code>invalid_amount</code><span className="text-muted-foreground">Amount must be &gt; 0</span></div>
          <div className="flex justify-between"><code>invalid_method</code><span className="text-muted-foreground">Must be mobile_money, card, paypal, or bank_transfer</span></div>
          <div className="flex justify-between"><code>invalid_funding_scope</code><span className="text-muted-foreground">Must be end_user, merchant, institution, or external_api</span></div>
          <div className="flex justify-between"><code>missing_account_id</code><span className="text-muted-foreground">Required for end_user, institution, external_api</span></div>
          <div className="flex justify-between"><code>missing_merchant_id</code><span className="text-muted-foreground">Required for merchant scope</span></div>
          <div className="flex justify-between"><code>account_not_found</code><span className="text-muted-foreground">Account doesn't exist or access denied</span></div>
          <div className="flex justify-between"><code>merchant_not_found</code><span className="text-muted-foreground">Merchant doesn't exist or not owned by user</span></div>
          <div className="flex justify-between"><code>insufficient_scope</code><span className="text-muted-foreground">OAuth token missing funding:write scope</span></div>
          <div className="flex justify-between"><code>no_institution_mapping</code><span className="text-muted-foreground">API client not linked to an institution</span></div>
        </div>
      </CardContent>
    </Card>

    <AutoDocNavigation />
  </div>
);

export default FundingIntentsGuide;
