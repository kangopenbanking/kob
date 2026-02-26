import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Shield, UserCheck } from "lucide-react";

export default function CorporateStructure() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <Badge variant="outline" className="mb-4">KOB-REG-001 — Phase 1: Legal Structure</Badge>
      <h1 className="text-3xl font-bold mb-2">Corporate Structure & Governance Framework</h1>
      <p className="text-muted-foreground mb-8">Prepared for submission to BEAC and COBAC under CEMAC Regulation No. 04/18-CEMAC-UMAC-COBAC</p>

      {/* 1.0 Corporate Overview */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /><CardTitle>1.0 Corporate Overview</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                <tr><td className="py-2 pr-4 font-medium text-muted-foreground w-48">Registered Name</td><td className="py-2">Kang Open Banking S.A.</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Legal Form</td><td className="py-2">Société Anonyme (S.A.) — OHADA Uniform Act</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Jurisdiction</td><td className="py-2">Republic of Cameroon</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-muted-foreground">RCCM Number</td><td className="py-2">[To be assigned upon registration]</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Registered Office</td><td className="py-2">Douala, Littoral Region, Cameroon</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Share Capital</td><td className="py-2">500,000,000 XAF (minimum per COBAC R-2019/01)</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Principal Activities</td><td className="py-2">Payment Service Provider (PSP), Payment Gateway, Mobile Money Aggregation, Open Banking Infrastructure</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Financial Year</td><td className="py-2">1 January — 31 December</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 2.0 Shareholding Structure */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><CardTitle>2.0 Shareholding Structure</CardTitle></div>
          <CardDescription>Per Article 4, COBAC Regulation R-2016/04 — Fit and Proper Requirements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="leading-relaxed">All shareholders holding 10% or more of the share capital or voting rights are subject to prior approval by COBAC, as required under Article 12 of CEMAC Regulation No. 04/18.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Shareholder</th><th className="text-left py-2">Type</th><th className="text-left py-2">Holding (%)</th><th className="text-left py-2">Nationality</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="py-2">[Founding Shareholder 1]</td><td className="py-2">Natural Person</td><td className="py-2">[XX]%</td><td className="py-2">Cameroonian</td></tr>
                <tr><td className="py-2">[Founding Shareholder 2]</td><td className="py-2">Natural Person</td><td className="py-2">[XX]%</td><td className="py-2">[Country]</td></tr>
                <tr><td className="py-2">[Institutional Investor]</td><td className="py-2">Legal Person</td><td className="py-2">[XX]%</td><td className="py-2">[Country]</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Supporting documents: Notarised identity documents, police clearance certificates, source of funds declarations, and CV/résumé for each shareholder holding ≥10%.</p>
        </CardContent>
      </Card>

      {/* 3.0 UBO Declaration */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" /><CardTitle>3.0 Ultimate Beneficial Owner (UBO) Declaration</CardTitle></div>
          <CardDescription>Per CEMAC Regulation No. 01/03-CEMAC-UMAC-COBAC on AML/CFT</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>In accordance with FATF Recommendation 24 and CEMAC AML Regulation Article 8, the Company hereby declares the following Ultimate Beneficial Owners — natural persons who ultimately own or control, directly or indirectly, 25% or more of the share capital or voting rights:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Full Name</th><th className="text-left py-2">Date of Birth</th><th className="text-left py-2">Nationality</th><th className="text-left py-2">Ownership %</th><th className="text-left py-2">Nature of Control</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="py-2">[UBO Name]</td><td className="py-2">[DD/MM/YYYY]</td><td className="py-2">[Country]</td><td className="py-2">[XX]%</td><td className="py-2">Direct shareholding</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">The Company undertakes to notify COBAC within 30 days of any change in its UBO structure, as required under Article 10 of the CEMAC AML Regulation.</p>
        </CardContent>
      </Card>

      {/* 4.0 Board Governance */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><CardTitle>4.0 Board of Directors</CardTitle></div>
          <CardDescription>Constituted per OHADA Uniform Act on Commercial Companies, Articles 414–494</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="leading-relaxed">The Board of Directors shall comprise a minimum of three (3) and maximum of twelve (12) members, including at least one (1) independent non-executive director. Board members are subject to COBAC fit-and-proper assessment prior to appointment.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Position</th><th className="text-left py-2">Name</th><th className="text-left py-2">Status</th><th className="text-left py-2">Appointed</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="py-2">Chairman of the Board</td><td className="py-2">[Name]</td><td className="py-2">Non-Executive</td><td className="py-2">[Date]</td></tr>
                <tr><td className="py-2">Managing Director / CEO</td><td className="py-2">[Name]</td><td className="py-2">Executive</td><td className="py-2">[Date]</td></tr>
                <tr><td className="py-2">Independent Director</td><td className="py-2">[Name]</td><td className="py-2">Independent Non-Executive</td><td className="py-2">[Date]</td></tr>
                <tr><td className="py-2">Director</td><td className="py-2">[Name]</td><td className="py-2">Non-Executive</td><td className="py-2">[Date]</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-2">4.1 Board Committees</h4>
            <ul className="space-y-1 text-sm">
              <li>• <strong>Risk Committee</strong> — Chaired by independent director; meets quarterly; oversees operational, credit, liquidity, and cyber risk</li>
              <li>• <strong>Audit Committee</strong> — Minimum two non-executive members; oversees external/internal audit, financial controls</li>
              <li>• <strong>Compliance Committee</strong> — Oversees AML/CFT compliance, regulatory reporting, sanctions screening</li>
              <li>• <strong>Technology & Security Committee</strong> — Oversees IT governance, cyber security, business continuity</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 5.0 Key Officers */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle>5.0 Key Officer Appointments</CardTitle></div>
          <CardDescription>Per COBAC Instruction No. 01/2017 — Designation of Responsible Officers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">5.1 Money Laundering Reporting Officer (MLRO)</h4>
            <p className="leading-relaxed mb-2">In accordance with Article 28 of CEMAC AML Regulation No. 01/03-CEMAC-UMAC-COBAC, the Company hereby appoints:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><tbody className="divide-y">
                <tr><td className="py-1 pr-4 font-medium text-muted-foreground w-40">Name</td><td className="py-1">[MLRO Full Name]</td></tr>
                <tr><td className="py-1 pr-4 font-medium text-muted-foreground">Qualifications</td><td className="py-1">[Relevant qualifications and AML certification]</td></tr>
                <tr><td className="py-1 pr-4 font-medium text-muted-foreground">Reporting Line</td><td className="py-1">Direct to Board of Directors / Compliance Committee</td></tr>
                <tr><td className="py-1 pr-4 font-medium text-muted-foreground">Responsibilities</td><td className="py-1">Receipt and assessment of internal SARs; filing of STRs with ANIF; annual AML risk assessment; staff training coordination</td></tr>
              </tbody></table>
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">5.2 Compliance Officer</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><tbody className="divide-y">
                <tr><td className="py-1 pr-4 font-medium text-muted-foreground w-40">Name</td><td className="py-1">[CO Full Name]</td></tr>
                <tr><td className="py-1 pr-4 font-medium text-muted-foreground">Reporting Line</td><td className="py-1">Direct to CEO and Board Compliance Committee</td></tr>
                <tr><td className="py-1 pr-4 font-medium text-muted-foreground">Responsibilities</td><td className="py-1">Regulatory compliance monitoring; COBAC reporting; license condition tracking; policy review</td></tr>
              </tbody></table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6.0 Org Chart */}
      <Card>
        <CardHeader>
          <CardTitle>6.0 Organisational Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono bg-muted/50 p-4 rounded-lg overflow-x-auto leading-relaxed">{`
                        ┌─────────────────────┐
                        │   Board of Directors │
                        │   (4+ members)       │
                        └──────────┬──────────┘
               ┌───────────────────┼───────────────────┐
               │                   │                   │
    ┌──────────┴──────┐ ┌─────────┴────────┐ ┌────────┴────────┐
    │ Risk Committee  │ │ Audit Committee  │ │Compliance Cmte  │
    └─────────────────┘ └──────────────────┘ └─────────────────┘
                        ┌──────────┴──────────┐
                        │   CEO / Managing     │
                        │   Director           │
                        └──────────┬──────────┘
         ┌──────────┬──────────┬───┴────┬──────────┬──────────┐
         │          │          │        │          │          │
    ┌────┴───┐ ┌───┴────┐ ┌──┴───┐ ┌──┴───┐ ┌───┴────┐ ┌──┴──────┐
    │  CTO   │ │  CFO   │ │ COO  │ │ MLRO │ │Compli- │ │  Head   │
    │        │ │        │ │      │ │      │ │ance    │ │  Legal  │
    └───┬────┘ └───┬────┘ └──┬───┘ └──────┘ │Officer │ └─────────┘
        │          │         │              └────────┘
   ┌────┴────┐  ┌──┴──┐  ┌──┴──────┐
   │Dev/Infra│  │Fin. │  │Ops/CS   │
   │Team     │  │Team │  │Team     │
   └─────────┘  └─────┘  └─────────┘
`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
