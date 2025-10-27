import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

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
          All PISP endpoints require Strong Customer Authentication (SCA). Users must authorize payments through their banking app or SMS OTP.
        </AlertDescription>
      </Alert>

      {/* Payment Status Lifecycle */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Status Lifecycle</CardTitle>
          <CardDescription>Understanding payment states</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">Pending</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">AcceptedSettlementInProgress</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">AcceptedSettlementCompleted</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">Rejected</Badge>
            <span className="text-muted-foreground">/</span>
            <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">Failed</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Create Consent */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Consent Management</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/pisp-create-consent"
          description="Create a PISP consent for payment initiation"
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
    "Status": "AwaitingAuthorisation",
    "CreationDateTime": "2025-10-27T10:00:00Z",
    "StatusUpdateDateTime": "2025-10-27T10:00:00Z",
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
    "Self": "/pisp/consents/pisp_consent_xyz789"
  }
}`}
        />
      </div>

      {/* Domestic Payments */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Domestic Payments</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/pisp-domestic-payment"
          description="Initiate a domestic payment within Cameroon"
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
    "Status": "Pending",
    "CreationDateTime": "2025-10-27T10:05:00Z",
    "StatusUpdateDateTime": "2025-10-27T10:05:00Z",
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
    "Self": "/pisp/domestic-payments/pay_abc123"
  }
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/pisp-payment-submission"
          description="Submit a payment for processing after user authorization"
          requestBody={`{
  "Data": {
    "PaymentId": "pay_abc123"
  }
}`}
          response={`{
  "Data": {
    "DomesticPaymentId": "pay_abc123",
    "ConsentId": "pisp_consent_xyz789",
    "Status": "AcceptedSettlementInProgress",
    "CreationDateTime": "2025-10-27T10:05:00Z",
    "StatusUpdateDateTime": "2025-10-27T10:10:00Z",
    "ExpectedExecutionDateTime": "2025-10-27T14:00:00Z",
    "ExpectedSettlementDateTime": "2025-10-27T16:00:00Z"
  }
}`}
        />

        <ApiEndpoint
          method="GET"
          endpoint="/pisp-payment-details/{paymentId}"
          description="Retrieve payment status and details"
          parameters={[
            { name: "paymentId", type: "string", required: true, description: "Unique payment identifier" }
          ]}
          response={`{
  "Data": {
    "DomesticPaymentId": "pay_abc123",
    "ConsentId": "pisp_consent_xyz789",
    "Status": "AcceptedSettlementCompleted",
    "CreationDateTime": "2025-10-27T10:05:00Z",
    "StatusUpdateDateTime": "2025-10-27T16:00:00Z",
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
          endpoint="/bulk-transfers"
          description="Process multiple payments in a single batch"
          requestBody={`{
  "transfers": [
    {
      "amount": "10000.00",
      "currency": "XAF",
      "beneficiary_account": "677111222",
      "beneficiary_name": "Alice Johnson",
      "reference": "Salary Payment",
      "narration": "October Salary"
    },
    {
      "amount": "15000.00",
      "currency": "XAF",
      "beneficiary_account": "677333444",
      "beneficiary_name": "Bob Williams",
      "reference": "Salary Payment",
      "narration": "October Salary"
    }
  ],
  "batch_reference": "PAYROLL_OCT_2025"
}`}
          response={`{
  "batch_id": "batch_001",
  "status": "processing",
  "total_transfers": 2,
  "successful": 0,
  "failed": 0,
  "pending": 2,
  "created_at": "2025-10-27T10:00:00Z",
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
          endpoint="/swift-mt103-generator"
          description="Generate SWIFT MT103 message for international payment"
          requestBody={`{
  "ordering_customer": "John Doe\\n123 Main St\\nBamenda, Cameroon",
  "ordering_institution": "COBACMCX",
  "beneficiary": "Jane Smith\\n456 Oak Ave\\nParis, France",
  "beneficiary_institution": "BNPAFRPP",
  "amount": "1000.00",
  "currency": "EUR",
  "value_date": "2025-10-27",
  "remittance_info": "Invoice Payment INV-2025-001"
}`}
          response={`{
  "mt103_message": "{1:F01COBACMCXAXXX0000000000}...",
  "transaction_reference": "REF20251027001",
  "status": "generated"
}`}
        />
      </div>

      {/* Error Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Common Error Codes</CardTitle>
          <CardDescription>Handle these errors gracefully in your application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="font-mono text-sm font-semibold">INSUFFICIENT_FUNDS</p>
              <p className="text-sm text-muted-foreground">The debtor account has insufficient balance for the payment</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">INVALID_CONSENT</p>
              <p className="text-sm text-muted-foreground">The consent ID is invalid, expired, or has been revoked</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">ACCOUNT_BLOCKED</p>
              <p className="text-sm text-muted-foreground">The account is temporarily blocked or frozen</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">LIMIT_EXCEEDED</p>
              <p className="text-sm text-muted-foreground">Payment amount exceeds daily or transaction limits</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">SCA_REQUIRED</p>
              <p className="text-sm text-muted-foreground">Strong Customer Authentication is required for this payment</p>
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
            <p className="font-semibold mb-1">1. Implement Idempotency</p>
            <p className="text-sm text-muted-foreground">Use unique reference IDs to prevent duplicate payments if requests are retried.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">2. Monitor Payment Status</p>
            <p className="text-sm text-muted-foreground">Poll payment status or use webhooks to track payment progression through settlement.</p>
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

      <DocNavigation
        previousPage={{
          title: "AISP API Reference",
          path: "/developer/api/aisp"
        }}
        nextPage={{
          title: "Mobile Money API",
          path: "/developer/api/mobile-money"
        }}
      />
    </div>
  );
}
