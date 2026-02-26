import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Search, FileText, Users, Clock } from "lucide-react";

export default function AmlCftPack() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <Badge variant="outline" className="mb-4">KOB-REG-005 — Phase 3: AML/CFT Compliance</Badge>
      <h1 className="text-3xl font-bold mb-2">AML/CFT Compliance Pack</h1>
      <p className="text-muted-foreground mb-8">Per CEMAC Regulation No. 01/03-CEMAC-UMAC-COBAC, GABAC Mutual Evaluation Standards, and FATF Recommendations</p>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle>1.0 AML/CFT Policy Statement</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-3">
          <p>Kang Open Banking S.A. is committed to the prevention, detection, and reporting of money laundering, terrorist financing, and proliferation financing. This policy establishes the Company's obligations under CEMAC AML Regulation No. 01/03, as amended, and is aligned with the 40 Recommendations of the Financial Action Task Force (FATF).</p>
          <p>The MLRO bears primary responsibility for the implementation of this policy. All staff receive mandatory AML/CFT training within 30 days of joining and annual refresher training thereafter.</p>
          <p><strong>Supervisory authorities:</strong> ANIF (Agence Nationale d'Investigation Financière) for STR filing; COBAC for compliance oversight; GABAC for regional mutual evaluation.</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><CardTitle>2.0 KYC Onboarding Framework</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">KYC Tier</th><th className="text-left py-2">Transaction Limit</th><th className="text-left py-2">Documents Required</th><th className="text-left py-2">Verification</th></tr></thead>
            <tbody className="divide-y">
              <tr><td className="py-2 font-semibold">Tier 1 — Basic</td><td className="py-2">≤ 100,000 XAF/day</td><td className="py-2">Phone number, name, date of birth</td><td className="py-2">OTP verification</td></tr>
              <tr><td className="py-2 font-semibold">Tier 2 — Standard</td><td className="py-2">≤ 1,000,000 XAF/day</td><td className="py-2">National ID card or passport, proof of address</td><td className="py-2">Document verification + liveness check</td></tr>
              <tr><td className="py-2 font-semibold">Tier 3 — Enhanced</td><td className="py-2">≤ 10,000,000 XAF/day</td><td className="py-2">All Tier 2 + source of funds declaration, tax ID</td><td className="py-2">Manual review by compliance team</td></tr>
              <tr><td className="py-2 font-semibold">Business KYB</td><td className="py-2">Per agreement</td><td className="py-2">RCCM, articles of association, UBO declaration, board resolution, financial statements</td><td className="py-2">Enhanced due diligence + site visit (if required)</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" /><CardTitle>3.0 STR Escalation Process</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-4">
          <pre className="text-xs font-mono bg-muted/50 p-4 rounded-lg overflow-x-auto leading-relaxed">{`
  Staff Detection          Internal SAR           MLRO Assessment         ANIF Filing
       │                       │                       │                      │
       │── Suspicious ────────►│                       │                      │
       │   activity noted      │── Internal SAR ──────►│                      │
       │                       │   Form submitted      │── Assess within ────►│
       │                       │   within 24 hours     │   48 hours           │
       │                       │                       │                      │
       │                       │                       │── File STR if ──────►│
       │                       │                       │   warranted          │
       │                       │                       │   (within 24h of     │
       │                       │                       │    decision)         │
       │                       │                       │                      │
       │                       │                       │── Preserve records ──│
       │                       │                       │   (7 years minimum)  │
`}</pre>
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">3.1 Tipping-Off Prohibition</h4>
            <p className="text-muted-foreground">Per Article 34 of CEMAC AML Regulation, no person shall disclose to the customer or any third party that a SAR has been filed or that an investigation is underway. Violation constitutes a criminal offence.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /><CardTitle>4.0 Sanctions Screening & PEP Detection</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-4 leading-relaxed">
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">4.1 Sanctions Screening</h4>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Screening performed at onboarding and on every transaction</li>
              <li>Lists screened: UN Security Council, EU Consolidated, US OFAC (SDN + Sectoral), CEMAC/COBAC local sanctions</li>
              <li>Fuzzy matching with configurable threshold (≥ 85% match triggers manual review)</li>
              <li>Positive matches escalated to Compliance Officer within 1 hour</li>
              <li>Confirmed matches: immediate account freeze and STR filing</li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">4.2 PEP Framework</h4>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>PEP screening at onboarding against commercial PEP databases</li>
              <li>PEP categories: domestic PEPs, foreign PEPs, international organisation PEPs, family members, close associates</li>
              <li>Enhanced Due Diligence (EDD) applied to all PEPs: source of wealth, source of funds, senior management approval</li>
              <li>Annual PEP status re-screening for all active customers</li>
              <li>PEP de-classification: 12-month cooling-off period after leaving public office</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><CardTitle>5.0 Record Retention</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="leading-relaxed">Per Article 37 of CEMAC AML Regulation and FATF Recommendation 11:</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Record Type</th><th className="text-left py-2">Retention Period</th><th className="text-left py-2">Storage</th></tr></thead>
            <tbody className="divide-y">
              <tr><td className="py-2">Customer identification records (KYC)</td><td className="py-2">7 years from end of relationship</td><td className="py-2">Encrypted, immutable storage</td></tr>
              <tr><td className="py-2">Transaction records</td><td className="py-2">10 years from date of transaction</td><td className="py-2">Append-only ledger with cryptographic hashing</td></tr>
              <tr><td className="py-2">STR/SAR records</td><td className="py-2">10 years from filing date</td><td className="py-2">Restricted access, MLRO-only</td></tr>
              <tr><td className="py-2">Sanctions screening results</td><td className="py-2">7 years</td><td className="py-2">Compliance audit log</td></tr>
              <tr><td className="py-2">Staff training records</td><td className="py-2">5 years from training date</td><td className="py-2">HR system</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><CardTitle>6.0 Internal SAR Form Template</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="p-4 border rounded-lg bg-muted/30">
            <p className="font-semibold mb-3">CONFIDENTIAL — Internal Suspicious Activity Report</p>
            <div className="space-y-2 text-muted-foreground">
              <p><strong>Report Reference:</strong> SAR-[YYYY]-[NNN]</p>
              <p><strong>Date of Report:</strong> ____/____/________</p>
              <p><strong>Reporting Officer:</strong> ________________________</p>
              <p><strong>Department:</strong> ________________________</p>
              <hr className="my-3" />
              <p><strong>Subject Details:</strong></p>
              <p>Name: ________________________ Account No: ________________________</p>
              <p>KYC Tier: _____ Customer Since: ____/____/________</p>
              <hr className="my-3" />
              <p><strong>Description of Suspicious Activity:</strong></p>
              <p className="italic">[Describe the activity, transactions involved, amounts, dates, counterparties, and reason for suspicion]</p>
              <hr className="my-3" />
              <p><strong>Supporting Evidence:</strong> □ Transaction records □ Account statements □ Communication logs □ Other: _____</p>
              <p><strong>Recommended Action:</strong> □ File STR with ANIF □ Enhanced monitoring □ Account restriction □ Other: _____</p>
              <hr className="my-3" />
              <p><strong>MLRO Decision:</strong> ________________________ Date: ____/____/________</p>
              <p><strong>STR Filed:</strong> □ Yes (Ref: _________) □ No (Reason: _________________________)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
