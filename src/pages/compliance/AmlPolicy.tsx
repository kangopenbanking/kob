import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Search, AlertTriangle, Users } from "lucide-react";

export default function AmlPolicy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Compliance</Badge>
        <h1 className="text-4xl font-bold mb-4">Anti-Money Laundering Policy</h1>
        <p className="text-xl text-muted-foreground">
          Comprehensive AML/CFT framework aligned with FATF recommendations, GABAC standards, and CEMAC regulations.
        </p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Shield className="h-6 w-6 text-primary" /><CardTitle>Policy Framework</CardTitle></div></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Kang Open Banking maintains a risk-based AML/CFT programme covering all services including payment initiation, account information, mobile money, and card processing. The programme is designed to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Prevent the platform from being used for money laundering or terrorist financing</li>
              <li>Comply with CEMAC Regulation No. 01/03-CEMAC-UMAC and subsequent amendments</li>
              <li>Meet FATF Recommendation standards as adopted by GABAC</li>
              <li>Support law enforcement through timely suspicious activity reporting</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Search className="h-6 w-6 text-primary" /><CardTitle>Screening Controls</CardTitle></div></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">Sanctions Screening</h4>
                <p>All customers and counterparties screened against OFAC SDN, UN Consolidated, AU, EU, and CEMAC sanctions lists. Screening performed at onboarding and on ongoing basis via the <code className="text-xs bg-muted px-1 rounded">sanctions_screening</code> engine.</p>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">PEP Screening</h4>
                <p>Politically Exposed Persons identified at onboarding with enhanced due diligence applied. Ongoing monitoring for changes in PEP status. Covers domestic and foreign PEPs per FATF Recommendation 12.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-primary" /><CardTitle>Suspicious Activity Triggers</CardTitle></div></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Transactions exceeding established thresholds without clear economic rationale",
                "Rapid movement of funds across multiple accounts or channels",
                "Structuring patterns (splitting transactions to avoid reporting thresholds)",
                "Geographic risk indicators (high-risk jurisdictions)",
                "Unusual changes in transaction patterns or account behaviour",
                "Adverse media or law enforcement intelligence matches",
              ].map((trigger, i) => (
                <div key={i} className="flex items-start gap-2 border rounded-lg p-3">
                  <Badge variant="secondary" className="mt-0.5 shrink-0">{i + 1}</Badge>
                  <p>{trigger}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Users className="h-6 w-6 text-primary" /><CardTitle>Merchant Risk Tiering</CardTitle></div></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Tier</th><th className="text-left p-3 font-semibold">Risk Level</th><th className="text-left p-3 font-semibold">KYB Requirements</th><th className="text-left p-3 font-semibold">Monitoring</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3">Tier 1</td><td className="p-3">Low</td><td className="p-3">Standard KYB + ID verification</td><td className="p-3">Automated rules</td></tr>
                  <tr className="border-b"><td className="p-3">Tier 2</td><td className="p-3">Medium</td><td className="p-3">Enhanced KYB + source of funds</td><td className="p-3">Automated + periodic review</td></tr>
                  <tr><td className="p-3">Tier 3</td><td className="p-3">High</td><td className="p-3">Full EDD + ongoing monitoring</td><td className="p-3">Real-time + manual review</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
