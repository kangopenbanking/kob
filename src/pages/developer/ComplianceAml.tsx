import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function ComplianceAml() {
  return (
    <>
      <Helmet>
        <title>AML & SAR Guide | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Anti-Money Laundering screening and Suspicious Activity Reporting via the Kang Open Banking API. COBAC/BEAC compliance for CEMAC." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/compliance/aml" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">AML Screening & Suspicious Activity Reporting</h1>
          <p className="text-lg text-muted-foreground">
            The Kang API provides automated AML screening against sanctions lists, PEP databases, and adverse media. File SARs programmatically when suspicious activity is detected.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="screening">AML Screening</h2>
          <CodeBlock examples={[{ code: `curl -X POST https://api.kangopenbanking.com/v1/compliance/screening \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -d '{
    "entity_type": "individual",
    "full_name": "Jean Kamga",
    "date_of_birth": "1990-05-15",
    "nationality": "CM",
    "screening_types": ["sanctions", "pep", "adverse_media"]
  }'

# Response
{
  "data": {
    "screening_id": "scr_abc123",
    "status": "clear",
    "matches": [],
    "screened_at": "2026-03-27T14:32:00Z",
    "lists_checked": ["UN", "EU", "OFAC", "CEMAC", "FATF"]
  }
}`, language: "bash" }]} title="AML Screening Request" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="sar">File SAR</h2>
          <CodeBlock examples={[{ code: `curl -X POST https://api.kangopenbanking.com/v1/compliance/sar \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject_id": "cust_001",
    "transaction_ids": ["tx_abc", "tx_def"],
    "suspicious_activity_type": "structuring",
    "description": "Multiple transactions just below reporting threshold",
    "total_amount": "4800000",
    "currency": "XAF"
  }'`, language: "bash" }]} title="File Suspicious Activity Report" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="thresholds">Regulatory Thresholds</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Threshold</th>
                  <th className="text-left p-3 font-medium text-foreground">Amount</th>
                  <th className="text-left p-3 font-medium text-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Single transaction reporting", "5,000,000 XAF", "Automatic report to ANIF"],
                  ["Daily aggregate reporting", "10,000,000 XAF", "Automatic report to ANIF"],
                  ["Enhanced due diligence", "500,000 XAF", "Tier 2+ KYC required"],
                  ["PEP transactions", "Any amount", "Enhanced monitoring applied"],
                ].map(([threshold, amount, action]) => (
                  <tr key={threshold} className="border-t border-border">
                    <td className="p-3 text-foreground">{threshold}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{amount}</td>
                    <td className="p-3 text-muted-foreground">{action}</td>
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
