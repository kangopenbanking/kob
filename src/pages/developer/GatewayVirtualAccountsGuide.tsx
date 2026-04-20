import { GuidePageShell, GuideSectionBlock } from "@/components/developer/GuidePageShell";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";

export default function GatewayVirtualAccountsGuide() {
  return (
    <GuidePageShell
      eyebrow="Payment Gateway"
      title="Virtual Accounts"
      description="Issue dedicated bank account numbers so your customers can pay you by transfer — automatically reconciled."
      readTime="4 min read"
      level="Intermediate"
      toc={[
        { id: "create", label: "Create" },
        { id: "list", label: "List" },
        { id: "get", label: "Get one" },
      ]}
    >
      <GuideSectionBlock id="create" title="Create a virtual account">
        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/virtual-accounts"
          description="Create a virtual account number for a merchant."
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
      </GuideSectionBlock>

      <GuideSectionBlock id="list" title="List virtual accounts">
        <ApiEndpoint
          method="GET"
          endpoint="/v1/gateway/virtual-accounts?merchant_id={id}"
          description="List all virtual accounts for a merchant."
          response={JSON.stringify({ data: [{ id: "va_uuid", account_number: "7825000123", bank_name: "Wema Bank", status: "active" }] }, null, 2)}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="get" title="Get one">
        <ApiEndpoint
          method="GET"
          endpoint="/v1/gateway/virtual-accounts/{accountId}"
          description="Get details of a specific virtual account."
          response={JSON.stringify({ id: "va_uuid", account_number: "7825000123", bank_name: "Wema Bank", currency: "NGN", status: "active" }, null, 2)}
        />
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
