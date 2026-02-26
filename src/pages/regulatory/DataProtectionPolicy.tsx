import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Globe, Clock, FileText } from "lucide-react";
import { PdfExportButton } from "@/components/regulatory/PdfExportButton";

const pdfSections = [
  { heading: "1.0 Policy Objectives", content: ["Establishes principles and controls for personal data processing.", "DPO appointed, reports directly to Board."] },
  { heading: "2.0 Data Processing Principles", content: ["Lawfulness, purpose limitation, data minimisation, accuracy, storage limitation, integrity & confidentiality.", "AES-256 encryption at rest, TLS 1.3 in transit, role-based access."] },
  { heading: "3.0 Data Categories", content: ["Identity (High), Contact (Medium), Financial (High), Technical (Medium), Biometric (Very High)."] },
  { heading: "4.0 Retention Schedule", content: ["KYC: 7 years. Transactions: 10 years. Consent: duration + 5 years. Biometric: deleted within 72 hours."] },
  { heading: "5.0 Cross-Border Transfers", content: ["Stripe (EU/Ireland): SCCs + DPA. Flutterwave (Nigeria): DPA with adequacy assessment. PayPal (US): SCCs + DPA."] },
];

export default function DataProtectionPolicy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex items-start justify-between mb-4">
        <Badge variant="outline">KOB-REG-006 — Phase 3: Data Protection</Badge>
        <PdfExportButton title="Data Protection Policy" documentCode="KOB-REG-006" subtitle="Per Cameroon Law No. 2010/012, CEMAC framework, and GDPR" sections={pdfSections} />
      </div>
      <h1 className="text-3xl font-bold mb-2">Data Protection Policy</h1>
      <p className="text-muted-foreground mb-8">Per Cameroon Law No. 2010/012 on Cybersecurity and Cybercrime, CEMAC data protection framework, and GDPR (where applicable to EU data subjects)</p>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle>1.0 Policy Objectives</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-3">
          <p>This policy establishes the principles, controls, and obligations governing the collection, processing, storage, and transfer of personal data by Kang Open Banking S.A., ensuring compliance with applicable data protection legislation in Cameroon and the CEMAC zone.</p>
          <p><strong>Data Protection Officer (DPO):</strong> [Name], contactable at [email]. The DPO reports directly to the Board and is independent of operational business units.</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>2.0 Data Processing Principles</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-3">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Principle</th><th className="text-left py-2">Implementation</th></tr></thead>
            <tbody className="divide-y">
              <tr><td className="py-2 font-semibold">Lawfulness</td><td className="py-2">Processing based on consent, contractual necessity, legal obligation, or legitimate interest</td></tr>
              <tr><td className="py-2 font-semibold">Purpose Limitation</td><td className="py-2">Data collected only for specified, explicit purposes disclosed to data subjects at collection</td></tr>
              <tr><td className="py-2 font-semibold">Data Minimisation</td><td className="py-2">Only data necessary for the stated purpose is collected and processed</td></tr>
              <tr><td className="py-2 font-semibold">Accuracy</td><td className="py-2">Data kept up-to-date; data subjects can request correction via self-service portal</td></tr>
              <tr><td className="py-2 font-semibold">Storage Limitation</td><td className="py-2">Data retained per retention schedule (Section 4.0); anonymised or deleted after retention period</td></tr>
              <tr><td className="py-2 font-semibold">Integrity & Confidentiality</td><td className="py-2">AES-256 encryption at rest, TLS 1.3 in transit, role-based access controls</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><CardTitle>3.0 Data Categories & Legal Basis</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-3">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Data Category</th><th className="text-left py-2">Examples</th><th className="text-left py-2">Legal Basis</th><th className="text-left py-2">Sensitivity</th></tr></thead>
            <tbody className="divide-y">
              <tr><td className="py-2">Identity data</td><td className="py-2">Name, DOB, nationality, ID number</td><td className="py-2">Legal obligation (KYC/AML)</td><td className="py-2">High</td></tr>
              <tr><td className="py-2">Contact data</td><td className="py-2">Email, phone, address</td><td className="py-2">Contractual necessity</td><td className="py-2">Medium</td></tr>
              <tr><td className="py-2">Financial data</td><td className="py-2">Account numbers, balances, transactions</td><td className="py-2">Contractual necessity</td><td className="py-2">High</td></tr>
              <tr><td className="py-2">Technical data</td><td className="py-2">IP address, device fingerprint, user agent</td><td className="py-2">Legitimate interest (fraud prevention)</td><td className="py-2">Medium</td></tr>
              <tr><td className="py-2">Biometric data</td><td className="py-2">Liveness check data (KYC verification)</td><td className="py-2">Explicit consent</td><td className="py-2">Very High</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><CardTitle>4.0 Retention Schedule</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-3">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Data Type</th><th className="text-left py-2">Retention Period</th><th className="text-left py-2">Post-Retention Action</th></tr></thead>
            <tbody className="divide-y">
              <tr><td className="py-2">KYC identity documents</td><td className="py-2">7 years from end of customer relationship</td><td className="py-2">Secure deletion</td></tr>
              <tr><td className="py-2">Transaction records</td><td className="py-2">10 years</td><td className="py-2">Anonymisation</td></tr>
              <tr><td className="py-2">Consent records</td><td className="py-2">Duration of consent + 5 years</td><td className="py-2">Secure deletion</td></tr>
              <tr><td className="py-2">Audit logs</td><td className="py-2">7 years</td><td className="py-2">Archival then deletion</td></tr>
              <tr><td className="py-2">Marketing data</td><td className="py-2">Until consent withdrawn + 30 days</td><td className="py-2">Secure deletion</td></tr>
              <tr><td className="py-2">Biometric verification data</td><td className="py-2">Deleted within 72 hours of verification completion</td><td className="py-2">Immediate secure deletion</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /><CardTitle>5.0 Cross-Border Data Transfer</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-4">
          <p>Where personal data is transferred outside Cameroon or the CEMAC zone (e.g., to payment processors in the US/EU), the Company ensures adequate protection through:</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Transfer Destination</th><th className="text-left py-2">Recipient</th><th className="text-left py-2">Safeguard Mechanism</th></tr></thead>
            <tbody className="divide-y">
              <tr><td className="py-2">EU/EEA (Ireland)</td><td className="py-2">Stripe Inc.</td><td className="py-2">Standard Contractual Clauses (SCCs) + DPA</td></tr>
              <tr><td className="py-2">Nigeria</td><td className="py-2">Flutterwave Inc.</td><td className="py-2">Data Processing Agreement with adequacy assessment</td></tr>
              <tr><td className="py-2">United States</td><td className="py-2">PayPal Holdings</td><td className="py-2">Standard Contractual Clauses (SCCs) + DPA</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">All cross-border transfers are subject to prior notification to the Cameroon data protection authority as required by Law No. 2010/012.</p>
        </CardContent>
      </Card>
    </div>
  );
}
