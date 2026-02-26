import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Info, ArrowRight } from "lucide-react";
import { DocNavigation } from "@/components/developer/DocNavigation";
import { Link } from "react-router-dom";

export default function TransfersGuide() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Transfers & Fund Movement</h1>
        <p className="text-xl text-muted-foreground">
          Unified guide covering all transfer channels — internal accounts, external banks, mobile money, and gateway-powered fund movements
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          All POST transfer endpoints require an <code className="bg-muted px-2 py-1 rounded">Idempotency-Key</code> header and Bearer authentication. Amounts are in the smallest currency unit (e.g., 25000 = 25,000 XAF).
        </AlertDescription>
      </Alert>

      {/* Transfer Channel Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Channels Overview</CardTitle>
          <CardDescription>Six distinct transfer rails are available depending on the use case</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: "Internal Account-to-Account", endpoint: "POST /v1/banking/internal-transfer", badge: "KOB → KOB" },
              { label: "Bank-to-External-Bank", endpoint: "POST /v1/flutterwave/bank-transfer", badge: "Flutterwave" },
              { label: "Institution Facilitated Transfer", endpoint: "POST /v1/banking/facilitated-transfer", badge: "FI → Bank" },
              { label: "Mobile Money to Bank", endpoint: "POST /v1/mobile-money/to-bank", badge: "MoMo → Bank" },
              { label: "Account Funding via Gateway", endpoint: "POST /v1/gateway/fund-account", badge: "Inflow" },
              { label: "Withdrawal to External Bank", endpoint: "POST /v1/gateway/withdraw-to-bank", badge: "Outflow" },
            ].map((ch) => (
              <div key={ch.endpoint} className="flex items-start gap-3 p-3 border rounded-lg">
                <Badge variant="outline" className="shrink-0 mt-0.5">{ch.badge}</Badge>
                <div>
                  <p className="font-medium text-sm">{ch.label}</p>
                  <code className="text-xs text-muted-foreground">{ch.endpoint}</code>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 1. Internal Account Transfer */}
      <div>
        <h2 className="text-2xl font-bold mb-4">1. Internal Account-to-Account Transfer</h2>
        <p className="text-muted-foreground mb-4">
          Transfer funds between two accounts within KOB. The source account must belong to the authenticated user. Balance is validated before execution, and the transaction is recorded as a Debit entry.
        </p>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/internal-transfer"
          description="Move funds between KOB accounts atomically. Validates ownership, checks InterimAvailable balance, creates transaction, and updates balances."
          requestBody={`{
  "source_account_id": "uuid-of-source-account",
  "destination_account_id": "uuid-of-destination-account",
  "amount": 25000,
  "currency": "XAF",
  "reference": "TXN-CUSTOM-001",
  "description": "Rent payment to landlord"
}`}
          response={`{
  "success": true,
  "transaction_reference": "TXN-CUSTOM-001",
  "transaction_id": "uuid-of-transaction",
  "status": "Booked",
  "amount": 25000,
  "currency": "XAF"
}`}
          parameters={[
            { name: "source_account_id", type: "uuid", required: true, description: "Account to debit (must belong to authenticated user)" },
            { name: "destination_account_id", type: "uuid", required: true, description: "Account to credit (any valid KOB account)" },
            { name: "amount", type: "number", required: true, description: "Transfer amount in currency units" },
            { name: "currency", type: "string", required: false, description: "ISO 4217 currency code (default: XAF)" },
            { name: "reference", type: "string", required: false, description: "Custom reference (auto-generated if omitted)" },
            { name: "description", type: "string", required: false, description: "Transfer narration" },
          ]}
        />
      </div>

      {/* 2. Bank-to-External-Bank */}
      <div>
        <h2 className="text-2xl font-bold mb-4">2. Bank-to-External-Bank (Flutterwave)</h2>
        <p className="text-muted-foreground mb-4">
          Send funds to an external bank account using the Flutterwave payout rail. Supports all CEMAC region banks. Settlement is tracked via webhook callbacks.
        </p>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/flutterwave/bank-transfer"
          description="Initiate an outbound bank transfer via Flutterwave. Status updates delivered via payment.completed / payment.failed webhooks."
          requestBody={`{
  "account_number": "1234567890",
  "bank_code": "SGCM",
  "amount": 50000,
  "currency": "XAF",
  "narration": "Invoice payment"
}`}
          response={`{
  "status": "success",
  "data": {
    "id": "txn-uuid",
    "transaction_ref": "FLW-REF-001",
    "amount": 50000,
    "currency": "XAF",
    "status": "pending",
    "bank_name": "Société Générale Cameroun"
  }
}`}
        />
      </div>

      {/* 3. Institution Facilitated Transfer */}
      <div>
        <h2 className="text-2xl font-bold mb-4">3. Institution Facilitated Transfer</h2>
        <p className="text-muted-foreground mb-4">
          Financial institutions can initiate payouts on behalf of their customers through KOB. KOB calculates and deducts a facilitation fee, and the transaction is tracked for settlement.
        </p>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/facilitated-transfer"
          description="Institution-facilitated bank payout via Flutterwave. KOB fee is calculated based on the institution's fee structure and the transaction is tagged for settlement."
          requestBody={`{
  "account_number": "1234567890",
  "bank_code": "SGCM",
  "bank_name": "Société Générale Cameroun",
  "amount": 100000,
  "currency": "XAF",
  "narration": "Salary payment - March 2026",
  "institution_id": "uuid-of-institution",
  "account_name": "Jean Dupont"
}`}
          response={`{
  "id": "uuid",
  "transaction_ref": "KOB-FT-001",
  "amount": 100000,
  "kob_fee_amount": 1500,
  "currency": "XAF",
  "status": "pending",
  "bank_name": "Société Générale Cameroun",
  "account_number": "1234567890",
  "flutterwave_ref": "FLW-xxx",
  "created_at": "2026-02-26T12:00:00Z"
}`}
          parameters={[
            { name: "institution_id", type: "uuid", required: true, description: "The facilitating financial institution's ID" },
            { name: "account_number", type: "string", required: true, description: "Destination bank account number" },
            { name: "bank_code", type: "string", required: true, description: "Destination bank SWIFT/local code" },
            { name: "amount", type: "number", required: true, description: "Transfer amount" },
            { name: "narration", type: "string", required: false, description: "Payment description" },
          ]}
        />
      </div>

      {/* 4. Mobile Money to Bank */}
      <div>
        <h2 className="text-2xl font-bold mb-4">4. Mobile Money to Bank</h2>
        <p className="text-muted-foreground mb-4">
          Move funds from a mobile money wallet (MTN or Orange) directly to a bank account. The mobile money account is debited first, then a bank credit is initiated.
        </p>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/mobile-money/to-bank"
          description="Transfer funds from a mobile money wallet to an external bank account. Requires the sender's phone number and destination bank details."
          requestBody={`{
  "phone_number": "237650000000",
  "bank_code": "SGCM",
  "account_number": "123456789",
  "amount": 50000,
  "currency": "XAF"
}`}
          response={`{
  "status": "success",
  "transaction_ref": "MM2B-001",
  "amount": 50000,
  "fee": 750,
  "status": "processing"
}`}
        />
      </div>

      {/* 5. Account Funding */}
      <div>
        <h2 className="text-2xl font-bold mb-4">5. Account Funding via Gateway</h2>
        <p className="text-muted-foreground mb-4">
          Add funds to a KOB account using Mobile Money, Card, or Bank Transfer. On successful provider charge, the account balance is automatically credited via webhook.
          See <Link to="/developer/gateway/funding" className="text-primary underline">Account Funding Guide</Link> for details.
        </p>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/fund-account"
          description="Initiate a funding charge. Balance is credited automatically upon successful provider confirmation via webhook."
          requestBody={`{
  "amount": 50000,
  "channel": "mobile_money",
  "account_id": "uuid-of-kob-account",
  "source_phone": "237650000000",
  "currency": "XAF"
}`}
          response={`{
  "id": "charge-uuid",
  "account_id": "uuid",
  "amount": 50000,
  "fee_amount": 1250,
  "net_amount": 48750,
  "channel": "mobile_money",
  "status": "pending",
  "redirect_url": "https://...",
  "tx_ref": "FUND-xxx"
}`}
        />
      </div>

      {/* 6. Withdrawal to External Bank */}
      <div>
        <h2 className="text-2xl font-bold mb-4">6. Withdrawal to External Bank</h2>
        <p className="text-muted-foreground mb-4">
          Withdraw from a KOB account to an external bank account. The account is debited immediately; if the payout fails, the debit is automatically reversed via webhook.
          See <Link to="/developer/gateway/funding" className="text-primary underline">Account Funding Guide</Link> for details.
        </p>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/withdraw-to-bank"
          description="Withdraw to external bank via Flutterwave payout. Immediate debit with automatic reversal on failure."
          requestBody={`{
  "amount": 25000,
  "account_id": "uuid-of-kob-account",
  "bank_code": "SGCM",
  "account_number": "1234567890",
  "beneficiary_name": "Jean Dupont"
}`}
          response={`{
  "id": "withdrawal-uuid",
  "amount": 25000,
  "fee_amount": 500,
  "total_debited": 25500,
  "currency": "XAF",
  "status": "pending",
  "beneficiary_name": "Jean Dupont",
  "tx_ref": "WD-xxx"
}`}
        />
      </div>

      {/* Error Handling */}
      <Card>
        <CardHeader>
          <CardTitle>Error Handling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
            <Badge variant="destructive">400</Badge>
            <span>Missing required fields or insufficient funds</span>
            <Badge variant="destructive">401</Badge>
            <span>Missing or invalid authorization token</span>
            <Badge variant="destructive">404</Badge>
            <span>Source or destination account not found</span>
            <Badge variant="destructive">500</Badge>
            <span>Internal processing error — retry with same Idempotency-Key</span>
          </div>
        </CardContent>
      </Card>

      <DocNavigation
        previousPage={{ title: "Banking Operations", path: "/developer/api/banking" }}
        nextPage={{ title: "Webhooks", path: "/developer/api/webhooks" }}
      />
    </div>
  );
}
