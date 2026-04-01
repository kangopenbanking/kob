import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function ComplianceKyc() {
  return (
    <>
      <Helmet>
        <title>KYC Guide | Kang Open Banking Developer Docs</title>
        <meta name="description" content="KYC verification guide for Kang Open Banking API. Identity checks, document verification, tiered KYC levels, and COBAC compliance." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/compliance/kyc" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">KYC Verification</h1>
          <p className="text-lg text-muted-foreground">
            Know Your Customer (KYC) verification is required for processing payments above regulatory thresholds. The Kang API provides tiered KYC levels aligned with COBAC/BEAC regulations.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="tiers">KYC Tiers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Tier</th>
                  <th className="text-left p-3 font-medium text-foreground">Requirements</th>
                  <th className="text-left p-3 font-medium text-foreground">Transaction Limit</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tier 0 — Anonymous", "Phone number only", "50,000 XAF/day"],
                  ["Tier 1 — Basic", "Full name + date of birth + phone", "500,000 XAF/day"],
                  ["Tier 2 — Standard", "Tier 1 + government ID document", "5,000,000 XAF/day"],
                  ["Tier 3 — Enhanced", "Tier 2 + proof of address + source of funds", "Unlimited"],
                ].map(([tier, reqs, limit]) => (
                  <tr key={tier} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{tier}</td>
                    <td className="p-3 text-muted-foreground">{reqs}</td>
                    <td className="p-3 text-muted-foreground">{limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="submit">Submit KYC Verification</h2>
          <CodeBlock examples={[{ code: `curl -X POST https://api.kangopenbanking.com/v1/compliance/kyc/verify \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "customer_id": "cust_001",
    "tier": "standard",
    "identity": {
      "full_name": "Jean-Pierre Kamga",
      "date_of_birth": "1990-05-15",
      "nationality": "CM"
    },
    "document": {
      "type": "national_id",
      "number": "CM12345678",
      "issuing_country": "CM",
      "expiry_date": "2028-12-31"
    }
  }'

# Response
{
  "data": {
    "verification_id": "kyc_v_abc123",
    "status": "pending",
    "tier": "standard",
    "estimated_completion": "2026-03-27T15:00:00Z"
  }
}`, language: "bash" }]} title="Submit KYC Verification" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="documents">Accepted Documents</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Document Type</th>
                  <th className="text-left p-3 font-medium text-foreground">API Value</th>
                  <th className="text-left p-3 font-medium text-foreground">Accepted Countries</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["National ID Card", "national_id", "All CEMAC countries"],
                  ["Passport", "passport", "All countries"],
                  ["Driver's License", "drivers_license", "All CEMAC countries"],
                  ["Residence Permit", "residence_permit", "All countries"],
                ].map(([doc, value, countries]) => (
                  <tr key={doc} className="border-t border-border">
                    <td className="p-3 text-foreground">{doc}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{value}</td>
                    <td className="p-3 text-muted-foreground">{countries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
