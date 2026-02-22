import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";

const GatewayVirtualAccountsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Virtual Accounts API | Kang Open Banking" description="Create dedicated virtual account numbers for pay-with-transfer collection." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Virtual Accounts API</h1>
      <p className="text-muted-foreground mt-2">Provision dedicated virtual account numbers so customers can pay via bank transfer. Credits are automatically reconciled as charges via webhooks.</p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/virtual-accounts" description="Create a virtual account number for a merchant."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", email: "merchant@example.com", currency: "NGN", is_permanent: false, narration: "KOB-MyStore" }, null, 2)}
      response={JSON.stringify({ id: "va_uuid", merchant_id: "mch_uuid", account_number: "7825000123", bank_name: "Wema Bank", currency: "NGN", status: "active", email: "merchant@example.com", created_at: "2026-02-22T10:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "email", type: "string", required: true, description: "Email for the virtual account" },
        { name: "bvn", type: "string", required: false, description: "BVN for KYC verification" },
        { name: "currency", type: "string", required: false, description: "Default NGN" },
        { name: "is_permanent", type: "boolean", required: false, description: "Whether the account is permanent (default false)" },
      ]}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/virtual-accounts?merchant_id={id}" description="List all virtual accounts for a merchant."
      response={JSON.stringify({ data: [{ id: "va_uuid", account_number: "7825000123", bank_name: "Wema Bank", status: "active" }] }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/virtual-accounts/{accountId}" description="Get details of a specific virtual account."
      response={JSON.stringify({ id: "va_uuid", account_number: "7825000123", bank_name: "Wema Bank", currency: "NGN", status: "active" }, null, 2)}
    />
  </div>
);

export default GatewayVirtualAccountsGuide;
