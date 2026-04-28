import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Info } from "lucide-react";

const GatewayChargesGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Charges API | Kang Open Banking" description="Create and manage payment charges via Mobile Money, Cards, and Bank Transfers. Includes OTP validation, preauthorization, and fee passthrough." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Charges API</h1>
      <p className="text-muted-foreground mt-2">Collect payments from customers via mobile_money, card, or bank_transfer channels through a single endpoint. Supports OTP validation, preauthorization (auth + capture), and configurable fee bearer. To fund a KOB user account directly, see <a href="/developer/gateway/funding" className="text-primary underline">Account Funding</a>.</p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        The Charges API is the primary collection endpoint. A single <code className="bg-muted px-1 rounded">POST /v1/gateway/charges</code> call accepts any payment channel — the gateway automatically routes to the correct provider (Flutterwave for MoMo/Bank, Stripe for Cards, Apple Pay, Google Pay).
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Charge Processing Pipeline</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Create Charge", "Provider Routing", "Customer Authorization", "OTP/3DS Validation", "Webhook Confirmation", "Settlement"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* Supported Channels */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Supported Channels</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Currencies</TableHead>
            <TableHead>Auth Method</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { ch: "mobile_money", provider: "Flutterwave", currencies: "XAF, XOF", auth: "USSD Push / OTP" },
            { ch: "card", provider: "Stripe", currencies: "XAF, USD, EUR, GBP", auth: "3D Secure / Direct" },
            { ch: "bank_transfer", provider: "Flutterwave", currencies: "XAF, NGN", auth: "Redirect" },
            { ch: "apple_pay", provider: "Stripe", currencies: "USD, EUR, GBP", auth: "Biometric" },
            { ch: "google_pay", provider: "Stripe", currencies: "USD, EUR, GBP", auth: "Biometric" },
            { ch: "ussd", provider: "Flutterwave", currencies: "XAF", auth: "USSD Dial" },
          ].map(r => (
            <TableRow key={r.ch}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{r.ch}</code></TableCell>
              <TableCell className="text-sm">{r.provider}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.currencies}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.auth}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Capture Modes */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Capture Modes</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-sm">Auto Capture (Default)</h4>
          <p className="text-xs text-muted-foreground mt-1">Funds are captured immediately upon authorization. Best for standard e-commerce.</p>
        </div>
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-sm">Manual Capture (Preauthorization)</h4>
          <p className="text-xs text-muted-foreground mt-1">Authorize a hold on the card, then capture later (full or partial). Ideal for hotel bookings, car rentals, or order-then-ship workflows. Void uncaptured holds within 7 days.</p>
        </div>
      </div>
    </div>

    {/* API Endpoints */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges" description="Create a new charge. Routes automatically to Flutterwave (MoMo) or Stripe (card) based on channel."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", amount: 5000, currency: "XAF", channel: "mobile_money", customer_phone: "237677123456", tx_ref: "order_001", fee_bearer: "merchant", capture_mode: "auto", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", merchant_id: "mch_uuid", amount: 5000, currency: "XAF", channel: "mobile_money", status: "processing", provider: "flutterwave", provider_ref: "FLW-1234", fee_amount: 200, net_amount: 4800, capture_mode: "auto", tx_ref: "order_001", created_at: "2026-02-22T10:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "amount", type: "number", required: true, description: "Amount in minor or major units (XAF = major)" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
        { name: "channel", type: "string", required: true, description: "mobile_money | card | bank_transfer | apple_pay | google_pay | ussd" },
        { name: "customer_phone", type: "string", required: false, description: "Required for mobile_money" },
        { name: "customer_email", type: "string", required: false, description: "Required for card" },
        { name: "tx_ref", type: "string", required: true, description: "Your unique transaction reference" },
        { name: "fee_bearer", type: "string", required: false, description: "merchant (default) or customer — who pays the transaction fee" },
        { name: "capture_mode", type: "string", required: false, description: "auto (default) or manual — for preauthorization flows" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/validate" description="Submit an OTP to complete a pending MoMo charge."
      requestBody={JSON.stringify({ charge_id: "chg_uuid", otp: "123456" }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", status: "successful", message: "Charge validated" }, null, 2)}
      parameters={[
        { name: "charge_id", type: "uuid", required: true, description: "The pending charge ID" },
        { name: "otp", type: "string", required: true, description: "OTP received by the customer" },
        { name: "flw_ref", type: "string", required: false, description: "Flutterwave reference (auto-resolved if omitted)" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/preauth" description="Create a preauthorized hold on a card (Stripe PaymentIntent with capture_method=manual)."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", amount: 50000, currency: "USD", customer_email: "john@example.com", tx_ref: "preauth_001" }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", status: "authorized", capture_mode: "manual", captured_amount: 0, client_secret: "pi_xxx_secret_yyy" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "amount", type: "number", required: true, description: "Amount to authorize" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default USD" },
        { name: "tx_ref", type: "string", required: true, description: "Unique transaction reference" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/{chargeId}/capture" description="Capture a previously authorized charge (full or partial)."
      requestBody={JSON.stringify({ amount: 25000 }, null, 2)}
      response={JSON.stringify({ id: "chg_uuid", status: "successful", captured_amount: 25000 }, null, 2)}
      parameters={[
        { name: "chargeId", type: "uuid", required: true, description: "The authorized charge ID" },
        { name: "amount", type: "number", required: false, description: "Partial capture amount (omit for full capture)" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/{chargeId}/void" description="Release an authorized hold without capturing."
      response={JSON.stringify({ id: "chg_uuid", status: "voided" }, null, 2)}
      parameters={[
        { name: "chargeId", type: "uuid", required: true, description: "The authorized charge ID to void" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/{chargeId}/verify" description="Verify a charge by polling the provider for the latest status."
      response={JSON.stringify({ id: "chg_uuid", status: "successful", provider: "flutterwave", provider_ref: "FLW-1234", verified_at: "2026-02-22T10:05:00Z" }, null, 2)}
      parameters={[
        { name: "chargeId", type: "uuid", required: true, description: "The charge ID to verify" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/charges/{chargeId}/cancel" description="Cancel a pending charge before provider processing."
      response={JSON.stringify({ id: "chg_uuid", status: "cancelled", cancelled_at: "2026-02-22T10:02:00Z" }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/charges?id={chargeId}" description="Retrieve a charge by ID."
      response={JSON.stringify({ id: "chg_uuid", status: "successful", amount: 5000, currency: "XAF", channel: "mobile_money", capture_mode: "auto" }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/charges?merchant_id={id}&status={status}&channel={channel}&from={date}&to={date}&limit=50&offset=0" description="List charges with filters."
      response={JSON.stringify({ data: [], total: 0, limit: 50, offset: 0 }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/fee-estimate?amount={amount}&channel={channel}&currency={currency}" description="Preview fees before creating a charge."
      response={JSON.stringify({ amount: 5000, currency: "XAF", channel: "mobile_money", fee_amount: 200, net_amount: 4800, fee_percentage: "3%", fixed_fee: 50 }, null, 2)}
      parameters={[
        { name: "amount", type: "number", required: true, description: "Transaction amount" },
        { name: "channel", type: "string", required: true, description: "mobile_money | card | bank_transfer" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
      ]}
    />

    {/* Code Examples */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Code Examples</h2>
      <CodeBlock
        title="Create a Mobile Money Charge"
        examples={[
          {
            language: "bash",
            label: "cURL",
            code: `curl -X POST https://api.kangopenbanking.com/v1/gateway-charges-router \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "merchant_id": "mch_uuid",
    "amount": 5000,
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "237677123456",
    "tx_ref": "order_001"
  }'`
          },
          {
            language: "javascript",
            label: "Node.js",
            code: `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({ apiKey: 'sk_live_...' });

const charge = await kob.charges.create({
  merchant_id: 'mch_uuid',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '237677123456',
  tx_ref: 'order_001',
});

console.log(charge.data.id);     // "chg_..."
console.log(charge.data.status); // "processing"`
          },
          {
            language: "python",
            label: "Python",
            code: `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(api_key="sk_live_...")

charge = kob.charges.create(
    merchant_id="mch_uuid",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="237677123456",
    tx_ref="order_001",
)
print(charge["data"]["id"])
print(charge["data"]["status"])`
          },
          {
            language: "php",
            label: "PHP",
            code: `<?php
use KangOpenBanking\\KangClient;

$kob = new KangClient('sk_live_...');

$charge = $kob->charges->create([
    'merchant_id' => 'mch_uuid',
    'amount' => 5000,
    'currency' => 'XAF',
    'channel' => 'mobile_money',
    'customer_phone' => '237677123456',
    'tx_ref' => 'order_001',
]);

echo $charge['data']['id'];`
          },
          {
            language: "go",
            label: "Go",
            code: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	body, _ := json.Marshal(map[string]interface{}{
		"merchant_id":    "mch_uuid",
		"amount":         5000,
		"currency":       "XAF",
		"channel":        "mobile_money",
		"customer_phone": "237677123456",
		"tx_ref":         "order_001",
	})
	req, _ := http.NewRequest("POST",
		"https://api.kangopenbanking.com/v1/gateway-charges-router",
		bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer sk_live_...")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "unique-key-001")

	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	fmt.Println("Status:", resp.Status)
}`
          },
          {
            language: "java",
            label: "Java",
            code: `import java.net.http.*;
import java.net.URI;

public class CreateCharge {
    public static void main(String[] args) throws Exception {
        String body = """
            {"merchant_id":"mch_uuid","amount":5000,
             "currency":"XAF","channel":"mobile_money",
             "customer_phone":"237677123456",
             "tx_ref":"order_001"}""";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.kangopenbanking.com/v1/gateway-charges-router"))
            .header("Authorization", "Bearer sk_live_...")
            .header("Content-Type", "application/json")
            .header("Idempotency-Key", "unique-key-001")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}`
          }
        ]}
      />
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
            { event: "charge.successful", desc: "Charge completed — funds collected from customer" },
            { event: "charge.failed", desc: "Charge failed — insufficient funds, declined, or timeout" },
            { event: "charge.authorized", desc: "Preauth hold placed — waiting for capture" },
            { event: "charge.captured", desc: "Preauth captured — funds collected" },
            { event: "charge.voided", desc: "Preauth voided — hold released without capture" },
            { event: "charge.refunded", desc: "Charge was refunded (full or partial)" },
          ].map(e => (
            <TableRow key={e.event}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.event}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>Fee Bearer</strong> — Set <code className="bg-muted px-1 rounded">fee_bearer: "customer"</code> to pass transaction fees to the customer. The charge amount stays the same, but the customer is charged amount + fee. Default is <code className="bg-muted px-1 rounded">merchant</code>.
      </AlertDescription>
    </Alert>

    <AutoDocNavigation />
  </div>
);

export default GatewayChargesGuide;
