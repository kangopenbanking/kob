import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const GatewayPaymentLinksGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Payment Links API | Kang Open Banking" description="Create no-code shareable payment links with hosted checkout pages. One-time or reusable, with custom fields, expiry, and usage limits." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Payment Links API</h1>
      <p className="text-muted-foreground mt-2">Generate shareable URLs for one-time or recurring payments without writing frontend code. Each link gets a unique slug and a hosted checkout page at <code className="bg-muted px-1 rounded">/pay/:slug</code>.</p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        Payment links provide a no-code way to collect payments. Create a link via the API, share it with your customer (email, SMS, WhatsApp), and they complete payment on a KOB-hosted checkout page. No integration work required on your frontend.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Payment Link Flow</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Create Link", "Share URL", "Customer Opens", "Hosted Checkout", "Payment Completed", "Webhook + Redirect"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* Features */}
    <div className="grid sm:grid-cols-2 gap-3">
      {[
        { title: "Usage Limits", desc: "Set max_uses to control how many times a link can be used. Set to 1 for invoice-style one-time links." },
        { title: "Expiry Dates", desc: "Links auto-expire after expires_at. Expired links show a friendly error page." },
        { title: "Custom Fields", desc: "Add custom fields to the checkout form to collect additional customer data." },
        { title: "Redirect URLs", desc: "After payment, customers are redirected to your specified redirect_url with charge details." },
      ].map(f => (
        <div key={f.title} className="border rounded-lg p-3">
          <h4 className="font-medium text-sm">{f.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
        </div>
      ))}
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payment-links" description="Create a new payment link with a unique slug."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", title: "Invoice #1234", amount: 25000, currency: "XAF", description: "Payment for consulting services", redirect_url: "https://yoursite.com/thanks", max_uses: 1, expires_at: "2026-03-31T23:59:59Z", custom_fields: [], metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "pl_uuid", merchant_id: "mch_uuid", title: "Invoice #1234", slug: "pay-m1abc-x9y2z3", amount: 25000, currency: "XAF", status: "active", use_count: 0, max_uses: 1, url: "https://kangopenbanking.com/pay/pay-m1abc-x9y2z3", redirect_url: "https://yoursite.com/thanks", expires_at: "2026-03-31T23:59:59Z", created_at: "2026-02-21T12:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "title", type: "string", required: true, description: "Payment link title shown to customer" },
        { name: "amount", type: "number", required: true, description: "Amount to charge" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
        { name: "description", type: "string", required: false, description: "Description shown on checkout" },
        { name: "redirect_url", type: "string", required: false, description: "URL to redirect after payment" },
        { name: "max_uses", type: "integer", required: false, description: "Max uses (null = unlimited)" },
        { name: "expires_at", type: "datetime", required: false, description: "Link expiration timestamp" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/payment-links?slug={slug}" description="Retrieve a payment link by slug (public, no auth required)."
      response={JSON.stringify({ id: "pl_uuid", title: "Invoice #1234", slug: "pay-m1abc-x9y2z3", amount: 25000, currency: "XAF", status: "active", gateway_merchants: { business_name: "Acme Corp", logo_url: null } }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/payment-links?merchant_id={id}" description="List all payment links for a merchant."
      response={JSON.stringify({ data: [{ id: "pl_uuid", title: "Invoice #1234", slug: "pay-m1abc-x9y2z3", amount: 25000, status: "active", use_count: 0, max_uses: 1 }] }, null, 2)}
    />

    {/* Code Example */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Code Example</h2>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-payment-links \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "merchant_id": "mch_uuid",
    "title": "Freelance Project Payment",
    "amount": 150000,
    "currency": "XAF",
    "description": "Web development services - March 2026",
    "max_uses": 1,
    "expires_at": "2026-04-15T23:59:59Z",
    "redirect_url": "https://yoursite.com/payment-received"
  }'

# Response includes the shareable URL:
# "url": "https://kangopenbanking.com/pay/pay-m1abc-x9y2z3"`}
      </pre>
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
            { event: "payment_link.payment_completed", desc: "A customer completed payment via the link" },
            { event: "payment_link.expired", desc: "Payment link has passed its expiry date" },
            { event: "payment_link.max_uses_reached", desc: "Link has been used the maximum number of times" },
          ].map(e => (
            <TableRow key={e.event}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.event}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <AutoDocNavigation />
  </div>
);

export default GatewayPaymentLinksGuide;
