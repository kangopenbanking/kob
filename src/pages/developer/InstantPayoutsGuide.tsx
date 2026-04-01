import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, Info } from "lucide-react";

const InstantPayoutsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Instant Payouts API | Kang Open Banking" description="Send instant payouts via Visa Direct, Mastercard Send, mobile money, and bank transfer with intelligent rail routing, compliance screening, and treasury-backed prefunding." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Instant Payouts API</h1>
      <p className="text-muted-foreground mt-2">
        Send payouts instantly via the fastest available rail. The Instant Payout Engine supports <strong>Visa Direct</strong>, <strong>Mastercard Send</strong>, <strong>mobile money</strong>, and <strong>bank transfer</strong> — with intelligent rail routing, inline compliance screening, and treasury-backed prefunding.
      </p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        When you submit a payout, the Instant Rail Router processes it through a multi-stage pipeline — ensuring compliance, selecting the optimal rail, verifying treasury float, dispatching to the provider, and delivering webhook notifications.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Payout Processing Pipeline</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Submit Payout", "AML/Sanctions Screen", "Rail Selection", "Float Check", "Provider Dispatch", "Webhook Delivery"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          All payouts run inline AML/sanctions screening before dispatch. If compliance flags are raised, the payout is held for manual review. 
          See the <a href="/developer/gateway/compliance" className="text-primary underline">Compliance Screening</a> guide for details.
        </p>
      </div>
    </div>

    {/* Speed Parameter */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Speed Parameter</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Value</TableHead>
            <TableHead>Behavior</TableHead>
            <TableHead>Typical Arrival</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">instant</code></TableCell>
            <TableCell className="text-sm text-muted-foreground">Use the fastest available rail. Fails if no instant rail is available for the destination.</TableCell>
            <TableCell className="text-sm text-muted-foreground">Seconds to 30 min</TableCell>
          </TableRow>
          <TableRow>
            <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">standard</code></TableCell>
            <TableCell className="text-sm text-muted-foreground">Use standard bank transfer rails (T+1). Lower fees.</TableCell>
            <TableCell className="text-sm text-muted-foreground">1–2 business days</TableCell>
          </TableRow>
          <TableRow>
            <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">auto</code></TableCell>
            <TableCell className="text-sm text-muted-foreground">Try instant first; automatically fall back to standard if no instant rail is available or float is insufficient.</TableCell>
            <TableCell className="text-sm text-muted-foreground">Seconds to 2 days</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    {/* Rail Comparison */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Available Rails</h2>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rail</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead>Est. Time</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Currencies</TableHead>
              <TableHead>Prefunding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { rail: "mobile_money", speed: "Instant", time: "< 2 min", fee: "0.5%", currencies: "XAF, XOF", prefund: "Yes" },
              { rail: "visa_direct", speed: "Instant", time: "< 30 min", fee: "1.0%", currencies: "USD, EUR, GBP", prefund: "Yes" },
              { rail: "mc_send", speed: "Instant", time: "< 30 min", fee: "1.0%", currencies: "USD, EUR", prefund: "Yes" },
              { rail: "bank_transfer", speed: "Standard", time: "1–2 days", fee: "0.25%", currencies: "XAF, EUR, USD", prefund: "No" },
            ].map(r => (
              <TableRow key={r.rail}>
                <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{r.rail}</code></TableCell>
                <TableCell className="text-sm">{r.speed}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.time}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.fee}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.currencies}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.prefund}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Instant rails (mobile_money, visa_direct, mc_send) require <a href="/developer/gateway/treasury" className="text-primary underline">treasury prefunding</a>. 
        The router verifies sufficient float before dispatching. If float is insufficient with <code className="bg-muted px-1 rounded">speed: "auto"</code>, the payout falls back to standard rails.
      </p>
    </div>

    {/* Destination Object Schemas */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Destination Object Schemas</h2>
      <p className="text-sm text-muted-foreground">The <code className="bg-muted px-1 rounded">destination</code> object varies by target type:</p>

      <div className="space-y-4">
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2">Bank Account</h4>
          <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">
{`{
  "type": "bank_account",
  "bank_code": "AFRILAND",
  "account_number": "123456789",
  "account_name": "Jean Dupont",
  "country": "CM"
}`}
          </pre>
        </div>
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2">Mobile Money</h4>
          <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">
{`{
  "type": "mobile_money",
  "provider": "mtn_momo",
  "phone_number": "+237677123456",
  "account_name": "Jean Dupont"
}`}
          </pre>
        </div>
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2">Card (Visa Direct / Mastercard Send)</h4>
          <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">
{`{
  "type": "card",
  "card_token": "tok_visa_abc123",
  "card_network": "visa"
}`}
          </pre>
        </div>
      </div>
    </div>

    {/* API Endpoints */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="POST" endpoint="/v1/payouts/instant" description="Create an instant payout with automatic rail selection."
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Source merchant ID" },
        { name: "amount", type: "number", required: true, description: "Payout amount" },
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "speed", type: "string", required: true, description: "Delivery speed: instant, standard, or auto" },
        { name: "destination", type: "object", required: true, description: "Destination object (see schemas above)" },
        { name: "narration", type: "string", required: false, description: "Payout description" },
      ]}
      response={JSON.stringify({
        data: {
          payout_id: "po_inst_001", status: "processing", speed: "instant", rail: "mobile_money",
          amount: 50000, currency: "XAF", estimated_arrival: "2026-03-01T10:02:00Z",
          compliance: { screened: true, result: "clear" },
          fee: { amount: 250, currency: "XAF" }, created_at: "2026-03-01T10:00:00Z"
        }
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/payouts/rails" description="List available payout rails for a given currency and destination type."
      parameters={[
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "destination_type", type: "string", required: false, description: "bank_account, mobile_money, or card" },
      ]}
      response={JSON.stringify({
        data: [
          { rail: "mobile_money", speed: "instant", estimated_time: "< 2 minutes", currencies: ["XAF", "XOF"], fee_percentage: 0.5, prefunding_required: true },
          { rail: "visa_direct", speed: "instant", estimated_time: "< 30 minutes", currencies: ["USD", "EUR", "GBP"], fee_percentage: 1.0, prefunding_required: true },
          { rail: "mc_send", speed: "instant", estimated_time: "< 30 minutes", currencies: ["USD", "EUR"], fee_percentage: 1.0, prefunding_required: true },
          { rail: "bank_transfer", speed: "standard", estimated_time: "1-2 business days", currencies: ["XAF", "EUR", "USD"], fee_percentage: 0.25, prefunding_required: false },
        ]
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/payouts/push-to-card" description="Push funds directly to a Visa or Mastercard via Visa Direct / Mastercard Send."
      parameters={[
        { name: "card_token", type: "string", required: true, description: "Tokenized card identifier" },
        { name: "card_network", type: "string", required: false, description: "visa or mastercard (auto-detected if omitted)" },
        { name: "amount", type: "number", required: true, description: "Amount in destination currency" },
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "narration", type: "string", required: false, description: "Payout description" },
      ]}
      response={JSON.stringify({
        data: { payout_id: "po_ptc_001", status: "processing", rail: "visa_direct", card_network: "visa", estimated_arrival: "2026-03-01T10:30:00Z" }
      }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/payouts/cancel" description="Cancel a pending payout before it is processed."
      parameters={[
        { name: "payout_id", type: "uuid", required: true, description: "Payout ID to cancel" },
        { name: "reason", type: "string", required: false, description: "Cancellation reason" },
      ]}
      response={JSON.stringify({
        data: { payout_id: "po_inst_001", status: "cancelled", cancelled_at: "2026-03-01T10:01:00Z" }
      }, null, 2)}
    />

    {/* Code Examples */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Code Examples</h2>
      <div className="space-y-3">
        <h3 className="font-medium text-sm">Instant MoMo Payout (curl)</h3>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`curl -X POST https://api.kangopenbanking.com/v1/payouts/instant \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: payout_unique_001" \\
  -d '{
    "merchant_id": "mch_uuid",
    "amount": 50000,
    "currency": "XAF",
    "speed": "instant",
    "destination": {
      "type": "mobile_money",
      "provider": "mtn_momo",
      "phone_number": "+237677123456",
      "account_name": "Jean Dupont"
    },
    "narration": "Salary payment"
  }'`}
        </pre>

        <h3 className="font-medium text-sm">Push-to-Card (curl)</h3>
        <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`curl -X POST https://api.kangopenbanking.com/v1/payouts/push-to-card \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "card_token": "tok_visa_abc123",
    "amount": 100,
    "currency": "USD",
    "narration": "Freelancer payment"
  }'`}
        </pre>
      </div>
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
            { event: "payout.processing", desc: "Payout submitted to the provider and awaiting confirmation" },
            { event: "payout.completed", desc: "Funds delivered to the destination successfully" },
            { event: "payout.failed", desc: "Payout failed — wallet balance auto-reversed" },
            { event: "payout.reversed", desc: "Previously completed payout was reversed by the provider" },
            { event: "payout.cancelled", desc: "Payout was cancelled before processing" },
          ].map(e => (
            <TableRow key={e.event}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.event}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Error Codes */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Error Codes</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Meaning</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { code: "GW_006", desc: "Insufficient treasury float for instant rail" },
            { code: "GW_007", desc: "No instant rail available for this currency/destination" },
            { code: "GW_008", desc: "Compliance screening flagged — payout held for review" },
            { code: "GW_009", desc: "Destination account validation failed" },
            { code: "GW_010", desc: "Payout amount exceeds rail maximum" },
          ].map(e => (
            <TableRow key={e.code}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.code}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        See the full <a href="/developer/api/error-codes" className="text-primary underline">Error Codes Reference</a> for all gateway error types.
      </p>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Zap className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>Treasury Prefunding Required</strong> — Instant rails (MoMo, Visa Direct, Mastercard Send) debit from a pre-loaded treasury float pool, not from real-time bank transfers. 
        Ensure your <a href="/developer/gateway/treasury" className="text-primary underline">treasury float</a> is adequately funded before initiating instant payouts.
      </AlertDescription>
    </Alert>

    <AutoDocNavigation />
  </div>
);

export default InstantPayoutsGuide;
