import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

export default function DisputesReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Disputes & Chargebacks API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Manage card payment disputes, submit evidence, and track chargeback outcomes
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Disputes apply to card payments processed through the Stripe integration. Mobile money and bank transfer disputes are handled through separate reversal flows.
        </AlertDescription>
      </Alert>

      {/* Dispute Lifecycle */}
      <Card>
        <CardHeader>
          <CardTitle>Dispute Status Lifecycle</CardTitle>
          <CardDescription>Understanding dispute states</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">open</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">evidence_submitted</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">won</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">lost</Badge>
            <span className="text-muted-foreground">/</span>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-400">under_review</Badge>
          </div>
        </CardContent>
      </Card>

      {/* List Disputes */}
      <div>
        <h2 className="text-2xl font-bold mb-4">List Disputes</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/disputes"
          description="List all disputes for the authenticated merchant or institution"
          parameters={[
            { name: "status", type: "string", required: false, description: "Filter by status (open, evidence_submitted, won, lost, under_review)" },
            { name: "from_date", type: "string", required: false, description: "Start date (YYYY-MM-DD)" },
            { name: "to_date", type: "string", required: false, description: "End date (YYYY-MM-DD)" },
            { name: "limit", type: "integer", required: false, description: "Items per page (default 25, max 100)" },
            { name: "offset", type: "integer", required: false, description: "Number of items to skip" }
          ]}
          response={`{
  "data": [
    {
      "dispute_id": "dsp_001",
      "payment_id": "pay_card_abc",
      "amount": 15000,
      "currency": "XAF",
      "reason": "fraudulent",
      "status": "open",
      "evidence_due_by": "2026-03-02T23:59:59Z",
      "created_at": "2026-02-16T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 25,
    "offset": 0,
    "has_more": false
  }
}`}
        />
      </div>

      {/* Get Dispute Details */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Get Dispute Details</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/disputes/{disputeId}"
          description="Retrieve full details of a specific dispute including evidence and timeline"
          parameters={[
            { name: "disputeId", type: "string", required: true, description: "Unique dispute identifier" }
          ]}
          response={`{
  "dispute_id": "dsp_001",
  "payment_id": "pay_card_abc",
  "amount": 15000,
  "currency": "XAF",
  "reason": "fraudulent",
  "status": "open",
  "evidence_due_by": "2026-03-02T23:59:59Z",
  "original_transaction": {
    "card_last4": "4242",
    "card_brand": "visa",
    "customer_email": "customer@example.com",
    "amount": 15000,
    "created_at": "2026-02-10T14:00:00Z"
  },
  "timeline": [
    {
      "event": "dispute_opened",
      "timestamp": "2026-02-16T10:00:00Z",
      "details": "Cardholder reported fraudulent charge"
    }
  ]
}`}
        />
      </div>

      {/* Submit Evidence */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Submit Evidence</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/disputes/{disputeId}/evidence"
          description="Submit evidence to contest a dispute. Requires Idempotency-Key header."
          requestBody={`{
  "evidence_type": "receipt",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "product_description": "Digital subscription - Premium Plan",
  "service_date": "2026-02-10",
  "receipt_url": "https://storage.kangopenbanking.com/receipts/inv_12345.pdf",
  "additional_notes": "Customer purchased via website, delivery confirmed by email"
}`}
          response={`{
  "dispute_id": "dsp_001",
  "status": "evidence_submitted",
  "evidence_submitted_at": "2026-02-16T12:00:00Z",
  "expected_resolution_date": "2026-03-16"
}`}
        />
      </div>

      {/* Dispute Reason Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Dispute Reason Codes</CardTitle>
          <CardDescription>Common chargeback reason categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="font-mono text-sm font-semibold">fraudulent</p>
              <p className="text-sm text-muted-foreground">Cardholder claims they did not authorize the charge</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">duplicate</p>
              <p className="text-sm text-muted-foreground">Cardholder was charged multiple times for the same transaction</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">product_not_received</p>
              <p className="text-sm text-muted-foreground">Customer claims goods or services were not delivered</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">product_unacceptable</p>
              <p className="text-sm text-muted-foreground">Product or service did not match description</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">subscription_canceled</p>
              <p className="text-sm text-muted-foreground">Customer claims charge after subscription cancellation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DocNavigation
        previousPage={{
          title: "Settlements & Fees",
          path: "/developer/api/settlements"
        }}
        nextPage={{
          title: "Transaction Exports",
          path: "/developer/api/exports"
        }}
      />
    </div>
  );
}
