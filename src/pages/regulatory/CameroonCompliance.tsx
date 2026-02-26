import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Scale, Shield, Landmark, FileText, AlertTriangle } from "lucide-react";

export default function CameroonCompliance() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Regulatory</Badge>
        <h1 className="text-4xl font-bold mb-4">Cameroon Regulatory Compliance</h1>
        <p className="text-xl text-muted-foreground">
          Kang Open Banking compliance framework for CEMAC region regulations, BEAC monetary policy, and COBAC banking supervision.
        </p>
      </div>

      <Separator className="my-8" />

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Landmark className="h-6 w-6 text-primary" />
              <CardTitle>Regulatory Landscape</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">BEAC (Banque des États de l'Afrique Centrale)</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Central bank for 6 CEMAC member states</li>
                  <li>Monetary policy and currency issuance (XAF)</li>
                  <li>Payment systems oversight</li>
                  <li>Foreign exchange regulations</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">COBAC (Commission Bancaire de l'Afrique Centrale)</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Banking supervision authority</li>
                  <li>Licensing and prudential standards</li>
                  <li>AML/CFT enforcement</li>
                  <li>Consumer protection oversight</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Scale className="h-6 w-6 text-primary" />
              <CardTitle>PSP Licensing Framework</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Kang Open Banking operates under the CEMAC payment services regulatory framework, which requires:</p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: "Settlement Safeguarding", desc: "Merchant funds held in segregated accounts separate from operational funds. Float protection ensures availability at all times." },
                { title: "Capital Requirements", desc: "Minimum capitalization requirements met per COBAC Regulation R-2019/01 for electronic money institutions and payment service providers." },
                { title: "Local Partner Bank", desc: "Settlement funds safeguarded through partner banking relationships with COBAC-licensed commercial banks in Cameroon." },
              ].map((item) => (
                <div key={item.title} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2">{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <CardTitle>AML/CFT Framework</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Compliance with GABAC (Groupe d'Action contre le Blanchiment d'Argent en Afrique Centrale) standards and CEMAC Regulation No. 01/03-CEMAC-UMAC:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Tiered KYC:</strong> Three-tier customer identification aligned with CEMAC electronic money regulations</li>
              <li><strong>PEP Screening:</strong> Automated screening against politically exposed persons databases</li>
              <li><strong>Sanctions Screening:</strong> Real-time checks against OFAC, UN, AU, and CEMAC sanctions lists via <code className="text-xs bg-muted px-1 rounded">sanctions_screening</code> table</li>
              <li><strong>STR Filing:</strong> Suspicious Transaction Report workflow with automated triggers and ANIF (Agence Nationale d'Investigation Financière) submission</li>
              <li><strong>Transaction Monitoring:</strong> Automated rules-based monitoring with configurable thresholds</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <CardTitle>Reporting Obligations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Report</th>
                    <th className="text-left p-3 font-semibold">Authority</th>
                    <th className="text-left p-3 font-semibold">Frequency</th>
                    <th className="text-left p-3 font-semibold">Contents</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3">STR Reports</td><td className="p-3">ANIF</td><td className="p-3">As triggered</td><td className="p-3">Suspicious transaction details, customer info, risk assessment</td></tr>
                  <tr className="border-b"><td className="p-3">Transaction Volume</td><td className="p-3">BEAC</td><td className="p-3">Monthly</td><td className="p-3">Aggregate volumes, values, channel breakdown</td></tr>
                  <tr className="border-b"><td className="p-3">Prudential Returns</td><td className="p-3">COBAC</td><td className="p-3">Quarterly</td><td className="p-3">Capital adequacy, liquidity, risk exposure</td></tr>
                  <tr><td className="p-3">Annual Audit</td><td className="p-3">COBAC</td><td className="p-3">Annually</td><td className="p-3">Full financial statements, compliance attestation</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-primary" />
              <CardTitle>Risk Oversight Model</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Kang maintains a three-lines-of-defence risk management model:</p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <Badge variant="secondary" className="mb-2">Line 1</Badge>
                <h4 className="font-semibold text-foreground mb-1">Operational Controls</h4>
                <p>Automated transaction monitoring, velocity checks, fraud engine scoring at point of transaction.</p>
              </div>
              <div className="border rounded-lg p-4">
                <Badge variant="secondary" className="mb-2">Line 2</Badge>
                <h4 className="font-semibold text-foreground mb-1">Risk & Compliance</h4>
                <p>Independent review of monitoring alerts, STR investigation, policy enforcement, merchant risk grading.</p>
              </div>
              <div className="border rounded-lg p-4">
                <Badge variant="secondary" className="mb-2">Line 3</Badge>
                <h4 className="font-semibold text-foreground mb-1">Internal Audit</h4>
                <p>Periodic independent assessment of control effectiveness, regulatory compliance verification.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
