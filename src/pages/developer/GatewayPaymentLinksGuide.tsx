import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";

const GatewayPaymentLinksGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Payment Links API | Kang Open Banking" description="Create no-code shareable payment links with hosted checkout pages." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Payment Links API</h1>
      <p className="text-muted-foreground mt-2">Generate shareable URLs for one-time or recurring payments without writing code. Each link gets a unique slug and hosted checkout page at <code>/pay/:slug</code>.</p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payment-links" description="Create a new payment link. Returns a shareable URL with a unique slug."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", title: "Invoice #1234", amount: 25000, currency: "XAF", description: "Payment for consulting services", redirect_url: "https://yoursite.com/thanks", max_uses: 1, expires_at: "2026-03-31T23:59:59Z", custom_fields: [], metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "pl_uuid", merchant_id: "mch_uuid", title: "Invoice #1234", slug: "pay-m1abc-x9y2z3", amount: 25000, currency: "XAF", status: "active", use_count: 0, max_uses: 1, redirect_url: "https://yoursite.com/thanks", expires_at: "2026-03-31T23:59:59Z", created_at: "2026-02-21T12:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "title", type: "string", required: true, description: "Payment link title shown to customer" },
        { name: "amount", type: "number", required: true, description: "Amount to charge" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
        { name: "description", type: "string", required: false, description: "Description shown on checkout" },
        { name: "redirect_url", type: "string", required: false, description: "URL to redirect after payment" },
        { name: "max_uses", type: "integer", required: false, description: "Maximum number of times the link can be used" },
        { name: "expires_at", type: "datetime", required: false, description: "Link expiration timestamp" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/payment-links?slug={slug}" description="Retrieve a payment link by slug or ID. Public — no auth required. Validates expiry and use count."
      response={JSON.stringify({ id: "pl_uuid", title: "Invoice #1234", slug: "pay-m1abc-x9y2z3", amount: 25000, currency: "XAF", status: "active", gateway_merchants: { business_name: "Acme Corp", logo_url: null } }, null, 2)}
      parameters={[
        { name: "slug", type: "string", required: false, description: "Unique link slug" },
        { name: "id", type: "uuid", required: false, description: "Payment link ID (alternative to slug)" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/payment-links?merchant_id={id}" description="List all payment links for a merchant."
      response={JSON.stringify({ data: [{ id: "pl_uuid", title: "Invoice #1234", slug: "pay-m1abc-x9y2z3", amount: 25000, status: "active", use_count: 0 }] }, null, 2)}
    />
  </div>
);

export default GatewayPaymentLinksGuide;
