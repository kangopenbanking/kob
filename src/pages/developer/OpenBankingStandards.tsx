import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Shield, CheckCircle, FileText, Globe } from "lucide-react";

const standards = [
  {
    name: "FAPI 1.0 Advanced",
    status: "Compliant",
    description: "Financial-grade API security profile ensuring high-assurance authentication and authorization.",
    requirements: [
      "PKCE mandatory on all authorization flows",
      "Nonce required for authorization requests",
      "mTLS sender-constrained access tokens",
      "Pushed Authorization Requests (PAR) supported",
      "Signed request objects (JAR) required",
    ],
  },
  {
    name: "COBAC Regulatory Framework",
    status: "Aligned",
    description: "Banking Commission of Central Africa (COBAC) compliance for CEMAC member states.",
    requirements: [
      "Transaction reporting in COBAC-mandated format",
      "KYC/AML screening per COBAC Regulation R-2001/07",
      "Capital adequacy reporting support",
      "Cross-border transaction monitoring for CEMAC zone",
      "Suspicious activity report (SAR) generation",
    ],
  },
  {
    name: "PSD2 / Open Banking",
    status: "Compatible",
    description: "Payment Services Directive 2 compatible flows for account access and payment initiation.",
    requirements: [
      "Strong Customer Authentication (SCA) via FAPI",
      "AISP (Account Information) consent management",
      "PISP (Payment Initiation) with consent verification",
      "90-day consent validity with renewal flows",
      "Third-Party Provider (TPP) registration and management",
    ],
  },
  {
    name: "ISO 20022",
    status: "Supported",
    description: "Universal financial messaging standard for interbank payment and reporting messages.",
    requirements: [
      "pain.001 (Customer Credit Transfer Initiation)",
      "pain.002 (Payment Status Report)",
      "camt.052 (Intraday Account Report)",
      "camt.053 (End-of-Day Statement)",
      "camt.054 (Credit/Debit Notification)",
    ],
  },
];

export default function OpenBankingStandards() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Open Banking Standards</h1>
        <p className="mt-2 text-muted-foreground">
          KOB aligns with international open banking standards and CEMAC regional regulatory requirements.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {standards.map((s) => (
          <Card key={s.name} className="border border-border/50 text-center">
            <CardContent className="pt-6">
              <Shield className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 text-sm font-semibold">{s.name}</p>
              <Badge variant="default" className="mt-2 text-xs">{s.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {standards.map((s) => (
        <Card key={s.name} className="border border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>{s.name}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </div>
              <Badge variant="default" className="ml-auto">{s.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {s.requirements.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            CEMAC Zone Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Country</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Currency</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Regulator</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { country: "Cameroon", currency: "XAF", regulator: "COBAC / BEAC", status: "Active" },
                  { country: "Chad", currency: "XAF", regulator: "COBAC / BEAC", status: "Ready" },
                  { country: "Central African Republic", currency: "XAF", regulator: "COBAC / BEAC", status: "Ready" },
                  { country: "Republic of Congo", currency: "XAF", regulator: "COBAC / BEAC", status: "Ready" },
                  { country: "Equatorial Guinea", currency: "XAF", regulator: "COBAC / BEAC", status: "Ready" },
                  { country: "Gabon", currency: "XAF", regulator: "COBAC / BEAC", status: "Ready" },
                ].map((c) => (
                  <tr key={c.country} className="border-b border-border/20">
                    <td className="px-3 py-2 font-medium">{c.country}</td>
                    <td className="px-3 py-2">{c.currency}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.regulator}</td>
                    <td className="px-3 py-2">
                      <Badge variant={c.status === "Active" ? "default" : "secondary"} className="text-xs">
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
