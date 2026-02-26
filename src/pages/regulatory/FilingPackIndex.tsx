import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { FileText, Shield, Building2, Scale, Server, AlertTriangle, BarChart3, CheckCircle, Clock, Landmark } from "lucide-react";

const filingDocuments = [
  { code: "KOB-REG-001", title: "Corporate Structure & Governance", route: "/regulatory/corporate-structure", phase: "Phase 1", status: "Ready", icon: Building2 },
  { code: "KOB-REG-002", title: "Internal Control Policy", route: "/regulatory/internal-control-policy", phase: "Phase 1", status: "Ready", icon: Shield },
  { code: "KOB-REG-003", title: "PSP License Application", route: "/regulatory/license-application", phase: "Phase 2", status: "Ready", icon: Scale },
  { code: "KOB-REG-004", title: "Business Continuity & Disaster Recovery", route: "/regulatory/business-continuity", phase: "Phase 2", status: "Ready", icon: Server },
  { code: "KOB-REG-005", title: "AML/CFT Compliance Pack", route: "/regulatory/aml-cft-pack", phase: "Phase 3", status: "Ready", icon: Shield },
  { code: "KOB-REG-006", title: "Data Protection Policy", route: "/regulatory/data-protection-policy", phase: "Phase 3", status: "Ready", icon: FileText },
  { code: "KOB-REG-007", title: "Technical System Disclosure", route: "/regulatory/technical-disclosure", phase: "Phase 4", status: "Ready", icon: Server },
  { code: "KOB-REG-008", title: "Risk Assessment Matrix", route: "/regulatory/risk-assessment", phase: "Phase 5", status: "Ready", icon: AlertTriangle },
  { code: "KOB-REG-009", title: "Regulatory Reporting Templates", route: "/regulatory/reporting-templates", phase: "Phase 6", status: "Ready", icon: BarChart3 },
];

const operationalChecklist = [
  "Minimum capital of 500,000,000 XAF deposited in designated BEAC-approved bank account",
  "MLRO and Compliance Officer formally appointed with COBAC notification letters filed",
  "Board of Directors fully constituted with independent non-executive director(s)",
  "AML/CFT training programme delivered to all staff within 30 days of commencement",
  "Core banking / ledger system tested and reconciliation framework validated",
  "Disaster Recovery and Business Continuity plans tested with documented results",
  "Data protection impact assessment (DPIA) completed for all personal data processing",
  "Sanctions screening provider contracted and integrated into onboarding flow",
  "External auditor appointed for annual statutory audit",
  "Professional indemnity and cyber insurance policies secured",
  "Settlement safeguarding account opened at approved credit institution",
  "Processor agreements (Stripe, Flutterwave) executed with BEAC-notified terms",
];

const gaps = [
  { area: "Capital Requirement", detail: "500M XAF minimum capital must be evidenced via bank certificate", severity: "Critical" },
  { area: "MLRO Appointment", detail: "Named individual must be resident in Cameroon per COBAC Regulation R-2016/04", severity: "High" },
  { area: "External Audit", detail: "Auditor must be COBAC-approved; engagement letter required for submission", severity: "High" },
  { area: "Insurance Coverage", detail: "Professional indemnity policy with minimum 100M XAF coverage required", severity: "Medium" },
  { area: "Physical Presence", detail: "Registered office in Cameroon with RCCM registration number", severity: "Critical" },
];

export default function FilingPackIndex() {
  const readinessScore = 78;

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">BEAC / COBAC Regulatory Filing</Badge>
        <h1 className="text-4xl font-bold mb-2">Cameroon Regulatory Filing Pack</h1>
        <p className="text-lg text-muted-foreground">
          Complete submission-ready documentation package for PSP licensing under CEMAC Regulation No. 04/18-CEMAC-UMAC-COBAC.
        </p>
      </div>

      {/* Readiness Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Readiness Score</CardDescription>
            <CardTitle className="text-3xl">{readinessScore}/100</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={readinessScore} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Documents</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">9/9 <CheckCircle className="h-5 w-5 text-green-500" /></CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">All documents drafted</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Capital Requirement</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2"><Landmark className="h-5 w-5" /> 500M XAF</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">Per COBAC R-2019/01</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Est. Timeline</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2"><Clock className="h-5 w-5" /> 6–9 months</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">From complete submission</p></CardContent>
        </Card>
      </div>

      {/* Document Index */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Filing Document Index</CardTitle>
          <CardDescription>All documents required for BEAC/COBAC PSP license application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Ref</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Document</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Phase</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filingDocuments.map((doc) => (
                  <tr key={doc.code} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-2 font-mono text-xs">{doc.code}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <doc.icon className="h-4 w-4 text-primary shrink-0" />
                        {doc.title}
                      </div>
                    </td>
                    <td className="py-3 px-2"><Badge variant="outline" className="text-xs">{doc.phase}</Badge></td>
                    <td className="py-3 px-2"><Badge className="bg-green-500/10 text-green-700 border-green-500/20">{doc.status}</Badge></td>
                    <td className="py-3 px-2">
                      <Link to={doc.route} className="text-primary hover:underline text-xs font-medium">View Document →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Regulatory Gap Assessment */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Regulatory Gap Assessment</CardTitle>
          <CardDescription>Outstanding items required before submission to BEAC/COBAC</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {gaps.map((gap, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${gap.severity === 'Critical' ? 'text-destructive' : gap.severity === 'High' ? 'text-orange-500' : 'text-yellow-500'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{gap.area}</span>
                    <Badge variant={gap.severity === 'Critical' ? 'destructive' : 'outline'} className="text-xs">{gap.severity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{gap.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Operational Readiness Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Operational Readiness Checklist</CardTitle>
          <CardDescription>Pre-submission requirements per COBAC Regulation R-2019/01 and BEAC Instruction No. 01/GR/2018</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {operationalChecklist.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <Checkbox id={`check-${i}`} />
                <label htmlFor={`check-${i}`} className="text-sm leading-relaxed cursor-pointer">{item}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
