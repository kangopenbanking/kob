import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Building2, Server, Database, FileText, Users, CheckCircle, ArrowRight } from "lucide-react";

const steps = [
  {
    step: 1,
    title: "Register Your Institution",
    description: "Create an institution account on the KOB platform and complete KYB verification.",
    details: [
      "Sign up at kangopenbanking.com/register",
      "Submit institution details: name, COBAC license, SWIFT/BIC code",
      "Upload RCCM certificate and regulatory documents",
      "Await verification (typically 1-3 business days)",
    ],
  },
  {
    step: 2,
    title: "Choose Your Connector Type",
    description: "Select the integration method that matches your bank's infrastructure.",
    details: [
      "API Connector: Your bank has REST/SOAP endpoints we can call",
      "Database Connector: We poll your read-only database view on schedule",
      "File Connector: You upload daily CSV/MT940/CAMT.053 files via SFTP",
      "Manual Console: Staff approve transactions through our secure portal",
    ],
  },
  {
    step: 3,
    title: "Configure Data Mapping",
    description: "Map your bank's proprietary data fields to the KOB unified schema.",
    details: [
      "Define customer ID mapping (your ID to KOB unified ID)",
      "Map account types to KOB's OBIE-compliant account taxonomy",
      "Configure transaction categorization rules",
      "Set up balance type mapping (available, booked, pending)",
    ],
  },
  {
    step: 4,
    title: "Test in Sandbox",
    description: "Validate your connector with test data before going live.",
    details: [
      "Use sandbox API keys for testing (free, no limits)",
      "Simulate account queries, balance checks, and transfers",
      "Verify webhook delivery and response formats",
      "Run the automated compliance test suite",
    ],
  },
  {
    step: 5,
    title: "Go Live",
    description: "Switch to production after passing all integration tests.",
    details: [
      "Request production API credentials",
      "Configure mTLS certificates for secure communication",
      "Set up monitoring and alerting for connector health",
      "Schedule your first reconciliation run",
    ],
  },
];

export default function BankOnboardingGuide() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Bank Onboarding Guide</h1>
        <p className="mt-2 text-muted-foreground">
          Step-by-step instructions for connecting your bank's core system to the Kang Open Banking platform.
        </p>
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Who This Guide Is For
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This guide is designed for CEMAC-zone banks that want to expose a modern Open Banking API
            without building one from scratch. Whether your bank runs on Temenos, SOPRA, Infosys, or
            even manual spreadsheets, KOB provides a plug-in connector that normalizes your data into
            an international-standard API.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {steps.map((s, i) => (
          <Card key={s.step} className="border border-border/50">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-primary/5 text-lg font-bold text-primary">
                  {s.step}
                </div>
                <div>
                  <CardTitle className="text-lg">{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 ml-14">
                {s.details.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle>Connector Types Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">API</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Database</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">File</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Manual</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Real-time data", api: "Yes", db: "Near real-time", file: "Daily", manual: "On approval" },
                  { feature: "Setup time", api: "1-2 weeks", db: "1-3 weeks", file: "3-5 days", manual: "1 day" },
                  { feature: "Bank IT required", api: "Yes", db: "Yes", file: "Minimal", manual: "No" },
                  { feature: "Payment initiation", api: "Yes", db: "Via batch", file: "Via batch", manual: "Manual" },
                  { feature: "Ideal for", api: "Modern banks", db: "Legacy core", file: "Traditional", manual: "Micro-FIs" },
                ].map((r) => (
                  <tr key={r.feature} className="border-b border-border/20">
                    <td className="px-3 py-2 font-medium">{r.feature}</td>
                    <td className="px-3 py-2">{r.api}</td>
                    <td className="px-3 py-2">{r.db}</td>
                    <td className="px-3 py-2">{r.file}</td>
                    <td className="px-3 py-2">{r.manual}</td>
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
