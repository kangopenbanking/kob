import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { SecuredResponseSamples } from "@/components/developer/SecuredResponseSamples";

export default function AispReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">AISP API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Account Information Service Provider APIs for accessing customer account data with consent
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          All AISP endpoints require a valid <code className="bg-muted px-2 py-1 rounded">x-consent-id</code> header with an active AISP consent.
        </AlertDescription>
      </Alert>

      <section>
        <h2 className="text-2xl font-bold mb-2">Error responses on every secured endpoint</h2>
        <p className="text-muted-foreground mb-4">
          Every AISP operation can return the following standardised error envelopes (RFC 7807 <code>application/problem+json</code>). Implement handlers for both before going live — they map directly to <code>components.responses.Unauthorized</code> and <code>components.responses.Forbidden</code> in the spec.
        </p>
        <SecuredResponseSamples endpoint="GET /v1/aisp/accounts" scopeRequired="accounts:read" />
      </section>

      {/* Create Consent */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Consent Management</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/v1/aisp/consents"
          description="Create a new AISP consent to access customer account information"
          requestBody={`{
  "Data": {
    "Permissions": [
      "ReadAccountsBasic",
      "ReadAccountsDetail",
      "ReadBalances",
      "ReadTransactionsBasic",
      "ReadTransactionsDetail"
    ],
    "ExpirationDateTime": "2026-12-31T23:59:59Z"
  }
}`}
          response={`{
  "Data": {
    "ConsentId": "consent_abc123",
    "Status": "AwaitingAuthorisation",
    "CreationDateTime": "2026-02-16T10:00:00Z",
    "StatusUpdateDateTime": "2026-02-16T10:00:00Z",
    "Permissions": [
      "ReadAccountsBasic",
      "ReadAccountsDetail",
      "ReadBalances",
      "ReadTransactionsBasic",
      "ReadTransactionsDetail"
    ],
    "ExpirationDateTime": "2026-12-31T23:59:59Z"
  }
}`}
        />
      </div>

      {/* Accounts */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Accounts</h2>
        
        <ApiEndpoint
          method="GET"
          endpoint="/v1/aisp/accounts"
          description="Retrieve all accounts associated with the authenticated customer"
          parameters={[
            { name: "x-consent-id", type: "string", required: true, description: "Valid AISP consent ID" }
          ]}
          response={`{
  "Data": {
    "Account": [
      {
        "AccountId": "acc_123456",
        "Currency": "XAF",
        "AccountType": "Savings",
        "AccountSubType": "Savings",
        "Nickname": "Personal Savings",
        "Account": {
          "Identification": "677123456",
          "Name": "John Doe",
          "SecondaryIdentification": "00001"
        }
      }
    ]
  },
  "Links": {
    "Self": "/v1/aisp/accounts"
  }
}`}
        />

        <ApiEndpoint
          method="GET"
          endpoint="/v1/aisp/accounts/{accountId}"
          description="Get detailed information for a specific account"
          parameters={[
            { name: "accountId", type: "string", required: true, description: "Unique account identifier" },
            { name: "x-consent-id", type: "string", required: true, description: "Valid AISP consent ID" }
          ]}
          response={`{
  "Data": {
    "Account": {
      "AccountId": "acc_123456",
      "Currency": "XAF",
      "AccountType": "Savings",
      "AccountSubType": "Savings",
      "Nickname": "Personal Savings",
      "OpeningDate": "2023-01-15",
      "MaturityDate": null,
      "Account": {
        "Identification": "677123456",
        "Name": "John Doe"
      }
    }
  }
}`}
        />
      </div>

      {/* Balances */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Balances</h2>
        
        <ApiEndpoint
          method="GET"
          endpoint="/v1/aisp/accounts/{accountId}/balances"
          description="Retrieve current balance information for an account"
          parameters={[
            { name: "accountId", type: "string", required: true, description: "Unique account identifier" },
            { name: "x-consent-id", type: "string", required: true, description: "Valid AISP consent ID" }
          ]}
          response={`{
  "Data": {
    "Balance": [
      {
        "AccountId": "acc_123456",
        "Amount": {
          "Amount": "250000.00",
          "Currency": "XAF"
        },
        "CreditDebitIndicator": "Credit",
        "Type": "InterimAvailable",
        "DateTime": "2026-02-16T10:00:00Z"
      },
      {
        "AccountId": "acc_123456",
        "Amount": {
          "Amount": "245000.00",
          "Currency": "XAF"
        },
        "CreditDebitIndicator": "Credit",
        "Type": "InterimBooked",
        "DateTime": "2026-02-16T10:00:00Z"
      }
    ]
  }
}`}
        />
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Transactions</h2>
        
        <ApiEndpoint
          method="GET"
          endpoint="/v1/aisp/accounts/{accountId}/transactions"
          description="Retrieve transaction history for an account with optional filtering and pagination"
          parameters={[
            { name: "accountId", type: "string", required: true, description: "Unique account identifier" },
            { name: "x-consent-id", type: "string", required: true, description: "Valid AISP consent ID" },
            { name: "fromBookingDateTime", type: "string", required: false, description: "Start date for transaction history (ISO 8601)" },
            { name: "toBookingDateTime", type: "string", required: false, description: "End date for transaction history (ISO 8601)" },
            { name: "limit", type: "integer", required: false, description: "Number of results per page (default: 25, max: 100)" },
            { name: "offset", type: "integer", required: false, description: "Offset for pagination (default: 0)" }
          ]}
          response={`{
  "Data": {
    "Transaction": [
      {
        "AccountId": "acc_123456",
        "TransactionId": "txn_789",
        "Amount": {
          "Amount": "15000.00",
          "Currency": "XAF"
        },
        "CreditDebitIndicator": "Debit",
        "Status": "Booked",
        "BookingDateTime": "2026-02-15T14:30:00Z",
        "TransactionInformation": "Mobile Money Transfer",
        "Balance": {
          "Amount": {
            "Amount": "235000.00",
            "Currency": "XAF"
          },
          "CreditDebitIndicator": "Credit",
          "Type": "InterimBooked"
        }
      }
    ]
  },
  "Meta": {
    "TotalCount": 156,
    "Limit": 25,
    "Offset": 0
  }
}`}
        />
      </div>

      {/* Beneficiaries */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Beneficiaries</h2>
        
        <ApiEndpoint
          method="GET"
          endpoint="/v1/aisp/accounts/{accountId}/beneficiaries"
          description="Get list of beneficiaries for an account"
          parameters={[
            { name: "accountId", type: "string", required: true, description: "Unique account identifier" },
            { name: "x-consent-id", type: "string", required: true, description: "Valid AISP consent ID" }
          ]}
          response={`{
  "Data": {
    "Beneficiary": [
      {
        "AccountId": "acc_123456",
        "BeneficiaryId": "ben_001",
        "Reference": "Monthly Rent",
        "CreditorAccount": {
          "Identification": "677987654",
          "Name": "Jane Smith"
        }
      }
    ]
  }
}`}
        />
      </div>

      {/* Standing Orders */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Standing Orders</h2>
        
        <ApiEndpoint
          method="GET"
          endpoint="/v1/aisp/accounts/{accountId}/standing-orders"
          description="Retrieve standing orders configured for an account"
          parameters={[
            { name: "accountId", type: "string", required: true, description: "Unique account identifier" },
            { name: "x-consent-id", type: "string", required: true, description: "Valid AISP consent ID" }
          ]}
          response={`{
  "Data": {
    "StandingOrder": [
      {
        "AccountId": "acc_123456",
        "StandingOrderId": "so_001",
        "Frequency": "Monthly",
        "Reference": "Subscription Payment",
        "FirstPaymentDateTime": "2026-01-01T00:00:00Z",
        "NextPaymentDateTime": "2026-03-01T00:00:00Z",
        "FinalPaymentDateTime": "2027-01-01T00:00:00Z",
        "FirstPaymentAmount": {
          "Amount": "5000.00",
          "Currency": "XAF"
        },
        "CreditorAccount": {
          "Identification": "677555444",
          "Name": "Service Provider"
        }
      }
    ]
  }
}`}
        />
      </div>

      {/* Direct Debits */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Direct Debits</h2>
        
        <ApiEndpoint
          method="GET"
          endpoint="/v1/aisp/accounts/{accountId}/direct-debits"
          description="Get direct debit mandates for an account"
          parameters={[
            { name: "accountId", type: "string", required: true, description: "Unique account identifier" },
            { name: "x-consent-id", type: "string", required: true, description: "Valid AISP consent ID" }
          ]}
          response={`{
  "Data": {
    "DirectDebit": [
      {
        "AccountId": "acc_123456",
        "DirectDebitId": "dd_001",
        "MandateIdentification": "mandate_123",
        "DirectDebitStatusCode": "Active",
        "Name": "Utility Company",
        "PreviousPaymentDateTime": "2026-01-27T00:00:00Z",
        "PreviousPaymentAmount": {
          "Amount": "12000.00",
          "Currency": "XAF"
        }
      }
    ]
  }
}`}
        />
      </div>

      {/* Best Practices */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
          <CardDescription>Tips for implementing AISP APIs effectively</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-semibold mb-1">1. Request Minimal Permissions</p>
            <p className="text-sm text-muted-foreground">Only request the permissions your application actually needs to improve user trust and consent rates.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">2. Handle Consent Expiry</p>
            <p className="text-sm text-muted-foreground">Monitor consent expiration dates and prompt users to renew consent before it expires.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">3. Cache Appropriately</p>
            <p className="text-sm text-muted-foreground">Cache account data to reduce API calls, but refresh balances and transactions regularly for accuracy.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">4. Implement Error Handling</p>
            <p className="text-sm text-muted-foreground">Handle consent revocation, account closures, and temporary service unavailability gracefully.</p>
          </div>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
