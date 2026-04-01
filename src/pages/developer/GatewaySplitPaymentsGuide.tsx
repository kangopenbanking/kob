import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const GatewaySplitPaymentsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Split Payments & Subaccounts API | Kang Open Banking" description="Marketplace split payments and subaccount management — automatically distribute charge proceeds among sellers, partners, and your platform." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Split Payments & Subaccounts</h1>
      <p className="text-muted-foreground mt-2">Create subaccounts for marketplace sellers or partners, then automatically split charge proceeds among them. Supports both percentage and flat-amount splits for flexible commission structures.</p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        Split payments let you collect a single charge from a customer and automatically distribute the net amount among multiple parties — your platform and one or more subaccounts (sellers, service providers, partners). The platform retains the remainder after subaccount splits are applied.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Split Flow</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Customer Pays", "Platform Fee Deducted", "Net Amount Calculated", "Splits Applied", "Subaccounts Credited"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Example: Customer pays 50,000 XAF → 2,000 XAF fee deducted → 48,000 net → 20% to Seller A (9,600) → 38,400 retained by platform.
        </p>
      </div>
    </div>

    {/* Split Types */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Split Types</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-sm">Percentage Split</h4>
          <p className="text-xs text-muted-foreground mt-1">Subaccount receives a percentage of the net amount. Best for commission-based marketplaces.</p>
          <pre className="bg-muted rounded p-2 text-xs mt-2">{`"split_type": "percentage", "split_value": 20`}</pre>
        </div>
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-sm">Flat Amount Split</h4>
          <p className="text-xs text-muted-foreground mt-1">Subaccount receives a fixed amount per transaction. Best for fixed-fee delivery charges or service fees.</p>
          <pre className="bg-muted rounded p-2 text-xs mt-2">{`"split_type": "flat", "split_value": 500`}</pre>
        </div>
      </div>
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">Subaccounts</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/subaccounts" description="Register a subaccount for a merchant."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", subaccount_name: "Seller A", settlement_bank: "SGCM", account_number: "1234567890", split_type: "percentage", split_value: 20, currency: "XAF", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "sub_uuid", merchant_id: "mch_uuid", subaccount_name: "Seller A", split_type: "percentage", split_value: 20, is_active: true, created_at: "2026-02-21T12:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Parent merchant ID" },
        { name: "subaccount_name", type: "string", required: true, description: "Subaccount display name" },
        { name: "split_type", type: "string", required: false, description: "percentage | flat (default: percentage)" },
        { name: "split_value", type: "number", required: true, description: "Split amount: 0–100 for percentage, fixed amount for flat" },
        { name: "settlement_bank", type: "string", required: false, description: "Bank code for settlement" },
        { name: "account_number", type: "string", required: false, description: "Bank account number" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/subaccounts?merchant_id={id}" description="List all subaccounts for a merchant."
      response={JSON.stringify({ data: [{ id: "sub_uuid", subaccount_name: "Seller A", split_type: "percentage", split_value: 20, is_active: true }] }, null, 2)}
    />

    <h2 className="text-xl font-semibold">Charges with Splits</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges" description="Create a charge with split payments. Subaccounts receive their calculated share of the net amount."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", amount: 50000, currency: "XAF", channel: "mobile_money", customer_phone: "237677123456", tx_ref: "mkt_001", subaccounts: [{ subaccount_id: "sub_uuid" }] }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", amount: 50000, fee_amount: 2000, net_amount: 48000, status: "processing", splits: [{ subaccount_id: "sub_uuid", split_type: "percentage", split_value: 20, split_amount: 9600 }] }, null, 2)}
    />

    {/* Code Example */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Code Example</h2>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Create a marketplace charge with 3 sellers
const charge = await fetch('/v1/gateway/charges', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer sk_live_...', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    merchant_id: 'mch_uuid',
    amount: 100000,
    currency: 'XAF',
    channel: 'card',
    customer_email: 'buyer@example.com',
    tx_ref: 'marketplace_order_001',
    subaccounts: [
      { subaccount_id: 'seller_a_uuid' },  // Gets 20% = 19,400
      { subaccount_id: 'seller_b_uuid' },  // Gets 15% = 14,550
    ]
    // Platform retains: 97,000 (net) - 33,950 (splits) = 63,050
  })
});`}
      </pre>
    </div>

    {/* Use Cases */}
    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Use Cases</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li><strong>E-commerce marketplace</strong> — Platform takes commission, sellers receive their share automatically</li>
        <li><strong>Food delivery</strong> — Restaurant receives order value minus platform and delivery fees</li>
        <li><strong>Ride-hailing</strong> — Driver receives fare minus platform commission</li>
        <li><strong>Multi-vendor SaaS</strong> — Software vendor and reseller share subscription revenue</li>
      </ul>
    </div>

    <DocNavigation
      previousPage={{ title: "Subscriptions", path: "/developer/gateway/subscriptions" }}
      nextPage={{ title: "Tokenization", path: "/developer/gateway/tokenization" }}
    />
  </div>
);

export default GatewaySplitPaymentsGuide;
