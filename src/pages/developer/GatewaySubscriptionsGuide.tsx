import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const GatewaySubscriptionsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Subscriptions API | Kang Open Banking" description="Create payment plans and manage recurring billing with automated charge scheduling, invoice generation, and lifecycle webhooks." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Subscriptions API</h1>
      <p className="text-muted-foreground mt-2">Set up recurring billing with payment plans. Define intervals (daily, weekly, monthly, yearly) and let the system automatically charge customers via a cron-based scheduler with invoice generation.</p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        Subscriptions are built on two primitives: <strong>Plans</strong> define the price and billing interval, while <strong>Subscriptions</strong> link a customer to a plan. Once subscribed, the system automatically charges the customer on each billing cycle using their saved payment method (token). Invoices are generated for each charge.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Billing Lifecycle</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Create Plan", "Subscribe Customer", "Auto-Charge (Cron)", "Invoice Generated", "Webhook Dispatched"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Failed charges are retried up to 3 times with 24-hour intervals. After 3 failures, the subscription is marked as <code className="bg-muted px-1 rounded">past_due</code>.
        </p>
      </div>
    </div>

    {/* Plan Intervals */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Supported Intervals</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { interval: "daily", desc: "Charge every N days. Common for micro-subscriptions or usage-based billing." },
          { interval: "weekly", desc: "Charge every N weeks. Used for recurring service payments." },
          { interval: "monthly", desc: "Most common. Charge on the same day each month." },
          { interval: "yearly", desc: "Annual billing with optional discounts vs monthly." },
        ].map(i => (
          <div key={i.interval} className="border rounded-lg p-3">
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{i.interval}</code>
            <p className="text-xs text-muted-foreground mt-1">{i.desc}</p>
          </div>
        ))}
      </div>
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">Payment Plans</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payment-plans" description="Create a reusable payment plan."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", name: "Premium Monthly", amount: 15000, currency: "XAF", interval: "monthly", interval_count: 1, duration: 12, metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "plan_uuid", merchant_id: "mch_uuid", name: "Premium Monthly", amount: 15000, currency: "XAF", interval: "monthly", interval_count: 1, duration: 12, is_active: true, created_at: "2026-02-21T12:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "name", type: "string", required: true, description: "Plan name" },
        { name: "amount", type: "number", required: true, description: "Amount per billing cycle" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
        { name: "interval", type: "string", required: false, description: "daily | weekly | monthly | yearly (default: monthly)" },
        { name: "interval_count", type: "integer", required: false, description: "Number of intervals between charges (default: 1)" },
        { name: "duration", type: "integer", required: false, description: "Total billing cycles (null = infinite)" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/payment-plans?merchant_id={id}" description="List all plans for a merchant."
      response={JSON.stringify({ data: [{ id: "plan_uuid", name: "Premium Monthly", amount: 15000, currency: "XAF", interval: "monthly", is_active: true, subscriber_count: 42 }] }, null, 2)}
    />

    <h2 className="text-xl font-semibold">Subscriptions</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/subscriptions" description="Subscribe a customer to a plan. First charge is scheduled automatically."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", plan_id: "plan_uuid", customer_email: "john@example.com", customer_phone: "237677123456", customer_name: "John Doe", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "sub_uuid", merchant_id: "mch_uuid", plan_id: "plan_uuid", status: "active", customer_email: "john@example.com", next_charge_at: "2026-03-21T12:00:00Z", charges_made: 0, created_at: "2026-02-21T12:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "plan_id", type: "uuid", required: true, description: "The payment plan" },
        { name: "customer_email", type: "string", required: true, description: "Customer email" },
        { name: "customer_phone", type: "string", required: false, description: "Customer phone number" },
        { name: "customer_name", type: "string", required: false, description: "Customer display name" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/subscriptions/cancel" description="Cancel an active subscription. No further charges will be made."
      requestBody={JSON.stringify({ subscription_id: "sub_uuid", reason: "Customer requested cancellation" }, null, 2)}
      response={JSON.stringify({ id: "sub_uuid", status: "cancelled", cancel_reason: "Customer requested cancellation", cancelled_at: "2026-02-22T09:00:00Z" }, null, 2)}
      parameters={[
        { name: "subscription_id", type: "uuid", required: true, description: "Subscription to cancel" },
        { name: "reason", type: "string", required: false, description: "Cancellation reason" },
      ]}
    />

    <h2 className="text-xl font-semibold">Invoice Generation</h2>

    <ApiEndpoint method="POST" endpoint="/v1/invoices/generate" description="Generate an invoice for a billing period."
      requestBody={JSON.stringify({ institution_id: "inst_uuid", billing_cycle: "monthly", period_start: "2026-02-01", period_end: "2026-02-28" }, null, 2)}
      response={JSON.stringify({ invoice_id: "inv_uuid", invoice_number: "INV-2026-02-000001", total_amount: 45000, currency: "XAF", status: "pending", due_date: "2026-03-30", created_at: "2026-02-28T23:59:59Z" }, null, 2)}
      parameters={[
        { name: "institution_id", type: "uuid", required: true, description: "Institution or merchant to invoice" },
        { name: "billing_cycle", type: "string", required: true, description: "monthly | quarterly | yearly" },
        { name: "period_start", type: "date", required: true, description: "Billing period start date" },
        { name: "period_end", type: "date", required: true, description: "Billing period end date" },
      ]}
    />

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
            { event: "subscription.created", desc: "New subscription activated" },
            { event: "subscription.charge.successful", desc: "Recurring charge completed" },
            { event: "subscription.charge.failed", desc: "Recurring charge failed — retry scheduled" },
            { event: "subscription.past_due", desc: "All retry attempts exhausted" },
            { event: "subscription.cancelled", desc: "Subscription cancelled by merchant or customer" },
            { event: "subscription.completed", desc: "All billing cycles completed (finite duration plans)" },
            { event: "invoice.generated", desc: "Invoice created for a billing period" },
          ].map(e => (
            <TableRow key={e.event}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.event}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Subscription Statuses</h3>
      <div className="flex flex-wrap gap-2">
        {[
          { s: "active", v: "default" as const },
          { s: "past_due", v: "secondary" as const },
          { s: "cancelled", v: "destructive" as const },
          { s: "completed", v: "outline" as const },
        ].map(({ s, v }) => (
          <Badge key={s} variant={v}>{s}</Badge>
        ))}
      </div>
    </div>

    <AutoDocNavigation />
  </div>
);

export default GatewaySubscriptionsGuide;
