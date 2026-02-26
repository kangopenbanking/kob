import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, Server, Landmark, Shield, ArrowRight } from "lucide-react";
import { PdfExportButton } from "@/components/regulatory/PdfExportButton";

const pdfSections = [
  { heading: "1.0 Application Summary", content: ["Application for PSP authorisation under CEMAC Regulation No. 04/18.", "Category 2 — Payment Initiation and Account Information Services.", "Services: PISP, AISP, Payment Gateway, Mobile Money Aggregation.", "Geographic Scope: Republic of Cameroon (initial); CEMAC zone (expansion)."] },
  { heading: "2.0 Technical Operations", content: ["Multi-tenant payment orchestration platform.", "Channels: Mobile Money (MTN/Orange via Flutterwave), Card (Visa/MC via Stripe), Bank Transfers, PayPal, USSD."], table: { headers: ["Processor", "Services", "Jurisdiction"], rows: [["Stripe Inc.", "Card acquiring, tokenisation", "US / EU (Ireland)"], ["Flutterwave Inc.", "Mobile money, bank transfers", "US / Nigeria"], ["PayPal Holdings", "PayPal payments, payouts", "US"]] } },
  { heading: "3.0 Settlement Flow", content: ["Mobile Money: T+1. Card: T+2. Bank Transfers: T+1.", "Daily three-way reconciliation (internal ledger ↔ processor ↔ bank statement)."] },
  { heading: "4.0 Safeguarding of Funds", content: ["Segregated client funds account at BEAC-approved institution.", "Float segregation: capped at 48h projected settlement volume.", "Escrow for disputed funds. Prohibition on use of safeguarded funds for operations."] },
  { heading: "5.0 Capital Adequacy", content: ["Minimum Share Capital: 500,000,000 XAF.", "Solvency Ratio Target: ≥ 8% of risk-weighted assets.", "Liquidity: 30-day operational expense reserve."] },
];

export default function LicenseApplication() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex items-start justify-between mb-4">
        <Badge variant="outline">KOB-REG-003 — Phase 2: License Application</Badge>
        <PdfExportButton title="PSP License Application" documentCode="KOB-REG-003" subtitle="Application under CEMAC Regulation No. 04/18-CEMAC-UMAC-COBAC on Payment Services" sections={pdfSections} />
      </div>
      <h1 className="text-3xl font-bold mb-2">Payment Service Provider License Application</h1>
      <p className="text-muted-foreground mb-8">Application under CEMAC Regulation No. 04/18-CEMAC-UMAC-COBAC on Payment Services in the CEMAC Zone</p>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /><CardTitle>1.0 Application Summary</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-3">
          <p>Kang Open Banking S.A. hereby applies to the Banque des États de l'Afrique Centrale (BEAC), on the recommendation of the Commission Bancaire de l'Afrique Centrale (COBAC), for authorisation to operate as a Payment Service Provider (PSP) within the CEMAC zone.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><tbody className="divide-y">
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground w-48">License Category</td><td className="py-2">Category 2 — Payment Initiation and Account Information Services</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Services Requested</td><td className="py-2">Payment initiation (PISP), Account information (AISP), Payment gateway, Mobile money aggregation</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Geographic Scope</td><td className="py-2">Republic of Cameroon (initial); CEMAC zone (expansion)</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Target Launch</td><td className="py-2">Q3 2026</td></tr>
            </tbody></table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /><CardTitle>2.0 Technical Operations Description</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-4">
          <p>The platform operates as a multi-tenant payment orchestration layer connecting financial institutions, merchants, and end-users through standardised APIs compliant with Open Banking principles.</p>
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">2.1 Payment Channels Supported</h4>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Mobile Money (MTN MoMo, Orange Money) — via Flutterwave aggregation</li>
              <li>Card payments (Visa, Mastercard) — via Stripe processing</li>
              <li>Bank transfers (CEMAC domestic) — via direct BEAC RTGS/ACH connectivity</li>
              <li>PayPal — via PayPal REST API integration</li>
              <li>USSD — via mobile operator channel integration</li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">2.2 Processor Dependency Disclosure</h4>
            <p className="text-muted-foreground mb-2">Per Article 18 of CEMAC Regulation No. 04/18, the Company discloses the following third-party processor dependencies:</p>
            <table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Processor</th><th className="text-left py-2">Services</th><th className="text-left py-2">Jurisdiction</th><th className="text-left py-2">Data Location</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="py-2">Stripe Inc.</td><td className="py-2">Card acquiring, tokenisation</td><td className="py-2">United States</td><td className="py-2">EU (Ireland)</td></tr>
                <tr><td className="py-2">Flutterwave Inc.</td><td className="py-2">Mobile money, bank transfers</td><td className="py-2">United States / Nigeria</td><td className="py-2">Africa (Nigeria)</td></tr>
                <tr><td className="py-2">PayPal Holdings Inc.</td><td className="py-2">PayPal payments, payouts</td><td className="py-2">United States</td><td className="py-2">EU/US</td></tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><ArrowRight className="h-5 w-5 text-primary" /><CardTitle>3.0 Settlement Flow Architecture</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-4">
          <pre className="text-xs font-mono bg-muted/50 p-4 rounded-lg overflow-x-auto leading-relaxed">{`
  Customer          KOB Platform           Processor          Settlement Bank
     │                   │                    │                     │
     │──── Initiate ────►│                    │                     │
     │                   │──── Auth/Capture ─►│                     │
     │                   │◄─── Confirm ──────│                     │
     │                   │                    │                     │
     │                   │  [T+1 Settlement Cycle]                  │
     │                   │                    │──── Settle ────────►│
     │                   │◄── Settlement ────│                     │
     │                   │                    │                     │
     │                   │──── Payout ───────────────────────────►│
     │                   │     (to merchant settlement account)    │
`}</pre>
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">3.1 Settlement Schedule</h4>
            <table className="w-full text-sm"><tbody className="divide-y">
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground w-40">Mobile Money</td><td className="py-2">T+1 business day (subject to Flutterwave settlement to KOB)</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Card Payments</td><td className="py-2">T+2 business days (subject to Stripe payout cycle)</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Bank Transfers</td><td className="py-2">T+1 business day via BEAC clearing</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Reconciliation</td><td className="py-2">Daily three-way reconciliation (internal ledger ↔ processor ↔ bank statement)</td></tr>
            </tbody></table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /><CardTitle>4.0 Safeguarding of Customer Funds</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-4">
          <p>In accordance with Article 15 of CEMAC Regulation No. 04/18 and COBAC Instruction on Safeguarding, the Company undertakes the following safeguarding measures:</p>
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">4.1 Segregation Model</h4>
            <ul className="space-y-2 list-disc list-inside text-muted-foreground">
              <li><strong>Client funds account:</strong> Segregated account at a BEAC-approved credit institution, holding all customer funds in trust. No commingling with operational funds.</li>
              <li><strong>Float segregation:</strong> Operational float (for settlement timing) held in separate designated account, capped at 48-hour projected settlement volume.</li>
              <li><strong>Escrow structure:</strong> Disputed funds held in escrow sub-account pending resolution, not available for operational use.</li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">4.2 Safeguarding Controls</h4>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Daily reconciliation of safeguarded funds against customer balances</li>
              <li>Monthly safeguarding adequacy report to Board and COBAC</li>
              <li>External auditor confirmation of safeguarding adequacy (annual)</li>
              <li>Prohibition on use of safeguarded funds for operational purposes or lending</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle>5.0 Capital Adequacy</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-3">
          <p>The Company confirms compliance with the minimum capital requirements established under COBAC Regulation R-2019/01:</p>
          <table className="w-full text-sm"><tbody className="divide-y">
            <tr><td className="py-2 pr-4 font-medium text-muted-foreground w-48">Minimum Share Capital</td><td className="py-2">500,000,000 XAF</td></tr>
            <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Paid-Up Capital</td><td className="py-2">[Amount] XAF — evidenced by bank certificate</td></tr>
            <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Solvency Ratio Target</td><td className="py-2">≥ 8% of risk-weighted assets (per Basel framework as adopted by COBAC)</td></tr>
            <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Liquidity Coverage</td><td className="py-2">Minimum 30-day operational expense reserve maintained at all times</td></tr>
          </tbody></table>
        </CardContent>
      </Card>
    </div>
  );
}
