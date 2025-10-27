import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

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
          Banking operations APIs are designed for financial institutions and enterprise applications requiring advanced banking functionality.
        </AlertDescription>
      </Alert>

      {/* Transaction Reconciliation */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Transaction Reconciliation</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/bank-reconcile"
          description="Reconcile bank transactions with internal records"
          requestBody={`{
  "account_id": "acc_123456",
  "start_date": "2025-10-01",
  "end_date": "2025-10-27",
  "expected_balance": "500000.00"
}`}
          response={`{
  "status": "success",
  "reconciliation_id": "recon_001",
  "account_id": "acc_123456",
  "period": {
    "start_date": "2025-10-01",
    "end_date": "2025-10-27"
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
  },
  "unmatched_transactions": [
    {
      "transaction_id": "txn_789",
      "date": "2025-10-15",
      "amount": "5000.00",
      "type": "debit",
      "description": "Unknown transaction"
    }
  ]
}`}
        />
      </div>

      {/* Bank Statement Generation */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Statement Generation</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/generate-bank-statement"
          description="Generate PDF bank statements for a specified period"
          requestBody={`{
  "account_id": "acc_123456",
  "start_date": "2025-10-01",
  "end_date": "2025-10-31",
  "format": "pdf",
  "include_images": true
}`}
          response={`{
  "status": "success",
  "statement_id": "stmt_001",
  "account_id": "acc_123456",
  "period": {
    "start_date": "2025-10-01",
    "end_date": "2025-10-31"
  },
  "download_url": "https://storage.example.com/statements/stmt_001.pdf",
  "expires_at": "2025-11-27T10:00:00Z",
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
          endpoint="/iso20022-pain001-parser"
          description="Parse ISO 20022 pain.001 payment initiation messages"
          requestBody={`{
  "xml_message": "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<Document xmlns=\\"urn:iso:std:iso:20022:tech:xsd:pain.001.001.09\\">...</Document>"
}`}
          response={`{
  "status": "success",
  "message_id": "MSG20251027001",
  "creation_date_time": "2025-10-27T10:00:00Z",
  "number_of_transactions": 1,
  "control_sum": "50000.00",
  "payment_information": {
    "payment_id": "PMT001",
    "requested_execution_date": "2025-10-28",
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
        "remittance_info": "Invoice INV-2025-001"
      }
    ]
  }
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/iso20022-pacs008-generator"
          description="Generate ISO 20022 pacs.008 payment instruction messages"
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
  "remittance_info": "Invoice INV-2025-001"
}`}
          response={`{
  "status": "success",
  "message_id": "PACS20251027001",
  "xml_message": "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<Document xmlns=\\"urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08\\">...</Document>",
  "created_at": "2025-10-27T10:00:00Z"
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/iso20022-camt053-parser"
          description="Parse ISO 20022 camt.053 bank statement messages"
          requestBody={`{
  "xml_message": "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<Document xmlns=\\"urn:iso:std:iso:20022:tech:xsd:camt.053.001.08\\">...</Document>"
}`}
          response={`{
  "status": "success",
  "statement_id": "STMT001",
  "account": "1234567890",
  "currency": "XAF",
  "from_date": "2025-10-01",
  "to_date": "2025-10-31",
  "opening_balance": {
    "amount": "450000.00",
    "date": "2025-10-01"
  },
  "closing_balance": {
    "amount": "500000.00",
    "date": "2025-10-31"
  },
  "entries": [
    {
      "entry_reference": "E001",
      "amount": "15000.00",
      "credit_debit_indicator": "CRDT",
      "booking_date": "2025-10-15",
      "value_date": "2025-10-15",
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
          endpoint="/swift-mt103-generator"
          description="Generate SWIFT MT103 single customer credit transfer messages"
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
  "status": "success",
  "mt103_message": "{1:F01COBACMCXAXXX0000000000}{2:O1030800251027BNPAFRPPAXXX00000000002510270800N}{3:{108:REF20251027001}}{4:\\n:20:REF20251027001\\n:23B:CRED\\n:32A:251027EUR1000,00\\n:50K:John Doe\\n123 Main St\\nBamenda, Cameroon\\n:52A:COBACMCX\\n:59:Jane Smith\\n456 Oak Ave\\nParis, France\\n:70:Invoice Payment INV-2025-001\\n-}",
  "transaction_reference": "REF20251027001",
  "created_at": "2025-10-27T10:00:00Z"
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/swift-mt103-parser"
          description="Parse SWIFT MT103 messages"
          requestBody={`{
  "mt103_message": "{1:F01COBACMCXAXXX0000000000}{2:O1030800251027BNPAFRPPAXXX00000000002510270800N}{3:{108:REF20251027001}}{4:\\n:20:REF20251027001\\n:23B:CRED\\n:32A:251027EUR1000,00\\n:50K:John Doe\\n123 Main St\\nBamenda, Cameroon\\n:52A:COBACMCX\\n:59:Jane Smith\\n456 Oak Ave\\nParis, France\\n:70:Invoice Payment INV-2025-001\\n-}"
}`}
          response={`{
  "status": "success",
  "transaction_reference": "REF20251027001",
  "bank_operation_code": "CRED",
  "value_date": "2025-10-27",
  "amount": "1000.00",
  "currency": "EUR",
  "ordering_customer": "John Doe\\n123 Main St\\nBamenda, Cameroon",
  "ordering_institution": "COBACMCX",
  "beneficiary": "Jane Smith\\n456 Oak Ave\\nParis, France",
  "beneficiary_institution": "BNPAFRPP",
  "remittance_info": "Invoice Payment INV-2025-001"
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/swift-mt940-parser"
          description="Parse SWIFT MT940 customer statement messages"
          requestBody={`{
  "mt940_message": "{1:F01COBACMCXAXXX0000000000}{2:I940COBACMCXXXXXN}{4:\\n:20:STMT001\\n:25:1234567890\\n:28C:1/1\\n:60F:C251001XAF450000,00\\n:61:2510151015C15000,00NMSCNONREF//E001\\n:86:Customer Payment\\n:62F:C251031XAF500000,00\\n-}"
}`}
          response={`{
  "status": "success",
  "statement_reference": "STMT001",
  "account_identification": "1234567890",
  "statement_number": "1",
  "sequence_number": "1",
  "opening_balance": {
    "amount": "450000.00",
    "currency": "XAF",
    "date": "2025-10-01",
    "credit_debit": "C"
  },
  "closing_balance": {
    "amount": "500000.00",
    "currency": "XAF",
    "date": "2025-10-31",
    "credit_debit": "C"
  },
  "transactions": [
    {
      "value_date": "2025-10-15",
      "entry_date": "2025-10-15",
      "credit_debit": "C",
      "amount": "15000.00",
      "transaction_code": "NMSC",
      "reference": "NONREF",
      "transaction_details": "E001",
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
          endpoint="/bank-sync"
          description="Synchronize bank account data with external banking systems"
          requestBody={`{
  "institution_id": "inst_001",
  "accounts": ["acc_123456", "acc_789012"]
}`}
          response={`{
  "status": "success",
  "sync_id": "sync_001",
  "institution_id": "inst_001",
  "synced_accounts": 2,
  "sync_timestamp": "2025-10-27T10:00:00Z",
  "results": [
    {
      "account_id": "acc_123456",
      "status": "synced",
      "transactions_fetched": 15,
      "last_transaction_date": "2025-10-26"
    },
    {
      "account_id": "acc_789012",
      "status": "synced",
      "transactions_fetched": 8,
      "last_transaction_date": "2025-10-25"
    }
  ]
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
            <p className="font-semibold mb-1">3. Archive Statements Securely</p>
            <p className="text-sm text-muted-foreground">Store generated statements with encryption and maintain audit trails.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">4. Monitor Message Processing</p>
            <p className="text-sm text-muted-foreground">Track ISO 20022 and SWIFT message lifecycle for compliance and troubleshooting.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">5. Handle Bulk Operations Efficiently</p>
            <p className="text-sm text-muted-foreground">Use batch processing for large transaction volumes to optimize performance.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
