import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

export default function RefundsReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Refunds & Reversals API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Initiate full or partial refunds for payments, mobile money charges, and card transactions
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          All refund POST endpoints require an <code className="bg-muted px-2 py-1 rounded">Idempotency-Key</code> header (UUID, 24h expiry). Refunds are processed asynchronously; use webhooks for status updates.
        </AlertDescription>
      </Alert>

      {/* Refund Status Lifecycle */}
      <Card>
        <CardHeader>
          <CardTitle>Refund Status Lifecycle</CardTitle>
          <CardDescription>Understanding refund states (v1 standard)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">pending</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">processing</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">completed</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">failed</Badge>
            <span className="text-muted-foreground">/</span>
            <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">rejected</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Initiate Refund */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Initiate Refund</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/payments/refund"
          description="Create a full or partial refund for a completed payment. Requires Idempotency-Key header."
          requestBody={`{
  "payment_id": "pay_abc123",
  "amount": 25000,
  "currency": "XAF",
  "reason": "customer_request",
  "notes": "Customer returned goods"
}`}
          response={`{
  "refund_id": "ref_xyz789",
  "payment_id": "pay_abc123",
  "amount": 25000,
  "currency": "XAF",
  "status": "pending",
  "reason": "customer_request",
  "created_at": "2026-02-16T10:30:00Z"
}`}
        />
      </div>

      {/* Get Refund Status */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Get Refund Status</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/payments/refunds/{refundId}"
          description="Retrieve the status and details of a refund"
          parameters={[
            { name: "refundId", type: "string", required: true, description: "Unique refund identifier" }
          ]}
          response={`{
  "refund_id": "ref_xyz789",
  "payment_id": "pay_abc123",
  "amount": 25000,
  "currency": "XAF",
  "status": "completed",
  "reason": "customer_request",
  "created_at": "2026-02-16T10:30:00Z",
  "completed_at": "2026-02-16T11:00:00Z"
}`}
        />
      </div>

      {/* List Refunds */}
      <div>
        <h2 className="text-2xl font-bold mb-4">List Refunds</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/payments/refunds"
          description="List all refunds with pagination and filtering"
          parameters={[
            { name: "payment_id", type: "string", required: false, description: "Filter by original payment ID" },
            { name: "status", type: "string", required: false, description: "Filter by status (pending, processing, completed, failed)" },
            { name: "limit", type: "integer", required: false, description: "Items per page (default 25, max 100)" },
            { name: "offset", type: "integer", required: false, description: "Number of items to skip" }
          ]}
          response={`{
  "data": [
    {
      "refund_id": "ref_xyz789",
      "payment_id": "pay_abc123",
      "amount": 25000,
      "currency": "XAF",
      "status": "completed",
      "created_at": "2026-02-16T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 25,
    "offset": 0,
    "has_more": false
  }
}`}
        />
      </div>

      {/* Mobile Money Reversal */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Mobile Money Reversal</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/mobile-money/reverse"
          description="Reverse a mobile money charge. Only available within 24 hours of the original transaction. Requires Idempotency-Key header."
          requestBody={`{
  "transaction_id": "4534334",
  "tx_ref": "order_12345",
  "amount": 5000
}`}
          response={`{
  "status": "success",
  "message": "Reversal initiated",
  "data": {
    "reversal_id": "rev_mm_001",
    "original_transaction_id": "4534334",
    "amount": 5000,
    "currency": "XAF",
    "status": "processing"
  }
}`}
        />
      </div>

      {/* Error Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Error Codes</CardTitle>
          <CardDescription>Domain-prefixed refund error codes (RFC 7807)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="font-mono text-sm font-semibold">PISP_010</p>
              <p className="text-sm text-muted-foreground">Original payment not found or not eligible for refund</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">PISP_011</p>
              <p className="text-sm text-muted-foreground">Refund amount exceeds original payment amount</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">PISP_012</p>
              <p className="text-sm text-muted-foreground">Refund window expired (maximum 90 days for payments, 24h for mobile money)</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">PISP_013</p>
              <p className="text-sm text-muted-foreground">Duplicate refund — a refund for this payment is already in progress</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DocNavigation
        previousPage={{
          title: "PISP API Reference",
          path: "/developer/api/pisp"
        }}
        nextPage={{
          title: "Beneficiaries & Bank Lists",
          path: "/developer/api/beneficiaries"
        }}
      />
    </div>
  );
}
