import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { CheckCircle2, Wallet, Shield, Zap, Info, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const PaymentFacilitation = () => {
  return (
    <div className="space-y-8">
      <SEO
        title="Payment Facilitation API | Kang Open Banking"
        description="White-label payment processing API. Accept mobile money and bank transfers instantly using KOB's infrastructure — no KYB, no setup fees."
      />

      {/* Hero Section */}
      <div>
        <Badge className="mb-4">White-Label Payment Processing</Badge>
        <h1 className="text-4xl font-bold mb-4">Payment Facilitation API</h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Process payments using Kang Open Banking's infrastructure. No payment gateway account needed — start accepting mobile money and bank transfers immediately with automated settlements.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          All facilitated endpoints require Bearer authentication and an <code className="bg-muted px-2 py-1 rounded">Idempotency-Key</code> header. Your institution must have <code className="bg-muted px-2 py-1 rounded">use_kob_flutterwave</code> enabled.
        </AlertDescription>
      </Alert>

      {/* Benefits */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <Zap className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Instant Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No payment gateway account needed. Start processing payments in minutes with our facilitated endpoints.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Shield className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>No KYB Delays</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Skip the lengthy KYB verification process. Use our pre-verified business account immediately.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Wallet className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Automated Settlements</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Receive automatic payouts to your bank or mobile money account on your chosen schedule — daily, weekly, or monthly.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Payment Facilitation Works</CardTitle>
          <CardDescription>Simple 4-step process from registration to settlement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { step: 1, title: "Enable KOB Facilitation", desc: "Register as a Developer or Fintech and enable KOB facilitation on your institution profile. This flags your institution for facilitated payment processing." },
            { step: 2, title: "Configure Settlement Details", desc: "Set up your bank account or mobile money number for receiving settlements. Choose your settlement frequency (daily, weekly, or monthly)." },
            { step: 3, title: "Use Facilitated Endpoints", desc: "Call the facilitated mobile money charge and bank transfer endpoints to process payments through KOB's Flutterwave rail. KOB calculates and deducts fees automatically." },
            { step: 4, title: "Receive Automatic Settlements", desc: "KOB calculates your balance (inflows − outflows − fees) and sends settlements to your configured account on your chosen schedule." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">{step}</div>
              <div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Structure</CardTitle>
          <CardDescription>Transparent, usage-based pricing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div className="p-3 border rounded-lg text-center">
              <p className="text-2xl font-bold">3.5%</p>
              <p className="text-muted-foreground">Variable rate</p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <p className="text-2xl font-bold">100 XAF</p>
              <p className="text-muted-foreground">Fixed fee per transaction</p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <p className="text-2xl font-bold">$0</p>
              <p className="text-muted-foreground">Monthly / setup fees</p>
            </div>
          </div>
          <Alert>
            <AlertDescription>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" /><span>Fees only charged on successful transactions</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" /><span>Free settlements — no additional payout fees</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" /><span>Custom fee structures available for high-volume institutions</span></li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* API Endpoints */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Facilitated Mobile Money Collection</h2>
        <p className="text-muted-foreground mb-4">
          Initiate a mobile money charge using KOB's pre-verified Flutterwave account. The customer receives a payment prompt on their phone. On success, the transaction is tagged for settlement.
        </p>
        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/facilitated-mobile-money-charge"
          description="Initiate a facilitated mobile money collection via Flutterwave. KOB fee is calculated based on the institution's fee structure and the transaction is tagged for settlement."
          requestBody={JSON.stringify({
            phone_number: "237677123456",
            amount: 5000,
            currency: "XAF",
            email: "customer@example.com",
            redirect_url: "https://yoursite.com/payment/callback",
            metadata: { order_id: "ORD-12345", customer_name: "John Doe" }
          }, null, 2)}
          response={JSON.stringify({
            success: true,
            transaction_ref: "KOB-MM-1234567890-ABC123",
            transaction_id: "uuid",
            flutterwave_link: "https://payment.flutterwave.com/pay/...",
            kob_fee_amount: 275,
            net_amount: 4725
          }, null, 2)}
          parameters={[
            { name: "phone_number", type: "string", required: true, description: "Customer phone number (E.164 format, e.g., 237677123456)" },
            { name: "amount", type: "number", required: true, description: "Charge amount in smallest currency unit" },
            { name: "currency", type: "string", required: false, description: "ISO 4217 currency code (default: XAF)" },
            { name: "email", type: "string", required: false, description: "Customer email for receipt" },
            { name: "redirect_url", type: "string", required: false, description: "URL to redirect customer after payment" },
            { name: "metadata", type: "object", required: false, description: "Custom metadata (e.g., order_id, customer_name)" },
          ]}
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Facilitated Bank Transfer</h2>
        <p className="text-muted-foreground mb-4">
          Initiate an outbound bank transfer using KOB's Flutterwave rail. KOB calculates and deducts the facilitation fee, and the transaction is tagged for settlement.
        </p>
        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/facilitated-transfer"
          description="Institution-facilitated bank payout via Flutterwave with KOB fee calculation and settlement tracking."
          requestBody={JSON.stringify({
            account_bank: "SGCM",
            account_number: "1234567890",
            amount: 10000,
            currency: "XAF",
            narration: "Invoice payment",
            beneficiary_name: "Jane Doe",
            metadata: { invoice_id: "INV-98765" }
          }, null, 2)}
          response={JSON.stringify({
            success: true,
            transaction_ref: "KOB-BT-1234567890-XYZ789",
            transaction_id: "uuid",
            transfer_id: 12345,
            kob_fee_amount: 450,
            net_amount: 9550,
            status: "processing"
          }, null, 2)}
          parameters={[
            { name: "account_bank", type: "string", required: true, description: "Destination bank SWIFT/local code (e.g., SGCM)" },
            { name: "account_number", type: "string", required: true, description: "Destination bank account number" },
            { name: "amount", type: "number", required: true, description: "Transfer amount in smallest currency unit" },
            { name: "currency", type: "string", required: false, description: "ISO 4217 currency code (default: XAF)" },
            { name: "narration", type: "string", required: false, description: "Payment description" },
            { name: "beneficiary_name", type: "string", required: false, description: "Beneficiary name" },
            { name: "metadata", type: "object", required: false, description: "Custom metadata" },
          ]}
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Settlement Calculation</h2>
        <p className="text-muted-foreground mb-4">
          Calculate your current settlement balance for a given period. Returns total inflows, outflows, KOB fees, and the net amount available for settlement.
        </p>
        <ApiEndpoint
          method="POST"
          endpoint="/v1/settlement/calculate"
          description="Calculate the settlement balance for your institution over a given period."
          requestBody={JSON.stringify({
            period_start: "2026-01-01T00:00:00Z",
            period_end: "2026-01-31T23:59:59Z"
          }, null, 2)}
          response={JSON.stringify({
            success: true,
            institution_id: "uuid",
            institution_name: "Your Institution",
            period_start: "2026-01-01T00:00:00Z",
            period_end: "2026-01-31T23:59:59Z",
            total_inflows: 500000,
            total_outflows: 150000,
            total_kob_fees: 8750,
            net_settlement_amount: 341250,
            transaction_count: 58,
            meets_minimum_threshold: true,
            can_settle: true,
            breakdown: {
              mobile_money_inflows: 350000,
              mobile_money_outflows: 50000,
              mobile_money_fees: 6125,
              bank_transfer_inflows: 150000,
              bank_transfer_outflows: 100000,
              bank_transfer_fees: 2625
            }
          }, null, 2)}
          parameters={[
            { name: "period_start", type: "string", required: false, description: "Start of period (ISO 8601). Defaults to first day of current month." },
            { name: "period_end", type: "string", required: false, description: "End of period (ISO 8601). Defaults to now." },
          ]}
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Settlement Processing</h2>
        <p className="text-muted-foreground mb-4">
          Process a settlement payout to your institution's configured bank or mobile money account. <strong>Admin-only endpoint.</strong> Marks all unsettled transactions as settled and initiates the Flutterwave transfer.
        </p>
        <ApiEndpoint
          method="POST"
          endpoint="/v1/settlement/process"
          description="Process a settlement payout for a facilitated institution. Requires admin role."
          requestBody={JSON.stringify({
            institution_id: "uuid-of-institution",
            period_start: "2026-01-01T00:00:00Z",
            period_end: "2026-01-31T23:59:59Z"
          }, null, 2)}
          response={JSON.stringify({
            success: true,
            settlement_id: "uuid",
            settlement_ref: "SETTLEMENT-1234567890-ABC",
            net_amount: 341250,
            flutterwave_transfer_id: 12345,
            status: "processing"
          }, null, 2)}
          parameters={[
            { name: "institution_id", type: "uuid", required: true, description: "The institution to settle" },
            { name: "period_start", type: "string", required: true, description: "Settlement period start (ISO 8601)" },
            { name: "period_end", type: "string", required: true, description: "Settlement period end (ISO 8601)" },
          ]}
        />
      </div>

      {/* Error Codes */}
      <Card>
        <CardHeader><CardTitle>Error Codes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[160px_1fr] gap-2 text-sm">
            <Badge variant="destructive">401 Unauthorized</Badge>
            <span>Missing or invalid Bearer token</span>
            <Badge variant="destructive">INST_NOT_FOUND</Badge>
            <span>No institution found for the authenticated user</span>
            <Badge variant="destructive">NOT_ENABLED</Badge>
            <span>Institution not enabled for KOB facilitated payments (<code>use_kob_flutterwave = false</code>)</span>
            <Badge variant="destructive">FLW_CHARGE_FAIL</Badge>
            <span>Flutterwave mobile money charge initiation failed</span>
            <Badge variant="destructive">FLW_TRANSFER_FAIL</Badge>
            <span>Flutterwave bank transfer initiation failed</span>
            <Badge variant="destructive">BELOW_THRESHOLD</Badge>
            <span>Settlement amount is below the institution's minimum threshold</span>
            <Badge variant="destructive">NO_SETTLEMENT_ACCT</Badge>
            <span>Settlement bank/mobile money account not configured</span>
          </div>
        </CardContent>
      </Card>

      {/* Related Guides */}
      <Card>
        <CardHeader><CardTitle>Related Guides</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Link to="/developer/api/transfers" className="p-3 border rounded-lg hover:bg-accent transition-colors flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-sm">Transfers & Fund Movement</p>
                <p className="text-xs text-muted-foreground">All 7 transfer channels including facilitated transfers</p>
              </div>
            </Link>
            <Link to="/developer/gateway/settlements" className="p-3 border rounded-lg hover:bg-accent transition-colors flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-sm">Settlements</p>
                <p className="text-xs text-muted-foreground">Settlement lifecycle and reconciliation</p>
              </div>
            </Link>
            <Link to="/developer/gateway/webhooks" className="p-3 border rounded-lg hover:bg-accent transition-colors flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-sm">Webhooks</p>
                <p className="text-xs text-muted-foreground">Real-time payment status notifications</p>
              </div>
            </Link>
            <Link to="/payment-facilitation" className="p-3 border rounded-lg hover:bg-accent transition-colors flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-sm">Payment Facilitation Overview</p>
                <p className="text-xs text-muted-foreground">Marketing page with pricing and use cases</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
};

export default PaymentFacilitation;
