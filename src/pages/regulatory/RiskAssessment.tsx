import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield } from "lucide-react";
import { PdfExportButton } from "@/components/regulatory/PdfExportButton";

const risks = [
  { id: "R-001", category: "Processor Dependency", description: "Disruption or termination of Stripe/Flutterwave services impacting payment processing", probability: "Medium", impact: "Critical", inherent: "High", mitigation: "Multi-processor architecture; failover routing; minimum 2 processors per channel; 90-day cash reserve for processor transition", residual: "Medium" },
  { id: "R-002", category: "Cybersecurity", description: "Data breach, ransomware, or unauthorised access to customer data or payment credentials", probability: "Medium", impact: "Critical", inherent: "Critical", mitigation: "Defence-in-depth: WAF, IDS/IPS, MFA, encryption at rest/transit, penetration testing (annual), SOC monitoring, incident response plan", residual: "Medium" },
  { id: "R-003", category: "Settlement Risk", description: "Delay or failure in settlement of merchant payouts due to processor or bank issues", probability: "Medium", impact: "High", inherent: "High", mitigation: "Daily three-way reconciliation; settlement monitoring alerts; float reserve (48h); escalation matrix for delayed settlements", residual: "Low" },
  { id: "R-004", category: "Fraud Exposure", description: "Financial loss from fraudulent transactions, account takeover, or identity fraud", probability: "High", impact: "High", inherent: "Critical", mitigation: "5-layer fraud engine: velocity checks, amount thresholds, device fingerprinting, ML scoring, manual review queue; real-time blocking", residual: "Medium" },
  { id: "R-005", category: "Liquidity Risk", description: "Insufficient funds to meet settlement obligations or operational expenses", probability: "Low", impact: "Critical", inherent: "High", mitigation: "Segregated client funds; 30-day operational reserve; daily cash position monitoring; Board-approved liquidity policy", residual: "Low" },
  { id: "R-006", category: "Regulatory Risk", description: "Changes in CEMAC/COBAC regulations requiring significant operational changes or additional capital", probability: "Medium", impact: "High", inherent: "High", mitigation: "Dedicated Compliance Officer; COBAC regulatory monitoring; quarterly regulatory change assessment; industry body membership", residual: "Medium" },
  { id: "R-007", category: "Operational Risk", description: "System outage, human error, or process failure affecting service availability", probability: "Medium", impact: "High", inherent: "High", mitigation: "Redundant infrastructure; automated monitoring; BCP/DRP (tested semi-annually); change management controls; 4-eye principle for critical operations", residual: "Low" },
  { id: "R-008", category: "AML/CFT Risk", description: "Platform used for money laundering or terrorist financing due to control gaps", probability: "Low", impact: "Critical", inherent: "High", mitigation: "Tiered KYC; real-time sanctions screening; transaction monitoring rules; STR filing to ANIF; annual AML risk assessment; staff training", residual: "Low" },
];

const colorMap: Record<string, string> = {
  "Critical": "text-destructive bg-destructive/10",
  "High": "text-orange-700 bg-orange-500/10",
  "Medium": "text-yellow-700 bg-yellow-500/10",
  "Low": "text-green-700 bg-green-500/10",
};

const riskPdfSections = risks.map(r => ({
  heading: `${r.id} — ${r.category}`,
  content: [r.description, `Probability: ${r.probability} | Impact: ${r.impact}`, `Inherent Risk: ${r.inherent} | Residual Risk: ${r.residual}`, `Mitigation: ${r.mitigation}`],
}));

export default function RiskAssessment() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="flex items-start justify-between mb-4">
        <Badge variant="outline">KOB-REG-008 — Phase 5: Risk Disclosure</Badge>
        <PdfExportButton title="Risk Assessment Matrix" documentCode="KOB-REG-008" subtitle="Per COBAC Regulation R-2016/04 on Risk Management" sections={riskPdfSections} />
      </div>
      <h1 className="text-3xl font-bold mb-2">Risk Assessment Matrix</h1>
      <p className="text-muted-foreground mb-8">Per COBAC Regulation R-2016/04 on Risk Management and CEMAC Regulation No. 04/18, Article 20</p>
      <h1 className="text-3xl font-bold mb-2">Risk Assessment Matrix</h1>
      <p className="text-muted-foreground mb-8">Per COBAC Regulation R-2016/04 on Risk Management and CEMAC Regulation No. 04/18, Article 20</p>

      {/* Probability / Impact Grid */}
      <Card className="mb-8">
        <CardHeader><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" /><CardTitle>1.0 Probability × Impact Grid</CardTitle></div></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center">
              <thead><tr><th className="py-2 px-3"></th><th className="py-2 px-3 font-medium">Low Impact</th><th className="py-2 px-3 font-medium">Medium Impact</th><th className="py-2 px-3 font-medium">High Impact</th><th className="py-2 px-3 font-medium">Critical Impact</th></tr></thead>
              <tbody>
                <tr className="border-t"><td className="py-3 px-3 font-medium text-left">High Probability</td><td className="py-3 bg-yellow-500/10">Medium</td><td className="py-3 bg-orange-500/10">High</td><td className="py-3 bg-destructive/10 text-destructive font-semibold">Critical</td><td className="py-3 bg-destructive/10 text-destructive font-semibold">Critical</td></tr>
                <tr className="border-t"><td className="py-3 px-3 font-medium text-left">Medium Probability</td><td className="py-3 bg-green-500/10">Low</td><td className="py-3 bg-yellow-500/10">Medium</td><td className="py-3 bg-orange-500/10">High</td><td className="py-3 bg-destructive/10 text-destructive font-semibold">Critical</td></tr>
                <tr className="border-t"><td className="py-3 px-3 font-medium text-left">Low Probability</td><td className="py-3 bg-green-500/10">Low</td><td className="py-3 bg-green-500/10">Low</td><td className="py-3 bg-yellow-500/10">Medium</td><td className="py-3 bg-orange-500/10">High</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Risk Register */}
      <Card>
        <CardHeader><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle>2.0 Risk Register</CardTitle></div></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {risks.map((risk) => (
              <div key={risk.id} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono text-xs">{risk.id}</Badge>
                  <span className="font-semibold text-sm">{risk.category}</span>
                  <Badge className={`text-xs ${colorMap[risk.inherent]}`}>{risk.inherent} (Inherent)</Badge>
                  <Badge className={`text-xs ${colorMap[risk.residual]}`}>{risk.residual} (Residual)</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{risk.description}</p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div><span className="font-medium">Probability:</span> {risk.probability}</div>
                  <div><span className="font-medium">Impact:</span> {risk.impact}</div>
                </div>
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                  <span className="font-medium">Mitigation:</span> {risk.mitigation}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
