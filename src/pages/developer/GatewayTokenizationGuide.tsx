import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocNavigation } from "@/components/developer/DocNavigation";
import { Shield } from "lucide-react";

const GatewayTokenizationGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Customer Tokenization API | Kang Open Banking" description="Save customer payment methods and charge them later using tokens — ideal for subscriptions, one-click checkout, and recurring billing." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Customer Tokenization</h1>
      <p className="text-muted-foreground mt-2">Store customer profiles with saved payment methods (tokens). Charge returning customers without re-collecting payment details — ideal for subscriptions, one-click checkout, and recurring billing.</p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        Tokenization replaces sensitive payment data (card numbers, MoMo details) with secure, reusable tokens. Tokens are created automatically when a customer completes their first payment. Subsequent charges reference the token instead of raw payment details — no PCI scope expansion required.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Tokenization Flow</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["First Payment", "Token Created", "Token Stored", "Future Charge via Token", "Provider Routes Automatically"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Shield className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>PCI Compliant</strong> — KOB handles all sensitive payment data. Tokens are opaque identifiers that cannot be reversed to extract card numbers. Your platform never touches raw card data, keeping you out of PCI scope.
      </AlertDescription>
    </Alert>

    {/* Use Cases */}
    <div className="grid sm:grid-cols-2 gap-3">
      {[
        { title: "One-Click Checkout", desc: "Let returning customers pay with a single click using their saved payment method." },
        { title: "Recurring Billing", desc: "Automatically charge subscription customers on schedule using their stored token." },
        { title: "In-App Purchases", desc: "Mobile app users save their card once and purchase instantly on future visits." },
        { title: "Marketplace Re-orders", desc: "Customers re-order from favorite sellers without re-entering payment details." },
      ].map(c => (
        <div key={c.title} className="border rounded-lg p-3">
          <h4 className="font-medium text-sm">{c.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
        </div>
      ))}
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">Customers</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/customers" description="Create a customer profile linked to your merchant account."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", email: "john@example.com", name: "John Doe", phone: "+237677123456", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "cust_uuid", merchant_id: "mch_uuid", email: "john@example.com", name: "John Doe", phone: "+237677123456", tokens: [], created_at: "2026-02-21T12:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "email", type: "string", required: true, description: "Customer email (unique per merchant)" },
        { name: "name", type: "string", required: false, description: "Customer display name" },
        { name: "phone", type: "string", required: false, description: "Phone number" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/customers?merchant_id={id}&email={email}" description="Retrieve a customer and their saved tokens."
      response={JSON.stringify({ id: "cust_uuid", email: "john@example.com", name: "John Doe", tokens: [{ id: "tok_uuid", channel: "card", provider: "stripe", last4: "4242", brand: "visa", created_at: "2026-02-21T12:05:00Z" }] }, null, 2)}
    />

    <h2 className="text-xl font-semibold">Token Charges</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/token" description="Charge a saved payment method. Routes to the original provider automatically."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", token_id: "tok_uuid", amount: 10000, currency: "XAF", tx_ref: "recurring_001", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", merchant_id: "mch_uuid", amount: 10000, currency: "XAF", channel: "card", status: "successful", provider: "stripe", fee_amount: 400, net_amount: 9600, tx_ref: "recurring_001" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "token_id", type: "uuid", required: true, description: "Saved payment token" },
        { name: "amount", type: "number", required: true, description: "Amount to charge" },
        { name: "tx_ref", type: "string", required: true, description: "Your unique transaction reference" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
      ]}
    />

    {/* Code Example */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Code Example</h2>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// One-click checkout using a saved token
const response = await fetch('/v1/gateway/charges/token', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_...',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'reorder_user123_001'
  },
  body: JSON.stringify({
    merchant_id: 'mch_uuid',
    token_id: 'tok_uuid',       // Saved from first purchase
    amount: 15000,
    currency: 'XAF',
    tx_ref: 'reorder_001'
  })
});
const { id, status } = await response.json();
// status: "successful" — charged instantly without customer interaction`}
      </pre>
    </div>

    {/* Token Lifecycle */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Token Lifecycle</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead>Token Type</TableHead>
            <TableHead>Expiry</TableHead>
            <TableHead>Re-auth Required</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Card (Stripe)</TableCell>
            <TableCell className="text-sm text-muted-foreground">Stripe Customer + PaymentMethod</TableCell>
            <TableCell className="text-sm text-muted-foreground">When card expires</TableCell>
            <TableCell className="text-sm text-muted-foreground">3DS may be triggered by issuer</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Mobile Money</TableCell>
            <TableCell className="text-sm text-muted-foreground">Flutterwave charge token</TableCell>
            <TableCell className="text-sm text-muted-foreground">No expiry</TableCell>
            <TableCell className="text-sm text-muted-foreground">No</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <DocNavigation
      previousPage={{ title: "Split Payments", path: "/developer/gateway/split-payments" }}
      nextPage={{ title: "Webhooks", path: "/developer/gateway/webhooks" }}
    />
  </div>
);

export default GatewayTokenizationGuide;
