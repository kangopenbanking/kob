import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function SettlementsReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Settlements, Fees & Split Payments API Reference</h1>
        <p className="text-xl text-muted-foreground">
          View settlement schedules and reports, configure fee structures, and manage split payment commissions
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Settlement endpoints require institution-level authentication. Fee configuration is managed by platform admins.
        </AlertDescription>
      </Alert>

      {/* Settlement Schedule */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Settlement Schedules</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/settlements/schedule"
          description="Retrieve the settlement schedule for the authenticated institution"
          parameters={[
            { name: "from_date", type: "string", required: false, description: "Start date (YYYY-MM-DD)" },
            { name: "to_date", type: "string", required: false, description: "End date (YYYY-MM-DD)" }
          ]}
          response={`{
  "institution_id": "inst_001",
  "settlement_frequency": "daily",
  "next_settlement_date": "2026-02-17",
  "pending_amount": 1250000,
  "currency": "XAF",
  "upcoming": [
    {
      "date": "2026-02-17",
      "estimated_amount": 1250000,
      "transaction_count": 42
    }
  ]
}`}
        />
      </div>

      {/* Settlement Reports */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Settlement Reports</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/settlements/reports"
          description="Retrieve detailed settlement reports with transaction breakdown"
          parameters={[
            { name: "settlement_id", type: "string", required: false, description: "Specific settlement ID" },
            { name: "from_date", type: "string", required: false, description: "Start date (YYYY-MM-DD)" },
            { name: "to_date", type: "string", required: false, description: "End date (YYYY-MM-DD)" },
            { name: "limit", type: "integer", required: false, description: "Items per page (default 25, max 100)" },
            { name: "offset", type: "integer", required: false, description: "Number of items to skip" }
          ]}
          response={`{
  "data": [
    {
      "settlement_id": "stl_001",
      "settlement_date": "2026-02-16",
      "gross_amount": 1500000,
      "fees_deducted": 22500,
      "net_amount": 1477500,
      "currency": "XAF",
      "transaction_count": 38,
      "status": "completed",
      "bank_reference": "REF20260216001"
    }
  ],
  "pagination": {
    "total": 30,
    "limit": 25,
    "offset": 0,
    "has_more": true
  }
}`}
        />
      </div>

      {/* Fee Configuration */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Fee & Pricing</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/fees/schedule"
          description="Retrieve the fee schedule applicable to the authenticated institution"
          response={`{
  "institution_id": "inst_001",
  "pricing_tier": "premium",
  "fees": [
    {
      "transaction_type": "mobile_money_charge",
      "fee_type": "percentage",
      "rate": 1.5,
      "min_fee": 50,
      "max_fee": 10000,
      "currency": "XAF"
    },
    {
      "transaction_type": "bank_transfer",
      "fee_type": "flat",
      "amount": 500,
      "currency": "XAF"
    },
    {
      "transaction_type": "card_payment",
      "fee_type": "percentage",
      "rate": 2.9,
      "flat_addition": 100,
      "currency": "XAF"
    }
  ]
}`}
        />
      </div>

      {/* Split Payments */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Split Payments & Commissions</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/payments/split"
          description="Initiate a payment that is automatically split between multiple parties. Requires Idempotency-Key header."
          requestBody={`{
  "amount": 100000,
  "currency": "XAF",
  "payment_method": "mobile_money",
  "phone_number": "237677123456",
  "provider": "mtn",
  "tx_ref": "marketplace_order_001",
  "splits": [
    {
      "destination": "inst_merchant_001",
      "amount": 85000,
      "type": "merchant"
    },
    {
      "destination": "inst_platform",
      "amount": 15000,
      "type": "commission"
    }
  ]
}`}
          response={`{
  "payment_id": "pay_split_001",
  "status": "pending",
  "total_amount": 100000,
  "currency": "XAF",
  "splits": [
    {
      "destination": "inst_merchant_001",
      "amount": 85000,
      "status": "pending"
    },
    {
      "destination": "inst_platform",
      "amount": 15000,
      "status": "pending"
    }
  ],
  "created_at": "2026-02-16T10:00:00Z"
}`}
        />
      </div>

      {/* Sub-Merchant Settlements */}
      <Card>
        <CardHeader>
          <CardTitle>Sub-Merchant Settlement</CardTitle>
          <CardDescription>Settlement for facilitated payment sub-merchants</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Sub-merchants using KOB Payment Facilitation receive automated settlements based on their configured schedule. The platform fee (<code className="bg-muted px-1 rounded">kob_fee_amount</code>) is automatically deducted.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">T+1</Badge>
              <span className="text-sm text-muted-foreground">Mobile Money & bank transfers</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">T+2</Badge>
              <span className="text-sm text-muted-foreground">Card payments</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">T+3</Badge>
              <span className="text-sm text-muted-foreground">International transfers</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <DocNavigation
        previousPage={{
          title: "Beneficiaries & Bank Lists",
          path: "/developer/api/beneficiaries"
        }}
        nextPage={{
          title: "Disputes & Chargebacks",
          path: "/developer/api/disputes"
        }}
      />
    </div>
  );
}
