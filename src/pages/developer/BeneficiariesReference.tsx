import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function BeneficiariesReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Beneficiaries & Bank Lists API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Manage payment beneficiaries, retrieve supported bank lists, and validate account numbers
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Beneficiary endpoints require user authentication. Bank list and validation endpoints are available to all authenticated API clients.
        </AlertDescription>
      </Alert>

      {/* List Banks */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Bank Lists</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/banks"
          description="Retrieve the list of supported banks for a given country"
          parameters={[
            { name: "country", type: "string", required: false, description: "ISO 3166-1 alpha-2 country code (default: CM for Cameroon)" }
          ]}
          response={`{
  "banks": [
    {
      "id": 1,
      "code": "COBACMCX",
      "name": "Commercial Bank of Cameroon",
      "country": "CM"
    },
    {
      "id": 2,
      "code": "BGFICMCX",
      "name": "Banque Internationale du Cameroun pour l'Epargne et le Crédit",
      "country": "CM"
    }
  ],
  "country": "CM"
}`}
        />
      </div>

      {/* Validate Account */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Account Validation</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/banks/validate-account"
          description="Validate a bank account number and retrieve the account holder name. Requires Idempotency-Key header."
          requestBody={`{
  "account_number": "1234567890",
  "bank_code": "COBACMCX"
}`}
          response={`{
  "status": "success",
  "data": {
    "account_number": "1234567890",
    "account_name": "John Doe",
    "bank_code": "COBACMCX",
    "bank_name": "Commercial Bank of Cameroon",
    "is_valid": true
  }
}`}
        />
      </div>

      {/* Beneficiary CRUD */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Beneficiary Management</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/beneficiaries"
          description="Create a saved beneficiary for faster future payments. Requires Idempotency-Key header."
          requestBody={`{
  "beneficiary_name": "Jane Smith",
  "account_number": "9876543210",
  "bank_code": "BGFICMCX",
  "identification_scheme": "IBAN",
  "reference": "Supplier Payment"
}`}
          response={`{
  "beneficiary_id": "ben_abc123",
  "beneficiary_name": "Jane Smith",
  "account_number": "9876543210",
  "bank_code": "BGFICMCX",
  "bank_name": "BICEC",
  "is_active": true,
  "created_at": "2026-02-16T10:00:00Z"
}`}
        />

        <ApiEndpoint
          method="GET"
          endpoint="/v1/beneficiaries"
          description="List all saved beneficiaries for the authenticated user"
          parameters={[
            { name: "limit", type: "integer", required: false, description: "Items per page (default 25, max 100)" },
            { name: "offset", type: "integer", required: false, description: "Number of items to skip" }
          ]}
          response={`{
  "data": [
    {
      "beneficiary_id": "ben_abc123",
      "beneficiary_name": "Jane Smith",
      "account_number": "9876543210",
      "bank_code": "BGFICMCX",
      "is_active": true
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 25,
    "offset": 0,
    "has_more": false
  }
}`}
        />

        <ApiEndpoint
          method="DELETE"
          endpoint="/v1/beneficiaries/{beneficiaryId}"
          description="Deactivate a saved beneficiary"
          parameters={[
            { name: "beneficiaryId", type: "string", required: true, description: "Unique beneficiary identifier" }
          ]}
          response={`{
  "status": "success",
  "message": "Beneficiary deactivated"
}`}
        />
      </div>

      <AutoDocNavigation />
    </div>
  );
}
