import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { DocNavigation } from "@/components/developer/DocNavigation";

export default function BankingReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Banking Operations API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Advanced banking features including reconciliation, bulk transfers, and ISO 20022 / SWIFT message handling
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Banking operations APIs are designed for financial institutions and enterprise applications. All POST endpoints require an <code className="bg-muted px-2 py-1 rounded">Idempotency-Key</code> header.
        </AlertDescription>
      </Alert>

      {/* Transaction Reconciliation */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Transaction Reconciliation</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/reconcile"
          description="Reconcile bank transactions with internal records. Requires Idempotency-Key header."
          requestBody={`{
  "account_id": "acc_123456",
  "start_date": "2026-02-01",
  "end_date": "2026-02-16",
  "expected_balance": "500000.00"
}`}
          response={`{
  "status": "success",
  "reconciliation_id": "recon_001",
  "account_id": "acc_123456",
  "period": {
    "start_date": "2026-02-01",
    "end_date": "2026-02-16"
  },
  "summary": {
    "total_transactions": 156,
    "matched": 150,
    "unmatched": 6,
    "discrepancies": 2
  },
  "balances": {
    "opening_balance": "450000.00",
    "closing_balance": "500000.00",
    "expected_balance": "500000.00",
    "difference": "0.00"
  }
}`}
        />
      </div>

      {/* Bank Statement Generation */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Statement Generation</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/statement"
          description="Generate PDF bank statements for a specified period. Requires Idempotency-Key header."
          requestBody={`{
  "account_id": "acc_123456",
  "start_date": "2026-02-01",
  "end_date": "2026-02-28",
  "format": "pdf",
  "include_images": true
}`}
          response={`{
  "status": "success",
  "statement_id": "stmt_001",
  "account_id": "acc_123456",
  "period": {
    "start_date": "2026-02-01",
    "end_date": "2026-02-28"
  },
  "download_url": "https://storage.kangopenbanking.com/statements/stmt_001.pdf",
  "expires_at": "2026-03-16T10:00:00Z",
  "summary": {
    "opening_balance": "450000.00",
    "closing_balance": "500000.00",
    "total_credits": "150000.00",
    "total_debits": "100000.00",
    "transaction_count": 45
  }
}`}
        />
      </div>

      {/* ISO 20022 Messages */}
      <div>
        <h2 className="text-2xl font-bold mb-4">ISO 20022 Message Handling</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/iso20022/pain001"
          description="Parse ISO 20022 pain.001 payment initiation messages. Requires Idempotency-Key header."
          requestBody={`{
  "xml_message": "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<Document xmlns=\\"urn:iso:std:iso:20022:tech:xsd:pain.001.001.09\\">...</Document>"
}`}
          response={`{
  "status": "success",
  "message_id": "MSG20260216001",
  "creation_date_time": "2026-02-16T10:00:00Z",
  "number_of_transactions": 1,
  "control_sum": "50000.00",
  "payment_information": {
    "payment_id": "PMT001",
    "requested_execution_date": "2026-02-17",
    "debtor": {
      "name": "ABC Corporation",
      "account": "1234567890"
    },
    "debtor_agent": "COBACMCX",
    "transactions": [
      {
        "instruction_id": "INSTR001",
        "end_to_end_id": "E2E001",
        "amount": "50000.00",
        "currency": "XAF",
        "creditor": {
          "name": "XYZ Ltd",
          "account": "9876543210"
        },
        "creditor_agent": "BGFICMCX",
        "remittance_info": "Invoice INV-2026-001"
      }
    ]
  }
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/iso20022/pacs008"
          description="Generate ISO 20022 pacs.008 payment instruction messages. Requires Idempotency-Key header."
          requestBody={`{
  "instruction_id": "INSTR001",
  "end_to_end_id": "E2E001",
  "amount": "50000.00",
  "currency": "XAF",
  "debtor_name": "ABC Corporation",
  "debtor_account": "1234567890",
  "debtor_agent": "COBACMCX",
  "creditor_name": "XYZ Ltd",
  "creditor_account": "9876543210",
  "creditor_agent": "BGFICMCX",
  "remittance_info": "Invoice INV-2026-001"
}`}
          response={`{
  "status": "success",
  "message_id": "PACS20260216001",
  "xml_message": "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<Document xmlns=\\"urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08\\">...</Document>",
  "created_at": "2026-02-16T10:00:00Z"
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/iso20022/camt053"
          description="Parse ISO 20022 camt.053 bank statement messages. Requires Idempotency-Key header."
          requestBody={`{
  "xml_message": "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<Document xmlns=\\"urn:iso:std:iso:20022:tech:xsd:camt.053.001.08\\">...</Document>"
}`}
          response={`{
  "status": "success",
  "statement_id": "STMT001",
  "account": "1234567890",
  "currency": "XAF",
  "from_date": "2026-02-01",
  "to_date": "2026-02-28",
  "opening_balance": {
    "amount": "450000.00",
    "date": "2026-02-01"
  },
  "closing_balance": {
    "amount": "500000.00",
    "date": "2026-02-28"
  },
  "entries": [
    {
      "entry_reference": "E001",
      "amount": "15000.00",
      "credit_debit_indicator": "CRDT",
      "booking_date": "2026-02-15",
      "value_date": "2026-02-15",
      "remittance_info": "Customer Payment"
    }
  ]
}`}
        />
      </div>

      {/* SWIFT Messages */}
      <div>
        <h2 className="text-2xl font-bold mb-4">SWIFT Message Handling</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/swift/mt103/generate"
          description="Generate SWIFT MT103 single customer credit transfer messages. Requires Idempotency-Key header."
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
  "status": "success",
  "mt103_message": "{1:F01COBACMCXAXXX0000000000}...",
  "transaction_reference": "REF20260217001",
  "created_at": "2026-02-16T10:00:00Z"
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/swift/mt103/parse"
          description="Parse SWIFT MT103 messages. Requires Idempotency-Key header."
          requestBody={`{
  "mt103_message": "{1:F01COBACMCXAXXX0000000000}{2:O1030800260217BNPAFRPPAXXX00000000002602170800N}..."
}`}
          response={`{
  "status": "success",
  "transaction_reference": "REF20260217001",
  "bank_operation_code": "CRED",
  "value_date": "2026-02-17",
  "amount": "1000.00",
  "currency": "EUR",
  "ordering_customer": "John Doe\\n123 Main St\\nBamenda, Cameroon",
  "ordering_institution": "COBACMCX",
  "beneficiary": "Jane Smith\\n456 Oak Ave\\nParis, France",
  "beneficiary_institution": "BNPAFRPP",
  "remittance_info": "Invoice Payment INV-2026-001"
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/swift/mt940/parse"
          description="Parse SWIFT MT940 customer statement messages. Requires Idempotency-Key header."
          requestBody={`{
  "mt940_message": "{1:F01COBACMCXAXXX0000000000}{2:I940COBACMCXXXXXN}{4:\\n:20:STMT001\\n:25:1234567890\\n...}"
}`}
          response={`{
  "status": "success",
  "statement_reference": "STMT001",
  "account_identification": "1234567890",
  "opening_balance": {
    "amount": "450000.00",
    "currency": "XAF",
    "date": "2026-02-01"
  },
  "closing_balance": {
    "amount": "500000.00",
    "currency": "XAF",
    "date": "2026-02-28"
  },
  "transactions": [
    {
      "value_date": "2026-02-15",
      "credit_debit": "C",
      "amount": "15000.00",
      "information": "Customer Payment"
    }
  ]
}`}
        />
      </div>

      {/* Bank Synchronization */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Bank Account Synchronization</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/v1/banking/sync"
          description="Synchronize bank account data with external banking systems. Requires Idempotency-Key header."
          requestBody={`{
  "institution_id": "inst_001",
  "accounts": ["acc_123456", "acc_789012"]
}`}
          response={`{
  "status": "success",
  "sync_id": "sync_001",
  "institution_id": "inst_001",
  "synced_accounts": 2,
  "sync_timestamp": "2026-02-16T10:00:00Z",
  "results": [
    {
      "account_id": "acc_123456",
      "status": "synced",
      "transactions_fetched": 15,
      "last_transaction_date": "2026-02-15"
    }
  ]
}`}
        />
      </div>

      {/* Account Funding & Withdrawals */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Account Funding & Withdrawals</h2>
        <p className="text-muted-foreground mb-4">
          Add funds to user accounts via Mobile Money, Card, or Bank Transfer. Withdraw from accounts to external banks.
          See the full <a href="/developer/gateway/funding" className="text-primary underline">Account Funding & Withdrawals Guide</a> for details.
        </p>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/fund-account"
          description="Fund a KOB account via Mobile Money (Flutterwave), Card (Stripe), or Bank Transfer. Auto-credits on webhook completion."
          requestBody={`{
  "amount": 50000,
  "currency": "XAF",
  "channel": "mobile_money",
  "account_id": "acc_uuid",
  "source_phone": "237677123456"
}`}
          response={`{
  "id": "chg_uuid",
  "account_id": "acc_uuid",
  "amount": 50000,
  "status": "processing",
  "fee_amount": 1250,
  "redirect_url": "https://checkout.flutterwave.com/..."
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/withdraw-to-bank"
          description="Withdraw funds from a KOB account to an external bank via Flutterwave transfer. Debits immediately; reverses on failure."
          requestBody={`{
  "amount": 25000,
  "account_id": "acc_uuid",
  "bank_code": "SGCM",
  "account_number": "1234567890",
  "beneficiary_name": "Jean Dupont"
}`}
          response={`{
  "id": "pay_uuid",
  "amount": 25000,
  "fee_amount": 575,
  "total_debited": 25575,
  "status": "processing"
}`}
        />
      </div>

      {/* Best Practices */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
          <CardDescription>Enterprise banking integration guidelines</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-semibold mb-1">1. Validate Message Standards</p>
            <p className="text-sm text-muted-foreground">Ensure ISO 20022 and SWIFT messages comply with version-specific schemas before submission.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">2. Implement Reconciliation Workflows</p>
            <p className="text-sm text-muted-foreground">Schedule daily reconciliation jobs to identify discrepancies early.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">3. Use Account Funding APIs</p>
            <p className="text-sm text-muted-foreground">Use the gateway fund-account and withdraw-to-bank endpoints for user-initiated account operations with automatic webhook-driven finalization.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">4. Use Idempotency-Key Headers</p>
            <p className="text-sm text-muted-foreground">All POST requests must include a unique Idempotency-Key UUID to prevent duplicate processing.</p>
          </div>
        </CardContent>
      </Card>

      <DocNavigation
        previousPage={{
          title: "Mobile Money API",
          path: "/developer/api/mobile-money"
        }}
        nextPage={{
          title: "Webhooks",
          path: "/developer/api/webhooks"
        }}
      />
    </div>
  );
}
