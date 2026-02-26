import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FileText } from "lucide-react";

export default function ReportingTemplates() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <Badge variant="outline" className="mb-4">KOB-REG-009 — Phase 6: Reporting Framework</Badge>
      <h1 className="text-3xl font-bold mb-2">Regulatory Reporting Templates</h1>
      <p className="text-muted-foreground mb-8">Structured templates for BEAC/COBAC periodic reporting obligations</p>

      {/* Daily Transaction Volume */}
      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /><CardTitle>1.0 Daily Transaction Volume Report</CardTitle></div></CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground mb-3">Submitted: Daily by 10:00 WAT | Recipient: Internal Finance + COBAC (monthly aggregate)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead><tr className="bg-muted/50"><th className="py-2 px-3 text-left border">Channel</th><th className="py-2 px-3 text-left border">Tx Count</th><th className="py-2 px-3 text-left border">Volume (XAF)</th><th className="py-2 px-3 text-left border">Success Rate</th><th className="py-2 px-3 text-left border">Avg Value</th><th className="py-2 px-3 text-left border">Fees Collected</th></tr></thead>
              <tbody>
                {["Mobile Money", "Card Payments", "Bank Transfers", "PayPal", "USSD"].map(ch => (
                  <tr key={ch} className="border"><td className="py-2 px-3 border">{ch}</td><td className="py-2 px-3 border">—</td><td className="py-2 px-3 border">—</td><td className="py-2 px-3 border">—</td><td className="py-2 px-3 border">—</td><td className="py-2 px-3 border">—</td></tr>
                ))}
                <tr className="border font-semibold bg-muted/30"><td className="py-2 px-3 border">TOTAL</td><td className="py-2 px-3 border">—</td><td className="py-2 px-3 border">—</td><td className="py-2 px-3 border">—</td><td className="py-2 px-3 border">—</td><td className="py-2 px-3 border">—</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Settlement Report */}
      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /><CardTitle>2.0 Settlement Report</CardTitle></div></CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground mb-3">Submitted: Daily | Recipient: Finance team; monthly summary to COBAC</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead><tr className="bg-muted/50"><th className="py-2 px-3 text-left border">Metric</th><th className="py-2 px-3 text-left border">Value</th></tr></thead>
              <tbody>
                {["Total settled (XAF)", "Settlements pending", "Settlement failures", "Avg settlement time", "Fees deducted", "Net payout to merchants", "Safeguarded funds balance", "Float account balance", "Reconciliation match rate"].map(m => (
                  <tr key={m} className="border"><td className="py-2 px-3 border">{m}</td><td className="py-2 px-3 border">—</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Fraud Report */}
      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><CardTitle>3.0 Fraud Report</CardTitle></div></CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground mb-3">Submitted: Weekly (internal); Monthly to COBAC</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead><tr className="bg-muted/50"><th className="py-2 px-3 text-left border">Metric</th><th className="py-2 px-3 text-left border">Period Value</th><th className="py-2 px-3 text-left border">Trend</th></tr></thead>
              <tbody>
                {["Transactions flagged by fraud engine", "Transactions blocked (auto)", "Transactions sent to manual review", "Confirmed fraud cases", "Fraud loss amount (XAF)", "Fraud rate (% of volume)", "Account takeover attempts", "Identity fraud attempts"].map(m => (
                  <tr key={m} className="border"><td className="py-2 px-3 border">{m}</td><td className="py-2 px-3 border">—</td><td className="py-2 px-3 border">—</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Chargeback Report */}
      <Card className="mb-6">
        <CardHeader><CardTitle>4.0 Chargeback Report</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground mb-3">Submitted: Monthly | Recipient: Finance + Compliance</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead><tr className="bg-muted/50"><th className="py-2 px-3 text-left border">Metric</th><th className="py-2 px-3 text-left border">Value</th></tr></thead>
              <tbody>
                {["Total chargebacks received", "Chargeback amount (XAF)", "Chargeback rate (%)", "Chargebacks won", "Chargebacks lost", "Avg resolution time (days)", "Top reason codes"].map(m => (
                  <tr key={m} className="border"><td className="py-2 px-3 border">{m}</td><td className="py-2 px-3 border">—</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* STR Report */}
      <Card className="mb-6">
        <CardHeader><CardTitle>5.0 Suspicious Transaction Report (STR) Summary</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground mb-3">Submitted: Monthly to Board Compliance Committee; individual STRs to ANIF as filed</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead><tr className="bg-muted/50"><th className="py-2 px-3 text-left border">Metric</th><th className="py-2 px-3 text-left border">Value</th></tr></thead>
              <tbody>
                {["Internal SARs received", "SARs escalated to MLRO", "STRs filed with ANIF", "Avg time: detection → SAR filing", "Avg time: SAR → STR decision", "Accounts frozen pending investigation", "Cases closed (no action)", "Cases referred to law enforcement"].map(m => (
                  <tr key={m} className="border"><td className="py-2 px-3 border">{m}</td><td className="py-2 px-3 border">—</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Compliance Declaration */}
      <Card>
        <CardHeader><CardTitle>6.0 Monthly Compliance Declaration</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground mb-3">Submitted: By 15th of following month | Recipient: CEO + Board Compliance Committee</p>
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <p className="font-semibold">MONTHLY COMPLIANCE DECLARATION — [Month/Year]</p>
            <p>I, [Compliance Officer Name], hereby declare that for the reporting period:</p>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>All KYC onboarding procedures were followed in accordance with the Company's KYC Framework</li>
              <li>All suspicious activity was reported to the MLRO in a timely manner</li>
              <li>[X] STRs were filed with ANIF during the period</li>
              <li>Sanctions screening was performed on all new customers and transactions</li>
              <li>No material compliance breaches were identified / [Description of any breaches]</li>
              <li>Staff training completion rate: [X]%</li>
              <li>All regulatory reporting deadlines were met</li>
            </ul>
            <div className="mt-4 pt-4 border-t">
              <p>Signed: ________________________</p>
              <p>Compliance Officer</p>
              <p>Date: ____/____/________</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
