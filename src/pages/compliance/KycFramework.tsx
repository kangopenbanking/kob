import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, FileText, Shield } from "lucide-react";

export default function KycFramework() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Compliance</Badge>
        <h1 className="text-4xl font-bold mb-4">KYC Framework</h1>
        <p className="text-xl text-muted-foreground">
          Tiered Know Your Customer framework for individual and business accounts, aligned with CEMAC electronic money regulations.
        </p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Users className="h-6 w-6 text-primary" /><CardTitle>Individual KYC Tiers</CardTitle></div></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Tier</th><th className="text-left p-3 font-semibold">Requirements</th><th className="text-left p-3 font-semibold">Transaction Limits</th><th className="text-left p-3 font-semibold">Services</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3 font-medium text-foreground">Tier 1 (Basic)</td><td className="p-3">Phone number, name, date of birth</td><td className="p-3">100,000 XAF/day, 500,000 XAF/month</td><td className="p-3">Mobile money, P2P transfers</td></tr>
                  <tr className="border-b"><td className="p-3 font-medium text-foreground">Tier 2 (Standard)</td><td className="p-3">+ Government ID, selfie verification</td><td className="p-3">500,000 XAF/day, 2,000,000 XAF/month</td><td className="p-3">+ Card payments, bill pay</td></tr>
                  <tr><td className="p-3 font-medium text-foreground">Tier 3 (Enhanced)</td><td className="p-3">+ Proof of address, source of funds</td><td className="p-3">5,000,000 XAF/day, 20,000,000 XAF/month</td><td className="p-3">+ International transfers, virtual cards</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><FileText className="h-6 w-6 text-primary" /><CardTitle>Business KYC (KYB)</CardTitle></div></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-4">
            <p>Business customers undergo enhanced verification via the <code className="text-xs bg-muted px-1 rounded">business_kyc</code> table:</p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: "Registration Documents", items: ["Certificate of incorporation", "Articles of association", "Tax registration certificate"] },
                { title: "Beneficial Ownership", items: ["UBO identification (>25% ownership)", "Director identification", "Signatory verification"] },
                { title: "Financial Due Diligence", items: ["Bank statements (3 months)", "Annual turnover declaration", "Source of funds documentation"] },
                { title: "Ongoing Monitoring", items: ["Annual KYB refresh", "Adverse media screening", "Risk rating reassessment"] },
              ].map((section) => (
                <div key={section.title} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2">{section.title}</h4>
                  <ul className="list-disc list-inside space-y-1">{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Shield className="h-6 w-6 text-primary" /><CardTitle>Risk-Based Approach</CardTitle></div></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>The KYC risk scoring engine (<code className="text-xs bg-muted px-1 rounded">calculate_kyc_risk_score</code>) evaluates:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Customer risk factors: country of residence, occupation, PEP status</li>
              <li>Product risk: service types requested, transaction limits</li>
              <li>Channel risk: remote vs in-person onboarding</li>
              <li>Geographic risk: high-risk jurisdiction indicators</li>
            </ul>
            <p>Customers scoring above configured thresholds trigger enhanced due diligence workflows.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
