import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Package, CreditCard, RotateCcw, RefreshCw, Store, Plug, BarChart3 } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const posEndpointStatus = [
  { endpoint: "pos-catalog-products", status: "Live", description: "Product CRUD and variant management" },
  { endpoint: "pos-inventory", status: "Live", description: "Inventory adjustments and movements" },
  { endpoint: "pos-inventory-sync", status: "Live", description: "WooCommerce inventory sync" },
  { endpoint: "pos-orders", status: "Live", description: "Order creation and management" },
  { endpoint: "pos-submit-order", status: "Live", description: "Order submission for payment" },
  { endpoint: "pos-pay-order", status: "Live", description: "Payment initiation (MoMo/Card/PayPal)" },
  { endpoint: "pos-finalize-payment", status: "Live", description: "Payment finalization via webhook" },
  { endpoint: "pos-refunds", status: "Live", description: "Full/partial refunds with restocking" },
  { endpoint: "pos-woo-connector", status: "Live", description: "WooCommerce store connection" },
  { endpoint: "pos-woo-webhook-ingestion", status: "Live", description: "WooCommerce webhook receiver" },
  { endpoint: "pos-qr-payment", status: "Beta", description: "QR code payment generation and processing" },
  { endpoint: "pos-consumer-checkout", status: "Beta", description: "Consumer marketplace wallet checkout" },
  { endpoint: "pos-store-browse", status: "Beta", description: "Store discovery and browsing" },
  { endpoint: "pos-store-subscription", status: "Beta", description: "Merchant subscription management" },
  { endpoint: "pos-device-registry", status: "Planned", description: "Physical terminal and device management" },
  { endpoint: "pos-staff-auth", status: "Planned", description: "Staff PIN login for POS terminals" },
];

export default function MerchantsPOSGuide() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <ShoppingCart className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Merchants -- POS</h1>
          <Badge variant="outline" className="gap-1 ml-2">Commerce Module</Badge>
        </div>
        <p className="text-lg text-muted-foreground">
          Build omnichannel commerce with KOB's POS API — WooCommerce sync, catalog management,
          orders, payments (MoMo/Card/PayPal/Bank), refunds, and inventory tracking. Cameroon/XAF defaults.
        </p>
        <div className="flex gap-2 mt-4 flex-wrap">
          <Badge>XAF Default</Badge>
          <Badge variant="outline">Cameroon-First</Badge>
          <Badge variant="secondary">WooCommerce</Badge>
          <Badge variant="secondary">Mobile Money</Badge>
          <Badge variant="secondary">Stripe</Badge>
          <Badge variant="secondary">Idempotent</Badge>
        </div>
      </div>

      <Separator />

      {/* Endpoint Availability Matrix */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4">
          <BarChart3 className="h-6 w-6" /> Endpoint Availability
        </h2>
        <Card className="p-6">
          <p className="text-muted-foreground mb-4">
            The POS Commerce Layer is actively deployed. Some endpoints are in Beta or Planned status.
            Beta endpoints are functional but may have breaking changes. Planned endpoints are documented
            in the OpenAPI spec but not yet deployed.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posEndpointStatus.map(e => (
                <TableRow key={e.endpoint}>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{e.endpoint}</code></TableCell>
                  <TableCell>
                    <Badge variant={e.status === "Live" ? "default" : e.status === "Beta" ? "secondary" : "outline"} className="text-xs">
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <Separator />

      {/* Section 1: Overview */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><Store className="h-6 w-6" /> Overview</h2>
        <Card className="p-6">
          <p className="text-muted-foreground mb-4">
            The POS Commerce Layer extends KOB's payment gateway with full catalog, inventory, and order management.
            Merchants can sell through multiple channels:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>POS</strong> — Direct point-of-sale via API (future: physical terminals)</li>
            <li><strong>WooCommerce</strong> — Import products, sync inventory, receive orders via webhooks</li>
            <li><strong>API</strong> — Headless commerce for custom storefronts</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            All endpoints default to <code>XAF</code> currency and are merchant-scoped via <code>gateway_merchants</code>.
          </p>
        </Card>
      </section>

      {/* Section 2: Connect WooCommerce */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><Plug className="h-6 w-6" /> Connect WooCommerce Store</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-woo-connector"
          description="Connect a WooCommerce store to KOB POS. Validates credentials against Woo REST API, stores encrypted config, returns webhook secret."
          requestBody={`{
  "action": "connect",
  "merchant_id": "uuid",
  "store_url": "https://mystore.cm",
  "consumer_key": "ck_...",
  "consumer_secret": "cs_...",
  "default_location_id": "uuid"
}`}
          response={`{
  "success": true,
  "integration_id": "uuid",
  "status": "connected",
  "webhook_secret": "whsec_pos_...",
  "recommended_webhooks": [
    "product.created",
    "product.updated",
    "order.created",
    "order.updated"
  ],
  "webhook_url": "https://api.kangopenbanking.com/v1/pos-woo-webhook-ingestion"
}`}
        />
      </section>

      {/* Section 3: Import Products */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><Package className="h-6 w-6" /> Import Products</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-woo-connector"
          description="Import products from WooCommerce. Supports full and incremental modes with configurable merge strategy."
          requestBody={`{
  "action": "import_products",
  "merchant_id": "uuid",
  "mode": "full",
  "include": "both",
  "merge_strategy": "woo_source_of_truth"
}`}
          response={`{
  "success": true,
  "sync_run_id": "uuid",
  "summary": {
    "total_fetched": 42,
    "imported": 38,
    "updated": 0,
    "skipped": 4
  }
}`}
        />

        <Card className="p-4 mt-4 bg-muted/30">
          <h4 className="font-semibold mb-2">Merge Strategies</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li><code>woo_source_of_truth</code> — WooCommerce data overwrites KOB on conflict (default)</li>
            <li><code>kob_source_of_truth</code> — KOB data preserved; Woo updates ignored if mapping exists</li>
            <li><code>manual_conflict_review</code> — Conflicts flagged for manual resolution</li>
          </ul>
        </Card>
      </section>

      {/* Section 4: Manual Products + Inventory */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><Package className="h-6 w-6" /> Manual Products &amp; Inventory</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-catalog-products"
          description="Create a product manually in KOB POS with variants."
          requestBody={`{
  "merchant_id": "uuid",
  "name": "Beignets Haricots",
  "description": "Traditional Cameroon bean fritters",
  "currency": "XAF",
  "variants": [
    { "name": "Small", "sku": "BH-SM", "price": 100 },
    { "name": "Large", "sku": "BH-LG", "price": 200 }
  ]
}`}
          response={`{
  "success": true,
  "product": {
    "id": "uuid",
    "name": "Beignets Haricots",
    "source": "manual",
    "variants": [...]
  }
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-inventory"
          description="Adjust inventory for a variant at a specific location. Creates an immutable audit movement."
          requestBody={`{
  "merchant_id": "uuid",
  "variant_id": "uuid",
  "location_id": "uuid",
  "quantity_delta": 50,
  "type": "manual_adjust",
  "reason": "Initial stock count"
}`}
          response={`{
  "new_quantity": 50,
  "movement_id": "uuid"
}`}
        />
      </section>

      {/* Section 5: POS Orders Flow */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><ShoppingCart className="h-6 w-6" /> POS Orders Flow</h2>

        <Card className="p-6 mb-6">
          <h4 className="font-semibold mb-3">Order Lifecycle</h4>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {['draft', 'pending_payment', 'paid', 'processing', 'completed'].map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                <Badge variant={s === 'paid' ? 'default' : 'outline'}>{s}</Badge>
                {i < 4 && <span className="text-muted-foreground">→</span>}
              </span>
            ))}
          </div>
        </Card>

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-orders"
          description="Create a new POS order (draft). Auto-generates a human-friendly order number (POS-000001)."
          requestBody={`{
  "merchant_id": "uuid",
  "location_id": "uuid",
  "items": [
    { "variant_id": "uuid", "quantity": 2 }
  ],
  "customer_name": "Jean-Pierre",
  "customer_phone": "+237650000000"
}`}
          response={`{
  "success": true,
  "order": {
    "id": "uuid",
    "order_number": "POS-000001",
    "status": "draft",
    "total": 400,
    "currency": "XAF"
  }
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-submit-order"
          description="Submit a draft order for payment. Locks pricing snapshot and transitions to pending_payment."
          requestBody={`{ "order_id": "uuid" }`}
          response={`{
  "success": true,
  "status": "pending_payment"
}`}
        />
      </section>

      {/* Section 6: Payments */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><CreditCard className="h-6 w-6" /> Payments</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-pay-order"
          description="Initiate payment for a submitted POS order. Requires Idempotency-Key header."
          parameters={[
            { name: "Idempotency-Key", type: "header", required: true, description: "Unique key to prevent duplicate payments" },
          ]}
          requestBody={`{
  "order_id": "uuid",
  "method": "mobile_money",
  "provider": "flutterwave",
  "customer": {
    "phone": "+237650000000",
    "name": "Jean-Pierre"
  }
}`}
          response={`{
  "success": true,
  "charge_id": "uuid",
  "status": "pending",
  "next_action": {
    "type": "momo_prompt",
    "provider_reference": "FLW-MOCK-...",
    "instructions": "Approve the payment prompt on your phone"
  }
}`}
        />

        <Card className="p-4 mt-4 bg-muted/30">
          <h4 className="font-semibold mb-2">Supported Payment Methods</h4>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div>• <strong>mobile_money</strong> — MTN MoMo, Orange Money (via Flutterwave)</div>
            <div>• <strong>card</strong> — Visa/Mastercard (via Stripe)</div>
            <div>• <strong>paypal</strong> — PayPal checkout</div>
            <div>• <strong>bank_transfer</strong> — Direct bank payment</div>
          </div>
        </Card>

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-finalize-payment"
          description="Called by provider webhook to finalize payment. Decrements inventory, updates order status, generates receipt."
          requestBody={`{
  "charge_id": "uuid",
  "status": "successful",
  "provider": "flutterwave",
  "provider_reference": "FLW-...",
  "provider_raw": {}
}`}
          response={`{
  "success": true,
  "order_id": "uuid",
  "order_status": "paid",
  "receipt": {
    "order_number": "POS-000001",
    "merchant_name": "Chez Marie",
    "items": [...],
    "total": 400,
    "currency": "XAF",
    "payment_method": "mobile_money",
    "paid_at": "2026-03-08T12:00:00Z"
  }
}`}
        />
      </section>

      {/* Section 7: Refunds */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><RotateCcw className="h-6 w-6" /> Refunds &amp; Returns</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-refunds"
          description="Create a refund for a POS order. Supports full/partial refund with optional restocking and WooCommerce sync."
          parameters={[
            { name: "Idempotency-Key", type: "header", required: true, description: "Unique key to prevent duplicate refunds" },
          ]}
          requestBody={`{
  "order_id": "uuid",
  "items": [
    { "order_item_id": "uuid", "quantity": 1, "restock": true }
  ],
  "reason": "Customer changed mind",
  "refund_method": "provider_refund"
}`}
          response={`{
  "success": true,
  "return_id": "uuid",
  "refund_amount": 200,
  "order_status": "partially_refunded",
  "items_restocked": 1,
  "woo_synced": false
}`}
        />
      </section>

      {/* Section 8: Inventory Sync */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><RefreshCw className="h-6 w-6" /> Inventory Sync</h2>

        <Card className="p-6 mb-6">
          <h4 className="font-semibold mb-3">Sync Strategy</h4>
          <p className="text-muted-foreground mb-4">
            Inventory is synchronized between KOB POS and WooCommerce using configurable strategies:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>woo_source_of_truth</strong> (default) — WooCommerce webhook updates override KOB. POS sales push to Woo.</li>
            <li><strong>kob_source_of_truth</strong> — KOB is authoritative. Woo changes are logged but do not override.</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            All movements are recorded as immutable audit entries in <code>pos_inventory_movements</code>.
            Conflicts are resolved via last-write-wins with full audit trail.
          </p>
        </Card>

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-inventory-sync"
          description="Trigger inventory sync between KOB POS and WooCommerce. Pushes net stock changes since last sync."
          requestBody={`{
  "merchant_id": "uuid"
}`}
          response={`{
  "success": true,
  "synced_integrations": 1,
  "results": [
    {
      "integration_id": "uuid",
      "status": "success",
      "movements_processed": 12,
      "variants_synced": 8,
      "strategy": "woo_source_of_truth"
    }
  ]
}`}
        />
      </section>

      {/* Section 9: Webhook Ingestion */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><BarChart3 className="h-6 w-6" /> WooCommerce Webhook Ingestion</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/functions/v1/pos-woo-webhook-ingestion"
          description="Receives WooCommerce webhooks (product/order events). HMAC-verified and deduplicated."
          parameters={[
            { name: "x-woo-merchant-id", type: "header", required: true, description: "KOB merchant UUID" },
            { name: "x-wc-webhook-signature", type: "header", required: false, description: "HMAC-SHA256 signature" },
            { name: "x-wc-webhook-delivery-id", type: "header", required: false, description: "Delivery ID for deduplication" },
          ]}
          requestBody={`{
  "id": 123,
  "status": "processing",
  "line_items": [...],
  "name": "Updated Product Name"
}`}
          response={`{
  "received": true,
  "event_id": "uuid"
}`}
        />

        <Card className="p-4 mt-4 bg-muted/30">
          <h4 className="font-semibold mb-2">Supported Webhook Events</h4>
          <div className="grid grid-cols-2 gap-1 text-sm text-muted-foreground">
            <div>• product.created</div>
            <div>• product.updated</div>
            <div>• product.deleted</div>
            <div>• order.created</div>
            <div>• order.updated</div>
            <div>• refund.created</div>
          
      <AutoDocNavigation />
</div>
        </Card>
      </section>

      {/* Section 10: QR Code Payments */}
      <section>
        <h2 className="text-2xl font-bold mb-4">QR Code Payments</h2>
        <Card className="p-6 space-y-4">
          <p className="text-muted-foreground">Merchants can generate QR codes for in-store or remote payments. Consumers scan and pay from their wallet.</p>
          <h3 className="font-semibold">Generate QR Payload</h3>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">{`POST /pos-qr-payment?action=generate
{ "merchant_id": "...", "amount": 5000, "description": "Coffee" }

Response:
{ "qr_payload": "{...}", "decoded": { "type": "kob_pos_pay", "merchant_id": "...", "amount": 5000, "currency": "XAF" } }`}</pre>
          <h3 className="font-semibold">Consumer Scan &amp; Pay</h3>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">{`POST /pos-qr-payment?action=pay
Idempotency-Key: unique-key
{ "merchant_id": "...", "amount": 5000 }

→ Debits consumer wallet, credits merchant, creates order (channel=consumer_app)`}</pre>
        </Card>
      </section>

      {/* Section 11: Consumer Marketplace */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Consumer Marketplace</h2>
        <Card className="p-6 space-y-4">
          <p className="text-muted-foreground">Merchants with active subscriptions can publish their storefront to the consumer app.</p>
          <h3 className="font-semibold">Store Discovery</h3>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">{`GET /pos-store-browse?action=stores&city=Douala&category=Food
→ Returns published stores with active subscriptions`}</pre>
          <h3 className="font-semibold">Wallet Checkout</h3>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">{`POST /pos-consumer-checkout
Idempotency-Key: unique-key
{ "cart_id": "..." }
→ Validates stock, debits wallet, credits merchant, creates paid order`}</pre>
          <h3 className="font-semibold">Subscription Plans</h3>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">{`GET /pos-store-subscription → List plans
POST /pos-store-subscription → Subscribe { "merchant_id": "...", "plan_id": "..." }`}</pre>
        </Card>
      </section>

      {/* Section 12: Expansion Readiness */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Expansion Readiness</h2>
        <Card className="p-6">
          <p className="text-muted-foreground mb-4">
            The POS data model is designed for future expansion:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Multi-location</strong> — Inventory is tracked per location. Transfer movements supported.</li>
            <li><strong>Staff &amp; PIN login</strong> — Cashier roles with PIN-based quick auth for POS terminals.</li>
            <li><strong>Device registry</strong> — Future table for physical terminals, card readers, barcode scanners.</li>
            <li><strong>Multi-currency</strong> — Currency is stored per product/order. Capability-flagged for non-XAF.</li>
            <li><strong>QR Payments</strong> — Static and dynamic QR codes for in-store and remote wallet payments.</li>
            <li><strong>Consumer Marketplace</strong> — Subscription-gated storefront with wallet-based checkout.</li>
            <li><strong>Additional integrations</strong> — Integration type enum supports future connectors beyond WooCommerce.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
