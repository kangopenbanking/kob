import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Eye, FileCheck, AlertTriangle } from "lucide-react";
import { PdfExportButton } from "@/components/regulatory/PdfExportButton";

const pdfSections = [
  { heading: "1.0 Purpose & Scope", content: ["This Internal Control Policy establishes the framework of controls, procedures, and governance structures that Kang Open Banking S.A. maintains to ensure safety, soundness, and regulatory compliance.", "Regulatory basis: COBAC Regulation R-2001/07, COBAC Instruction No. 2006/01, CEMAC Regulation No. 04/18 Article 23."] },
  { heading: "2.0 Three Lines of Defence", content: ["1st Line: Business Operations — day-to-day controls, transaction processing validation.", "2nd Line: Risk Management & Compliance — policy development, AML/CFT oversight, regulatory reporting.", "3rd Line: Internal Audit — independent assurance, control effectiveness testing."] },
  { heading: "3.0 Committee Structures", content: ["Risk Committee: Min 3 members, quarterly meetings, chaired by independent director.", "Compliance Committee: Monthly meetings, chaired by Compliance Officer.", "Audit Committee: Min 2 non-executive directors, quarterly meetings."] },
  { heading: "4.0 Key Control Processes", content: ["Transaction authorisation, reconciliation, access control, sanctions screening, change management, incident management."] },
];

export default function InternalControlPolicy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex items-start justify-between mb-4">
        <Badge variant="outline">KOB-REG-002 — Phase 1: Legal Structure</Badge>
        <PdfExportButton title="Internal Control Policy" documentCode="KOB-REG-002" subtitle="Per COBAC Regulation R-2016/04 and CEMAC Regulation No. 04/18-CEMAC-UMAC-COBAC, Article 23" sections={pdfSections} />
      </div>
      <h1 className="text-3xl font-bold mb-2">Internal Control Policy</h1>
      <p className="text-muted-foreground mb-8">Per COBAC Regulation R-2016/04 and CEMAC Regulation No. 04/18-CEMAC-UMAC-COBAC, Article 23</p>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle>1.0 Purpose & Scope</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-3">
          <p>This Internal Control Policy establishes the framework of controls, procedures, and governance structures that Kang Open Banking S.A. ("the Company") maintains to ensure the safety, soundness, and regulatory compliance of its payment service operations.</p>
          <p>The policy applies to all business units, subsidiaries, and outsourced service arrangements. It is reviewed annually by the Board of Directors and updated as required by changes in regulation or business operations.</p>
          <p><strong>Regulatory basis:</strong> COBAC Regulation R-2001/07 on internal controls in credit institutions (applied mutatis mutandis to PSPs), COBAC Instruction No. 2006/01, and CEMAC Regulation No. 04/18, Article 23.</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /><CardTitle>2.0 Three Lines of Defence Model</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Line</th><th className="text-left py-2">Function</th><th className="text-left py-2">Responsibilities</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="py-3 font-semibold">1st Line</td><td className="py-3">Business Operations</td><td className="py-3">Day-to-day controls, transaction processing validation, operational risk management, incident reporting</td></tr>
                <tr><td className="py-3 font-semibold">2nd Line</td><td className="py-3">Risk Management & Compliance</td><td className="py-3">Policy development, compliance monitoring, AML/CFT oversight, risk assessment, regulatory reporting</td></tr>
                <tr><td className="py-3 font-semibold">3rd Line</td><td className="py-3">Internal Audit</td><td className="py-3">Independent assurance, control effectiveness testing, audit reporting to Board Audit Committee</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-primary" /><CardTitle>3.0 Risk Committee Structure</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-4">
          <div className="p-4 border rounded-lg space-y-2">
            <h4 className="font-semibold">3.1 Risk Committee</h4>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Composition: Minimum 3 members including 1 independent non-executive director (Chair)</li>
              <li>Meeting frequency: Quarterly (minimum), ad hoc for critical risk events</li>
              <li>Mandate: Operational risk, credit risk, liquidity risk, technology risk, third-party risk</li>
              <li>Reporting: Minutes to full Board within 14 days; annual risk report to COBAC</li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg space-y-2">
            <h4 className="font-semibold">3.2 Compliance Committee</h4>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Composition: Compliance Officer (Chair), MLRO, Head of Operations, Legal Counsel</li>
              <li>Meeting frequency: Monthly</li>
              <li>Mandate: AML/CFT compliance, sanctions screening effectiveness, regulatory change management, STR filing review</li>
              <li>Reporting: Monthly compliance dashboard to CEO; quarterly report to Board</li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg space-y-2">
            <h4 className="font-semibold">3.3 Audit Committee</h4>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Composition: Minimum 2 non-executive directors; at least 1 with financial expertise</li>
              <li>Meeting frequency: Quarterly</li>
              <li>Mandate: Internal audit plan approval, external auditor liaison, financial control review, whistleblower reports</li>
              <li>External audit: Annual statutory audit by COBAC-approved auditor</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" /><CardTitle>4.0 Key Control Processes</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-3 leading-relaxed">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Control Area</th><th className="text-left py-2">Control Description</th><th className="text-left py-2">Frequency</th><th className="text-left py-2">Owner</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="py-2">Transaction Authorisation</td><td className="py-2">Dual authorisation for transactions &gt;5,000,000 XAF; automated fraud scoring on all transactions</td><td className="py-2">Real-time</td><td className="py-2">Operations</td></tr>
                <tr><td className="py-2">Reconciliation</td><td className="py-2">Three-way reconciliation (internal ledger, processor, bank statement)</td><td className="py-2">Daily</td><td className="py-2">Finance</td></tr>
                <tr><td className="py-2">Access Control</td><td className="py-2">Role-based access with MFA; quarterly access reviews; principle of least privilege</td><td className="py-2">Continuous</td><td className="py-2">IT Security</td></tr>
                <tr><td className="py-2">Sanctions Screening</td><td className="py-2">Real-time screening against UN, EU, US OFAC, and local sanctions lists</td><td className="py-2">Real-time</td><td className="py-2">Compliance</td></tr>
                <tr><td className="py-2">Change Management</td><td className="py-2">All production changes require peer review, staging validation, and rollback plan</td><td className="py-2">Per change</td><td className="py-2">CTO</td></tr>
                <tr><td className="py-2">Incident Management</td><td className="py-2">Classification (P1–P4), escalation matrix, root cause analysis, regulatory notification within 24h for P1/P2</td><td className="py-2">Per incident</td><td className="py-2">Operations</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>5.0 Reporting & Review Schedule</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Report</th><th className="text-left py-2">Recipient</th><th className="text-left py-2">Frequency</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="py-2">Compliance monitoring report</td><td className="py-2">Board Compliance Committee</td><td className="py-2">Monthly</td></tr>
                <tr><td className="py-2">Risk dashboard</td><td className="py-2">Risk Committee / CEO</td><td className="py-2">Quarterly</td></tr>
                <tr><td className="py-2">Internal audit report</td><td className="py-2">Board Audit Committee</td><td className="py-2">Quarterly</td></tr>
                <tr><td className="py-2">AML/CFT annual risk assessment</td><td className="py-2">COBAC / ANIF</td><td className="py-2">Annual</td></tr>
                <tr><td className="py-2">External audit report</td><td className="py-2">COBAC / Shareholders</td><td className="py-2">Annual</td></tr>
                <tr><td className="py-2">Policy review (all policies)</td><td className="py-2">Board of Directors</td><td className="py-2">Annual</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
