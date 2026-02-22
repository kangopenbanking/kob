import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";

const GatewayVerificationGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Bank & BVN Verification API | Kang Open Banking" description="Verify bank accounts and resolve BVN (Bank Verification Number) for KYC." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Bank & BVN Verification API</h1>
      <p className="text-muted-foreground mt-2">Verify bank account ownership and resolve BVN identity details for KYC compliance under the gateway namespace.</p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/verify-bank-account" description="Resolve a bank account number to retrieve the account holder's name."
      requestBody={JSON.stringify({ account_number: "1234567890", account_bank: "044" }, null, 2)}
      response={JSON.stringify({ account_name: "John Doe", account_number: "1234567890" }, null, 2)}
      parameters={[
        { name: "account_number", type: "string", required: true, description: "Bank account number to verify" },
        { name: "account_bank", type: "string", required: true, description: "Bank code (e.g., 044 for Access Bank)" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/resolve-bvn" description="Resolve a BVN (Bank Verification Number) to retrieve identity details."
      requestBody={JSON.stringify({ bvn: "12345678901" }, null, 2)}
      response={JSON.stringify({ bvn: "12345678901", first_name: "John", last_name: "Doe", middle_name: "A", date_of_birth: "1990-01-15", phone_number: "08012345678" }, null, 2)}
      parameters={[
        { name: "bvn", type: "string", required: true, description: "11-digit Bank Verification Number" },
      ]}
    />
  </div>
);

export default GatewayVerificationGuide;
