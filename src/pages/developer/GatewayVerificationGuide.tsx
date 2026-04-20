import { GuidePageShell, GuideSectionBlock } from "@/components/developer/GuidePageShell";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";

export default function GatewayVerificationGuide() {
  return (
    <GuidePageShell
      eyebrow="Payment Gateway"
      title="Bank & BVN Verification API"
      description="Verify bank account ownership and resolve BVN identity details for KYC compliance."
      readTime="3 min read"
      level="Intermediate"
      toc={[
        { id: "bank", label: "Verify bank account" },
        { id: "bvn", label: "Resolve BVN" },
      ]}
    >
      <GuideSectionBlock id="bank" title="Verify a bank account">
        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/verify-bank-account"
          description="Resolve a bank account number to retrieve the account holder's name."
          requestBody={JSON.stringify({ account_number: "1234567890", account_bank: "044" }, null, 2)}
          response={JSON.stringify({ account_name: "John Doe", account_number: "1234567890" }, null, 2)}
          parameters={[
            { name: "account_number", type: "string", required: true, description: "Bank account number to verify" },
            { name: "account_bank", type: "string", required: true, description: "Bank code (e.g., 044 for Access Bank)" },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="bvn" title="Resolve a BVN">
        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/resolve-bvn"
          description="Resolve a BVN (Bank Verification Number) to retrieve identity details."
          requestBody={JSON.stringify({ bvn: "12345678901" }, null, 2)}
          response={JSON.stringify({ bvn: "12345678901", first_name: "John", last_name: "Doe", middle_name: "A", date_of_birth: "1990-01-15", phone_number: "08012345678" }, null, 2)}
          parameters={[{ name: "bvn", type: "string", required: true, description: "11-digit Bank Verification Number" }]}
        />
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
