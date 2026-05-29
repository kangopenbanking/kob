import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";

export default function GatewayVerificationGuide() {
  return (
    <GuidePageShell
      eyebrow="Payment Gateway"
      title="Identity & Bank Verification API"
      description="Verify CEMAC national identity (NIN/CNI), bank account ownership, and Nigerian BVN for KYC compliance."
      readTime="5 min read"
      level="Intermediate"
      toc={[
        { id: "nin", label: "Verify NIN (CEMAC)" },
        { id: "cni", label: "Verify CNI (CEMAC)" },
        { id: "bank", label: "Verify bank account" },
        { id: "bvn", label: "Resolve BVN (Nigeria)" },
      ]}
    >
      <GuideCallout variant="info" title="CEMAC vs Nigeria identity">
        For Cameroon, Gabon, Congo, Chad, CAR, and Equatorial Guinea use <code>/v1/verify/nin</code> or <code>/v1/verify/cni</code>. The Nigerian <code>BVN</code> endpoint is retained for NG deployments and now returns RFC 8594 <code>Deprecation</code> + RFC 8288 <code>Link: successor-version</code> headers when called from a CEMAC tenant.
      </GuideCallout>

      <GuideSectionBlock id="nin" title="Verify a CEMAC NIN">
        <ApiEndpoint
          method="POST"
          endpoint="/v1/verify/nin"
          description="Resolve a Numéro d'Identification National against the issuing authority (ANTIC for Cameroon; equivalent registries for GA/CG/TD/CF/GQ). Requires a customer consent."
          requestBody={JSON.stringify({ country: "CM", nin: "11999900001234", holder_first_name: "Jean", holder_last_name: "Mballa Ngono", holder_dob: "1990-05-12", consent_id: "5a7e2b40-9c63-4a01-a4d8-2b3a1f9d4c11" }, null, 2)}
          response={JSON.stringify({ match: true, score: 97, holder_full_name: "MBALLA NGONO Jean", holder_dob: "1990-05-12", issuing_authority: "ANTIC Cameroun", issued_at: "2018-03-14", expires_at: "2028-03-14", verified_at: "2026-05-29T10:00:00Z" }, null, 2)}
          parameters={[
            { name: "country", type: "string", required: true, description: "CEMAC ISO 3166-1 alpha-2 (CM, GA, CG, TD, CF, GQ)" },
            { name: "nin", type: "string", required: true, description: "National identification number — matches ^[A-Z0-9]{8,18}$" },
            { name: "consent_id", type: "uuid", required: true, description: "Active customer consent UUID v4" },
            { name: "holder_first_name", type: "string", required: false, description: "Improves match score" },
            { name: "holder_last_name", type: "string", required: false, description: "Improves match score" },
            { name: "holder_dob", type: "date", required: false, description: "ISO 8601 (YYYY-MM-DD)" },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="cni" title="Verify a CEMAC CNI">
        <ApiEndpoint
          method="POST"
          endpoint="/v1/verify/cni"
          description="Resolve a Carte Nationale d'Identité serial against the national civil registry. Mirrors /v1/verify/nin but keyed on the card serial rather than the lifetime NIN."
          requestBody={JSON.stringify({ country: "CM", cni_number: "110123456", holder_first_name: "Marie", holder_last_name: "Atangana", holder_dob: "1988-11-04", consent_id: "5a7e2b40-9c63-4a01-a4d8-2b3a1f9d4c11" }, null, 2)}
          response={JSON.stringify({ match: true, score: 88, holder_full_name: "ATANGANA Marie", holder_dob: "1988-11-04", issuing_authority: "DGSN Cameroun", issued_at: "2020-08-21", expires_at: "2030-08-21", verified_at: "2026-05-29T10:00:00Z" }, null, 2)}
          parameters={[
            { name: "country", type: "string", required: true, description: "CEMAC ISO 3166-1 alpha-2" },
            { name: "cni_number", type: "string", required: true, description: "Card serial — matches ^[A-Z0-9]{6,18}$" },
            { name: "consent_id", type: "uuid", required: true, description: "Active customer consent UUID v4" },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="bank" title="Verify a bank account">
        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/verify-bank-account"
          description="Resolve a bank account number to retrieve the account holder's name."
          requestBody={JSON.stringify({ account_number: "37001234567890123456789", account_bank: "10003", bank_country: "CM" }, null, 2)}
          response={JSON.stringify({ account_name: "MBALLA NGONO Jean", account_number: "37001234567890123456789", bank_name: "Afriland First Bank" }, null, 2)}
          parameters={[
            { name: "account_number", type: "string", required: true, description: "Bank account number (CEMAC: 23-digit RIB)" },
            { name: "account_bank", type: "string", required: true, description: "Bank code (CEMAC BIC stub or NG 3-digit)" },
            { name: "bank_country", type: "string", required: false, description: "ISO 3166-1 alpha-2 — defaults to CM" },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="bvn" title="Resolve a BVN (Nigeria only)">
        <GuideCallout variant="warning" title="CEMAC callers: use /v1/verify/nin instead">
          This endpoint targets the Nigerian Bank Verification Number registry. Responses include <code>Link: &lt;https://api.kangopenbanking.com/v1/verify/nin&gt;; rel="successor-version"</code> and <code>Deprecation</code> headers per RFC 8594/RFC 8288 to help CEMAC clients migrate.
        </GuideCallout>
        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/resolve-bvn"
          description="Resolve a BVN (Bank Verification Number) to retrieve identity details. Nigeria deployments only."
          requestBody={JSON.stringify({ bvn: "12345678901" }, null, 2)}
          response={JSON.stringify({ bvn: "12345678901", first_name: "John", last_name: "Doe", middle_name: "A", date_of_birth: "1990-01-15", phone_number: "08012345678" }, null, 2)}
          parameters={[{ name: "bvn", type: "string", required: true, description: "11-digit Bank Verification Number" }]}
        />
      </GuideSectionBlock>
    </GuidePageShell>
  );
}

  );
}
