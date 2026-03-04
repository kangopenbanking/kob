import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocNavigation } from "@/components/developer/DocNavigation";

const GatewayPayoutsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Payouts API | Kang Open Banking" description="Automated payouts to bank accounts, mobile wallets, and PayPal — single and batch." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Payouts API</h1>
      <p className="text-muted-foreground mt-2">Disburse funds to beneficiaries via bank transfer, mobile money, or PayPal. All payouts are <strong>fully automated</strong> — no admin approval required. For user account withdrawals to external banks, see the <a href="/developer/gateway/funding" className="text-primary underline">Account Funding & Withdrawals</a> guide.</p>
    </div>

    {/* Payout Options Comparison */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Payout Options Comparison</h2>
      <p className="text-sm text-muted-foreground">KOB offers three payout tiers. Choose the right one for your speed and cost requirements.</p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Option</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Fee Range</TableHead>
              <TableHead>Prefunding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Standard Payouts</TableCell>
              <TableCell className="text-sm text-muted-foreground">1–2 business days</TableCell>
              <TableCell className="text-sm text-muted-foreground">Bank, MoMo, PayPal</TableCell>
              <TableCell className="text-sm text-muted-foreground">0.25%–0.5%</TableCell>
              <TableCell className="text-sm text-muted-foreground">No</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium"><a href="/developer/gateway/instant-payouts" className="text-primary underline">Instant Payouts</a></TableCell>
              <TableCell className="text-sm text-muted-foreground">Seconds to 30 min</TableCell>
              <TableCell className="text-sm text-muted-foreground">MoMo, Bank (RTGS)</TableCell>
              <TableCell className="text-sm text-muted-foreground">0.5%–1.0%</TableCell>
              <TableCell className="text-sm text-muted-foreground">Yes (<a href="/developer/gateway/treasury" className="text-primary underline">Treasury</a>)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium"><a href="/developer/gateway/instant-payouts" className="text-primary underline">Push-to-Card</a></TableCell>
              <TableCell className="text-sm text-muted-foreground">&lt; 30 minutes</TableCell>
              <TableCell className="text-sm text-muted-foreground">Visa Direct, Mastercard Send</TableCell>
              <TableCell className="text-sm text-muted-foreground">1.0%</TableCell>
              <TableCell className="text-sm text-muted-foreground">Yes (<a href="/developer/gateway/treasury" className="text-primary underline">Treasury</a>)</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <div>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <CheckCircle className="h-4 w-4 text-primary" />
      <AlertDescription>
        <strong>Fully Automated Payouts (v2.3.0)</strong> — All payout channels (Stripe Card, Flutterwave Bank/MoMo, PayPal) are processed automatically. Status updates are delivered via webhooks and a background poller that auto-finalizes or auto-reverses failed payouts within 24 hours.
      </AlertDescription>
    </Alert>

    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Automation Flow</h2>
      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
        <li>Client calls <code>POST /v1/gateway/payouts</code> — wallet debited immediately</li>
        <li>Provider API called in real-time (Stripe, Flutterwave, or PayPal)</li>
        <li>If provider returns <code>successful</code>, payout marked <code>completed</code> instantly</li>
        <li>If <code>processing</code>, the status poller checks every 5 minutes and auto-finalizes</li>
        <li>Webhook endpoint receives async provider callbacks for instant finalization</li>
        <li>Payouts stuck &gt;24 hours are auto-failed and wallet balance reversed</li>
      </ol>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payouts" description="Create an automated single payout. Funds are debited immediately and sent to the provider."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", amount: 10000, currency: "XAF", channel: "mobile_money", beneficiary_phone: "237677123456", beneficiary_name: "Jean Dupont", narration: "Salary payment", tx_ref: "pay_001" }, null, 2)}
      response={JSON.stringify({ id: "pay_uuid", status: "processing", provider: "flutterwave", fee_amount: 350, tx_ref: "pay_001", automated: true }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payout-batches" description="Create a batch of automated payouts."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", currency: "XAF", items: [{ amount: 5000, channel: "mobile_money", beneficiary_phone: "237677111111", beneficiary_name: "Alice" }, { amount: 8000, channel: "bank_transfer", beneficiary_account: "123456789", beneficiary_bank: "AFRILAND", beneficiary_name: "Bob" }] }, null, 2)}
      response={JSON.stringify({ id: "batch_uuid", status: "processing", total_amount: 13000, item_count: 2, completed_count: 0, failed_count: 0, automated: true }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payouts/paypal" description="Create an automated PayPal payout. Supports EMAIL, PHONE, or PAYPAL_ID recipient types."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", amount: 5000, currency: "USD", recipient_type: "EMAIL", receiver: "recipient@example.com", note: "Invoice payment", tx_ref: "paypal_pay_001" }, null, 2)}
      response={JSON.stringify({ id: "payout_uuid", batch_id: "PP-BATCH-123", status: "processing", provider: "paypal", amount: 5000, currency: "USD", fee_amount: 325, net_amount: 4675, tx_ref: "paypal_pay_001", automated: true }, null, 2)}
    />

    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Webhook & Polling Endpoints</h2>
      <p className="text-sm text-muted-foreground">These endpoints handle automated status finalization — no manual intervention needed.</p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payout-webhook?provider=stripe|flutterwave|paypal" description="Webhook receiver for provider async status updates. Automatically finalizes or reverses payouts."
      requestBody={JSON.stringify({ event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED", resource: { payout_batch_id: "PP-BATCH-123", transaction_status: "SUCCESS" } }, null, 2)}
      response={JSON.stringify({ received: true, payout_id: "pay_uuid", status: "completed", automated: true }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payout-status-poll" description="Background poller (cron every 5 min). Checks all processing payouts and auto-finalizes. Auto-fails payouts older than 24 hours."
      response={JSON.stringify({ total: 12, completed: 8, failed: 1, unchanged: 3 }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/payouts?id={payoutId}" description="Retrieve a single payout status." />
    <ApiEndpoint method="GET" endpoint="/v1/gateway/payouts?merchant_id={id}&status={status}&limit=50&offset=0" description="List payouts with filters." />

    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Provider Routing</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 space-y-2">
          <Badge>Stripe</Badge>
          <p className="text-sm text-muted-foreground">Card payouts via Stripe Refunds/Transfers API. Auto-finalized via <code>refund.updated</code> webhook.</p>
        </div>
        <div className="border rounded-lg p-4 space-y-2">
          <Badge>Flutterwave</Badge>
          <p className="text-sm text-muted-foreground">Bank and MoMo payouts via Flutterwave Transfers API. Auto-finalized via <code>transfer.completed</code> webhook.</p>
        </div>
        <div className="border rounded-lg p-4 space-y-2">
          <Badge>PayPal</Badge>
          <p className="text-sm text-muted-foreground">PayPal payouts via Batch Payouts API. Auto-finalized via <code>PAYMENT.PAYOUTS-ITEM.SUCCEEDED</code> webhook.</p>
        </div>
      </div>
    </div>

    <p className="text-sm text-muted-foreground">For full PayPal integration details including withdrawals and webhooks, see the <a href="/developer/gateway/paypal" className="text-primary underline">PayPal Integration Guide</a>.</p>
  </div>
);

export default GatewayPayoutsGuide;
