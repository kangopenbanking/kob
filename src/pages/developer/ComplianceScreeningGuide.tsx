import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

const ComplianceScreeningGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Compliance Screening API | Kang Open Banking" description="Pre-payout AML/sanctions screening, KYC risk scoring, PEP checks, and velocity limits." />
    <div>
      <Badge variant="outline" className="mb-2">Compliance</Badge>
      <h1 className="text-3xl font-bold">Compliance Screening API</h1>
      <p className="text-muted-foreground mt-2">
        Run pre-payout compliance checks including AML/sanctions screening, PEP identification, KYC risk scoring, and velocity-based transaction limits. 
        All screenings return a pass/flag/block decision with detailed risk factors.
      </p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/compliance/screen" description="Screen a transaction or beneficiary before processing a payout."
      parameters={[
        { name: "beneficiary_name", type: "string", required: true, description: "Full legal name of the beneficiary" },
        { name: "beneficiary_country", type: "string", required: true, description: "ISO 3166-1 alpha-2 country code" },
        { name: "amount", type: "number", required: true, description: "Transaction amount" },
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "payer_id", type: "uuid", required: false, description: "Payer user ID for velocity checks" },
        { name: "check_types", type: "string[]", required: false, description: "Array of check types: sanctions, pep, velocity, kyc_risk (default: all)" },
      ]}
      response={JSON.stringify({
        data: {
          screening_id: "scr_001",
          decision: "pass",
          risk_score: 12,
          checks: [
            { type: "sanctions", result: "clear", lists_checked: ["UN", "EU", "OFAC", "CEMAC"] },
            { type: "pep", result: "clear" },
            { type: "velocity", result: "pass", daily_total: 150000, daily_limit: 5000000 },
            { type: "kyc_risk", result: "low", score: 12 },
          ],
          screened_at: "2026-03-01T10:00:00Z"
        }
      }, null, 2)}
    />

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Decision Values</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li><strong>pass</strong> — All checks cleared; proceed with payout</li>
        <li><strong>flag</strong> — One or more checks raised warnings; manual review recommended</li>
        <li><strong>block</strong> — Screening failed; payout must not proceed</li>
      </ul>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Sanctions Lists</h3>
      <p className="text-sm text-muted-foreground">
        Screenings check against UN Consolidated List, EU Sanctions, OFAC SDN List, CEMAC regional sanctions, 
        and country-specific lists for Cameroon and CEMAC member states. Lists are updated daily.
      </p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/compliance/sar" description="File a Suspicious Activity Report (SAR) for regulatory submission."
      parameters={[
        { name: "subject_id", type: "uuid", required: true, description: "User ID of the subject" },
        { name: "transaction_ids", type: "uuid[]", required: false, description: "Related transaction IDs" },
        { name: "narrative", type: "string", required: true, description: "Detailed description of suspicious activity" },
        { name: "category", type: "string", required: true, description: "SAR category: money_laundering, terrorist_financing, fraud, sanctions_evasion, other" },
      ]}
      response={JSON.stringify({
        data: { sar_id: "sar_001", status: "filed", filed_at: "2026-03-01T10:00:00Z", reference_number: "SAR-2026-000123" }
      }, null, 2)}
    />

    <DocNavigation
      previousPage={{ title: "Escrow", path: "/developer/gateway/escrow" }}
      nextPage={{ title: "Instant Payouts", path: "/developer/gateway/instant-payouts" }}
    />
  </div>
);

export default ComplianceScreeningGuide;
