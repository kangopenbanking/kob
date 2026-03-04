import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocNavigation } from "@/components/developer/DocNavigation";
import { Shield } from "lucide-react";

const ComplianceScreeningGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Compliance Screening API | Kang Open Banking" description="Pre-payout AML/sanctions screening, PEP identification, KYC risk scoring, velocity limits, and SAR filing — inline with every payout." />
    <div>
      <Badge variant="outline" className="mb-2">Compliance</Badge>
      <h1 className="text-3xl font-bold">Compliance Screening API</h1>
      <p className="text-muted-foreground mt-2">
        Run pre-payout compliance checks including AML/sanctions screening, PEP identification, KYC risk scoring, and velocity-based transaction limits. 
        All screenings return a pass/flag/block decision with detailed risk factors. Screening runs inline with every instant payout.
      </p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        Every payout submitted through the <a href="/developer/gateway/instant-payouts" className="text-primary underline">Instant Payouts API</a> automatically runs through the compliance screening pipeline before funds are dispatched. You can also call the screening endpoint directly for pre-validation or batch checks.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Screening Pipeline</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Beneficiary Submitted", "Sanctions Check", "PEP Check", "Velocity Check", "KYC Risk Score", "Decision: pass / flag / block"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* Decision Values */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Decision Values</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Decision</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">pass</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">All checks cleared</TableCell>
            <TableCell className="text-sm text-muted-foreground">Proceed with payout</TableCell>
          </TableRow>
          <TableRow>
            <TableCell><Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">flag</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">One or more checks raised warnings</TableCell>
            <TableCell className="text-sm text-muted-foreground">Manual review recommended</TableCell>
          </TableRow>
          <TableRow>
            <TableCell><Badge variant="destructive">block</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">Screening failed — high risk detected</TableCell>
            <TableCell className="text-sm text-muted-foreground">Payout must not proceed</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    {/* Check Types */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Check Types</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { type: "sanctions", title: "Sanctions Screening", desc: "Checks against UN, EU, OFAC SDN, CEMAC, and country-specific sanctions lists. Updated daily." },
          { type: "pep", title: "PEP Identification", desc: "Identifies Politically Exposed Persons and their associates. Cross-references global PEP databases." },
          { type: "velocity", title: "Velocity Limits", desc: "Monitors transaction frequency and volume against configurable daily/weekly/monthly limits." },
          { type: "kyc_risk", title: "KYC Risk Score", desc: "Calculates a composite risk score (0–100) based on user verification status, transaction history, and behavior patterns." },
        ].map(c => (
          <div key={c.type} className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{c.type}</code>
              <h4 className="font-medium text-sm">{c.title}</h4>
            </div>
            <p className="text-xs text-muted-foreground">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Sanctions Lists */}
    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Sanctions Lists Checked</h3>
      <div className="grid sm:grid-cols-2 gap-1 text-sm text-muted-foreground">
        {[
          "UN Consolidated Sanctions List",
          "EU Sanctions List",
          "OFAC Specially Designated Nationals (SDN)",
          "CEMAC Regional Sanctions",
          "Cameroon National Sanctions",
          "FATF High-Risk Jurisdictions",
        ].map(l => (
          <div key={l} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            <span>{l}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">Lists are updated daily from official sources.</p>
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="POST" endpoint="/v1/compliance/screen" description="Screen a transaction or beneficiary. Runs all selected check types and returns a composite decision."
      parameters={[
        { name: "beneficiary_name", type: "string", required: true, description: "Full legal name of the beneficiary" },
        { name: "beneficiary_country", type: "string", required: true, description: "ISO 3166-1 alpha-2 country code" },
        { name: "amount", type: "number", required: true, description: "Transaction amount" },
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "payer_id", type: "uuid", required: false, description: "Payer user ID for velocity checks" },
        { name: "check_types", type: "string[]", required: false, description: "Array: sanctions, pep, velocity, kyc_risk (default: all)" },
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

    <ApiEndpoint method="POST" endpoint="/v1/compliance/sar" description="File a Suspicious Activity Report (SAR) for regulatory submission."
      parameters={[
        { name: "subject_id", type: "uuid", required: true, description: "User ID of the subject" },
        { name: "transaction_ids", type: "uuid[]", required: false, description: "Related transaction IDs" },
        { name: "narrative", type: "string", required: true, description: "Detailed description of suspicious activity" },
        { name: "category", type: "string", required: true, description: "money_laundering, terrorist_financing, fraud, sanctions_evasion, other" },
      ]}
      response={JSON.stringify({
        data: { sar_id: "sar_001", status: "filed", filed_at: "2026-03-01T10:00:00Z", reference_number: "SAR-2026-000123" }
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/compliance/screenings?payer_id={id}&decision={decision}&limit=50" description="List past screening results with optional filters."
      response={JSON.stringify({
        data: [{ screening_id: "scr_001", decision: "pass", risk_score: 12, beneficiary_name: "Jean Dupont", screened_at: "2026-03-01T10:00:00Z" }],
        total: 1
      }, null, 2)}
    />

    {/* Code Example */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Code Example</h2>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Pre-screen a beneficiary before initiating a payout
const screening = await fetch('/v1/compliance/screen', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer sk_live_...', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    beneficiary_name: 'Jean Dupont',
    beneficiary_country: 'CM',
    amount: 500000,
    currency: 'XAF',
    payer_id: 'usr_uuid',
    check_types: ['sanctions', 'pep', 'velocity']
  })
});
const { data } = await screening.json();

if (data.decision === 'pass') {
  // Proceed with payout
} else if (data.decision === 'flag') {
  // Queue for manual review
} else {
  // Block payout, log incident
}`}
      </pre>
    </div>

    {/* Webhook Events */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Webhook Events</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { event: "compliance.screening.passed", desc: "Screening completed with pass decision" },
            { event: "compliance.screening.flagged", desc: "Screening raised warnings — manual review needed" },
            { event: "compliance.screening.blocked", desc: "Screening blocked — payout rejected" },
            { event: "compliance.sar.filed", desc: "SAR successfully filed with regulatory body" },
          ].map(e => (
            <TableRow key={e.event}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.event}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Shield className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>Inline Screening</strong> — When using the <a href="/developer/gateway/instant-payouts" className="text-primary underline">Instant Payouts API</a>, compliance screening runs automatically on every payout. You don't need to call this endpoint separately. The payout response includes a <code className="bg-muted px-1 rounded">compliance</code> object with the screening result.
      </AlertDescription>
    </Alert>

    <DocNavigation
      previousPage={{ title: "Escrow", path: "/developer/gateway/escrow" }}
      nextPage={{ title: "Instant Payouts", path: "/developer/gateway/instant-payouts" }}
    />
  </div>
);

export default ComplianceScreeningGuide;
