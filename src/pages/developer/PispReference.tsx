import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function PispReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">PISP API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Payment Initiation Service Provider APIs for secure payment processing
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          All PISP POST endpoints require an <code className="bg-muted px-2 py-1 rounded">Idempotency-Key</code> header (UUID, 24h expiry) and Strong Customer Authentication (SCA).
        </AlertDescription>
      </Alert>

      {/* Payment Status Lifecycle */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Status Lifecycle</CardTitle>
          <CardDescription>Understanding payment states (v1 standard)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">pending</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">authorized</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">submitted</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">completed</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">failed</Badge>
            <span className="text-muted-foreground">/</span>
            <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">cancelled</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Create Consent */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Consent Management</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/v1/pisp/consents"
          description="Create a PISP consent for payment initiation. Requires Idempotency-Key header."
          requestBody={`{
  "Data": {
    "Initiation": {
      "InstructedAmount": {
        "Amount": "50000.00",
        "Currency": "XAF"
      },
      "CreditorAccount": {
        "Identification": "677123456",
        "Name": "Merchant Ltd"
      },
      "RemittanceInformation": {
        "Unstructured": "Payment for Invoice #12345"
      }
    }
  }
}`}
          response={`{
  "Data": {
    "ConsentId": "pisp_consent_xyz789",
    "Status": "pending",
    "CreationDateTime": "2026-02-16T10:00:00Z",
    "StatusUpdateDateTime": "2026-02-16T10:00:00Z",
    "Initiation": {
      "InstructedAmount": {
        "Amount": "50000.00",
        "Currency": "XAF"
      },
      "CreditorAccount": {
        "Identification": "677123456",
        "Name": "Merchant Ltd"
      }
    }
  },
  "Links": {
    "Self": "/v1/pisp/consents/pisp_consent_xyz789"
  }
}`}
        />
      </div>

      {/* Domestic Payments */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Domestic Payments</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/v1/pisp/domestic-payments"
          description="Initiate a domestic payment within Cameroon. Requires Idempotency-Key header."
          requestBody={`{
  "Data": {
    "ConsentId": "pisp_consent_xyz789",
    "Initiation": {
      "InstructedAmount": {
        "Amount": "50000.00",
        "Currency": "XAF"
      },
      "DebtorAccount": {
        "Identification": "677987654",
        "Name": "John Doe"
      },
      "CreditorAccount": {
        "Identification": "677123456",
        "Name": "Merchant Ltd"
      },
      "RemittanceInformation": {
        "Unstructured": "Payment for Invoice #12345"
      },
      "EndToEndIdentification": "ref_001"
    }
  }
}`}
          response={`{
  "Data": {
    "DomesticPaymentId": "pay_abc123",
    "ConsentId": "pisp_consent_xyz789",
    "Status": "pending",
    "CreationDateTime": "2026-02-16T10:05:00Z",
    "StatusUpdateDateTime": "2026-02-16T10:05:00Z",
    "Initiation": {
      "InstructedAmount": {
        "Amount": "50000.00",
        "Currency": "XAF"
      },
      "CreditorAccount": {
        "Identification": "677123456",
        "Name": "Merchant Ltd"
      },
      "RemittanceInformation": {
        "Unstructured": "Payment for Invoice #12345"
      }
    }
  },
  "Links": {
    "Self": "/v1/pisp/domestic-payments/pay_abc123"
  }
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/v1/pisp/payment-submission"
          description="Submit a payment for processing after user authorization. As of v4.29.3 the request must include the full payment instruction (payment_id, consent_id, amount, currency, debtor_account, creditor_account). Requires Idempotency-Key header."
          requestBody={`{
  "payment_id": "pay_abc123",
  "consent_id": "pisp_consent_xyz789",
  "amount": "50000",
  "currency": "XAF",
  "debtor_account": "10005-00001-09876543210-45",
  "creditor_account": "10005-00001-12345678901-23"
}`}
          response={`{
  "payment_id": "pay_abc123",
  "consent_id": "pisp_consent_xyz789",
  "status": "submitted",
  "creation_datetime": "2026-05-04T10:05:00Z",
  "status_update_datetime": "2026-05-04T10:10:00Z",
  "expected_execution_datetime": "2026-05-04T14:00:00Z",
  "expected_settlement_datetime": "2026-05-04T16:00:00Z"
}`}
        />

        <ApiEndpoint
          method="GET"
          endpoint="/v1/pisp/domestic-payments/{paymentId}"
          description="Retrieve payment status and details"
          parameters={[
            { name: "paymentId", type: "string", required: true, description: "Unique payment identifier" }
          ]}
          response={`{
  "Data": {
    "DomesticPaymentId": "pay_abc123",
    "ConsentId": "pisp_consent_xyz789",
    "Status": "completed",
    "CreationDateTime": "2026-02-16T10:05:00Z",
    "StatusUpdateDateTime": "2026-02-16T16:00:00Z",
    "Initiation": {
      "InstructedAmount": {
        "Amount": "50000.00",
        "Currency": "XAF"
      },
      "CreditorAccount": {
        "Identification": "677123456",
        "Name": "Merchant Ltd"
      }
    }
  }
}`}
        />
      </div>

      {/* Bulk Payments */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Bulk Payments</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/v1/pisp/bulk-transfers"
          description="Process multiple payments in a single batch. Requires Idempotency-Key header."
          requestBody={`{
  "transfers": [
    {
      "amount": "10000.00",
      "currency": "XAF",
      "beneficiary_account": "677111222",
      "beneficiary_name": "Alice Johnson",
      "reference": "Salary Payment",
      "narration": "February Salary"
    },
    {
      "amount": "15000.00",
      "currency": "XAF",
      "beneficiary_account": "677333444",
      "beneficiary_name": "Bob Williams",
      "reference": "Salary Payment",
      "narration": "February Salary"
    }
  ],
  "batch_reference": "PAYROLL_FEB_2026"
}`}
          response={`{
  "batch_id": "batch_001",
  "status": "processing",
  "total_transfers": 2,
  "successful": 0,
  "failed": 0,
  "pending": 2,
  "created_at": "2026-02-16T10:00:00Z",
  "transfers": [
    {
      "transfer_id": "txn_001",
      "status": "pending",
      "beneficiary_account": "677111222"
    },
    {
      "transfer_id": "txn_002",
      "status": "pending",
      "beneficiary_account": "677333444"
    }
  ]
}`}
        />
      </div>

      {/* International Payments (SWIFT) */}
      <div>
        <h2 className="text-2xl font-bold mb-4">International Payments</h2>
        
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            International payments use SWIFT MT103 messages and may take 1-3 business days to settle.
          </AlertDescription>
        </Alert>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/swift/mt103/generate"
          description="Generate SWIFT MT103 message for international payment. Requires Idempotency-Key header."
          requestBody={`{
  "ordering_customer": "John Doe\\n123 Main St\\nBamenda, Cameroon",
  "ordering_institution": "COBACMCX",
  "beneficiary": "Jane Smith\\n456 Oak Ave\\nParis, France",
  "beneficiary_institution": "BNPAFRPP",
  "amount": "1000.00",
  "currency": "EUR",
  "value_date": "2026-02-17",
  "remittance_info": "Invoice Payment INV-2026-001"
}`}
          response={`{
  "mt103_message": "{1:F01COBACMCXAXXX0000000000}...",
  "transaction_reference": "REF20260217001",
  "status": "generated"
}`}
        />
      </div>

      {/* Error Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Error Codes</CardTitle>
          <CardDescription>Domain-prefixed PISP error codes (RFC 7807)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="font-mono text-sm font-semibold">PISP_001</p>
              <p className="text-sm text-muted-foreground">Missing Idempotency-Key header on POST request</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">PISP_002</p>
              <p className="text-sm text-muted-foreground">Invalid or expired consent ID</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">PISP_003</p>
              <p className="text-sm text-muted-foreground">Account blocked or frozen</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">PISP_004</p>
              <p className="text-sm text-muted-foreground">Insufficient funds in debtor account</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">PISP_005</p>
              <p className="text-sm text-muted-foreground">Payment amount exceeds daily or transaction limits</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">PISP_006</p>
              <p className="text-sm text-muted-foreground">Strong Customer Authentication (SCA) required</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">PISP_007</p>
              <p className="text-sm text-muted-foreground">Duplicate Idempotency-Key with different payload</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
          <CardDescription>Ensure smooth payment processing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-semibold mb-1">1. Always Use Idempotency-Key</p>
            <p className="text-sm text-muted-foreground">Include a unique UUID in the Idempotency-Key header for all POST requests to prevent duplicate payments.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">2. Monitor Payment Status</p>
            <p className="text-sm text-muted-foreground">Poll payment status or use webhooks to track payment progression: pending → authorized → submitted → completed.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">3. Handle SCA Flow</p>
            <p className="text-sm text-muted-foreground">Provide clear UI for users to complete Strong Customer Authentication via their bank.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">4. Validate Before Submission</p>
            <p className="text-sm text-muted-foreground">Verify account numbers, amounts, and beneficiary details before initiating payments.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">5. Implement Webhooks</p>
            <p className="text-sm text-muted-foreground">Use webhooks to receive real-time payment status updates instead of constant polling.</p>
          </div>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
