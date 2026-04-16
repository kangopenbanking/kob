import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Shield, Clock, AlertTriangle } from "lucide-react";
import { PdfExportButton } from "@/components/regulatory/PdfExportButton";

const pdfSections = [
  {
    heading: "1.0 Policy Statement",
    content: [
      "Comprehensive BCP and DRP to ensure continued availability of critical payment services.",
      "Tested semi-annually, reviewed annually by Board Risk Committee.",
    ],
  },
  {
    heading: "2.0 Recovery Objectives",
    content: [
      "Tier 1 Critical (payments): RTO ≤ 4h, RPO ≤ 1h.",
      "Tier 2 Essential (API/auth): RTO ≤ 8h, RPO ≤ 4h.",
      "Tier 3 Important (reporting): RTO ≤ 24h, RPO ≤ 12h.",
      "Tier 4 Standard (docs): RTO ≤ 72h, RPO ≤ 24h.",
    ],
  },
  {
    heading: "3.0 Infrastructure Resilience",
    content: [
      "Synchronous replication to standby database.",
      "Asynchronous replication to DR site.",
      "PITR with 30-day WAL retention. Daily snapshots for 90 days.",
      "DNS failover < 5 minutes.",
    ],
  },
  {
    heading: "4.0 Incident Escalation",
    content: [
      "P1 Critical: CEO + Board within 1h, BEAC/COBAC within 4h.",
      "P2 Major: CTO + COO within 2h, COBAC within 24h.",
      "P3 Moderate: Engineering lead within 4h, monthly report.",
      "P4 Low: Standard ticket queue, quarterly summary.",
    ],
  },
];

export default function BusinessContinuity() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex items-start justify-between mb-4">
        <Badge variant="outline">KOB-REG-004 — Phase 2: License Application</Badge>
        <PdfExportButton
          title="Business Continuity & Disaster Recovery Plan"
          documentCode="KOB-REG-004"
          subtitle="Per COBAC Instruction No. 2006/01 and CEMAC Regulation No. 04/18, Article 22"
          sections={pdfSections}
        />
      </div>
      <h1 className="text-3xl font-bold mb-2">Business Continuity & Disaster Recovery Plan</h1>
      <p className="text-muted-foreground mb-8">
        Per COBAC Instruction No. 2006/01 on IT Risk Management and CEMAC Regulation No. 04/18, Article 22
      </p>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>1.0 Policy Statement</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-3">
          <p>
            Kang Open Banking S.A. maintains a comprehensive Business Continuity Plan (BCP) and Disaster Recovery Plan
            (DRP) designed to ensure the continued availability of critical payment services in the event of disruption,
            in compliance with COBAC requirements for payment service providers.
          </p>
          <p>
            This plan is tested semi-annually, reviewed annually by the Board Risk Committee, and updated following any
            material change in infrastructure, business operations, or risk profile.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>2.0 Recovery Objectives</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground">Service Tier</th>
                <th className="text-left py-2">Services</th>
                <th className="text-left py-2">RTO</th>
                <th className="text-left py-2">RPO</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2 font-semibold">Tier 1 — Critical</td>
                <td className="py-2">Payment processing, settlement, fraud detection</td>
                <td className="py-2">≤ 4 hours</td>
                <td className="py-2">≤ 1 hour</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold">Tier 2 — Essential</td>
                <td className="py-2">API gateway, authentication, webhooks</td>
                <td className="py-2">≤ 8 hours</td>
                <td className="py-2">≤ 4 hours</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold">Tier 3 — Important</td>
                <td className="py-2">Reporting, analytics, admin portal</td>
                <td className="py-2">≤ 24 hours</td>
                <td className="py-2">≤ 12 hours</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold">Tier 4 — Standard</td>
                <td className="py-2">Documentation, sandbox, developer tools</td>
                <td className="py-2">≤ 72 hours</td>
                <td className="py-2">≤ 24 hours</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <CardTitle>3.0 Infrastructure Resilience</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-4 leading-relaxed">
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">3.1 Data Replication</h4>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Synchronous replication to standby database within same region</li>
              <li>Asynchronous replication to geographically separated disaster recovery site</li>
              <li>Point-in-time recovery (PITR) with continuous WAL archiving — 30-day retention</li>
              <li>Automated daily snapshots retained for 90 days</li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">3.2 Failover Architecture</h4>
            <pre className="text-xs font-mono bg-muted/50 p-3 rounded overflow-x-auto">{`
  Primary Region (Active)          DR Region (Standby)
  ┌────────────────────┐           ┌────────────────────┐
  │  App Servers (3+)  │           │  App Servers (2+)  │
  │  Database Primary  │──sync──►  │  Database Replica  │
  │  Redis Primary     │──sync──►  │  Redis Replica     │
  │  Object Storage    │──async─►  │  Object Storage    │
  └────────────────────┘           └────────────────────┘
         │                                 │
         └─── DNS Failover (< 5 min) ──────┘
`}</pre>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <CardTitle>4.0 Incident Escalation & Notification</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground">Severity</th>
                <th className="text-left py-2">Definition</th>
                <th className="text-left py-2">Escalation</th>
                <th className="text-left py-2">BEAC/COBAC Notification</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2 font-semibold text-destructive">P1 — Critical</td>
                <td className="py-2">Total service outage or data breach</td>
                <td className="py-2">CEO + Board within 1 hour</td>
                <td className="py-2">Within 4 hours</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold text-orange-600">P2 — Major</td>
                <td className="py-2">Partial service degradation affecting payments</td>
                <td className="py-2">CTO + COO within 2 hours</td>
                <td className="py-2">Within 24 hours</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold text-yellow-600">P3 — Moderate</td>
                <td className="py-2">Non-critical service impairment</td>
                <td className="py-2">Engineering lead within 4 hours</td>
                <td className="py-2">Monthly report</td>
              </tr>
              <tr>
                <td className="py-2">P4 — Low</td>
                <td className="py-2">Minor issue, no customer impact</td>
                <td className="py-2">Standard ticket queue</td>
                <td className="py-2">Quarterly summary</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5.0 Testing & Review Schedule</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground">Test Type</th>
                <th className="text-left py-2">Frequency</th>
                <th className="text-left py-2">Scope</th>
                <th className="text-left py-2">Reporting</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2">Tabletop exercise</td>
                <td className="py-2">Quarterly</td>
                <td className="py-2">Scenario-based walkthrough with key staff</td>
                <td className="py-2">Minutes to Risk Committee</td>
              </tr>
              <tr>
                <td className="py-2">Failover test</td>
                <td className="py-2">Semi-annually</td>
                <td className="py-2">Full DR region activation with live traffic</td>
                <td className="py-2">Test report to Board + COBAC</td>
              </tr>
              <tr>
                <td className="py-2">Backup restoration</td>
                <td className="py-2">Monthly</td>
                <td className="py-2">Random backup selected and restored to verify integrity</td>
                <td className="py-2">IT operations log</td>
              </tr>
              <tr>
                <td className="py-2">Full BCP plan review</td>
                <td className="py-2">Annually</td>
                <td className="py-2">Complete plan review, update, and re-approval by Board</td>
                <td className="py-2">Updated BCP document to COBAC</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
