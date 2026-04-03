import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Server, CheckCircle2, AlertTriangle, Clock, Shield } from "lucide-react";

const slaTargets = [
  { metric: "API Uptime", target: "99.95%", measurement: "Rolling 30-day window", tier: "All" },
  { metric: "API Latency (p50)", target: "< 200ms", measurement: "Median response time across all endpoints", tier: "All" },
  { metric: "API Latency (p95)", target: "< 500ms", measurement: "95th percentile response time", tier: "All" },
  { metric: "API Latency (p99)", target: "< 1,000ms", measurement: "99th percentile response time", tier: "Enterprise" },
  { metric: "Webhook Delivery", target: "< 5 seconds", measurement: "Time from event to first delivery attempt", tier: "All" },
  { metric: "Webhook Retry (max)", target: "72 hours", measurement: "Exponential backoff with 8 retry attempts", tier: "All" },
  { metric: "Payment Processing", target: "< 3 seconds", measurement: "End-to-end payment confirmation", tier: "All" },
  { metric: "Data Recovery (RPO)", target: "< 1 hour", measurement: "Recovery point objective for database", tier: "Enterprise" },
  { metric: "Disaster Recovery (RTO)", target: "< 4 hours", measurement: "Recovery time objective", tier: "Enterprise" },
];

const incidentSeverities = [
  { severity: "P1 — Critical", response: "15 min", resolution: "4 hours", notification: "Email + SMS + Status page", example: "Complete payment processing outage" },
  { severity: "P2 — Major", response: "30 min", resolution: "8 hours", notification: "Email + Status page", example: "Single payment channel degraded" },
  { severity: "P3 — Minor", response: "2 hours", resolution: "24 hours", notification: "Status page", example: "Elevated latency on non-critical endpoint" },
  { severity: "P4 — Low", response: "1 business day", resolution: "5 business days", notification: "Status page (if applicable)", example: "Documentation error, cosmetic issue" },
];

const maintenancePolicy = [
  { type: "Scheduled Maintenance", notice: "72 hours advance notice", window: "Saturday 02:00-06:00 UTC", impact: "Partial degradation possible" },
  { type: "Emergency Maintenance", notice: "Best-effort notice", window: "As needed", impact: "Service may be briefly unavailable" },
  { type: "Security Patch", notice: "Deployed immediately", window: "Any time", impact: "Zero-downtime deployment" },
];

const SLAPage = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO
      title="Service Level Agreement (SLA) | Kang Open Banking"
      description="Uptime guarantees, latency targets, incident response policies, and maintenance windows for Kang Open Banking API."
    />
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Badge variant="outline" className="gap-1"><Server className="h-3 w-3" /> SLA</Badge>
        <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Production</Badge>
      </div>
      <h1 className="text-3xl font-bold">Service Level Agreement</h1>
      <p className="text-muted-foreground mt-2">
        This document defines the service level commitments for Kang Open Banking API in production environments.
        Sandbox environments are best-effort and not covered by SLA guarantees. All times are UTC.
      </p>
    </div>

    {/* Uptime & Performance */}
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2" id="uptime-targets">
        <CheckCircle2 className="h-5 w-5 text-primary" />
        Uptime & Performance Targets
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead>SLA Target</TableHead>
            <TableHead>Measurement</TableHead>
            <TableHead>Tier</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slaTargets.map(s => (
            <TableRow key={s.metric}>
              <TableCell className="font-medium text-sm">{s.metric}</TableCell>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-sm">{s.target}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.measurement}</TableCell>
              <TableCell>
                <Badge variant={s.tier === "Enterprise" ? "secondary" : "outline"} className="text-xs">{s.tier}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Incident Response */}
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2" id="incident-response">
        <AlertTriangle className="h-5 w-5 text-primary" />
        Incident Response Policy
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Severity</TableHead>
            <TableHead>Response Time</TableHead>
            <TableHead>Resolution Target</TableHead>
            <TableHead>Notification</TableHead>
            <TableHead>Example</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidentSeverities.map(i => (
            <TableRow key={i.severity}>
              <TableCell>
                <Badge variant={i.severity.includes("Critical") ? "destructive" : i.severity.includes("Major") ? "secondary" : "outline"} className="text-xs">
                  {i.severity}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{i.response}</TableCell>
              <TableCell className="text-sm">{i.resolution}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{i.notification}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{i.example}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Maintenance Windows */}
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2" id="maintenance">
        <Clock className="h-5 w-5 text-primary" />
        Maintenance Policy
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Advance Notice</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Expected Impact</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {maintenancePolicy.map(m => (
            <TableRow key={m.type}>
              <TableCell className="font-medium text-sm">{m.type}</TableCell>
              <TableCell className="text-sm">{m.notice}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{m.window}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{m.impact}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Exclusions */}
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold" id="exclusions">SLA Exclusions</h2>
      <Card>
        <CardContent className="pt-6">
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Scheduled maintenance windows communicated in advance</li>
            <li>Force majeure events (natural disasters, government actions, widespread internet outages)</li>
            <li>Issues caused by client-side misconfiguration or exceeding published rate limits</li>
            <li>Sandbox environment availability (best-effort only)</li>
            <li>Third-party payment provider outages (MTN, Orange, Flutterwave, Stripe)</li>
            <li>Features marked as Beta or Preview</li>
          </ul>
        </CardContent>
      </Card>
    </div>

    {/* Credits */}
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold" id="credits">Service Credits</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uptime-Based Service Credits (Enterprise Tier)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Monthly Uptime</TableHead>
                <TableHead>Service Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-sm">99.00% - 99.95%</TableCell>
                <TableCell className="text-sm">10% of monthly fees</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-sm">95.00% - 98.99%</TableCell>
                <TableCell className="text-sm">25% of monthly fees</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-sm">Below 95.00%</TableCell>
                <TableCell className="text-sm">50% of monthly fees</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-4">
            Service credits must be requested within 30 days of the affected month.
            Credits are applied to future invoices and do not exceed 50% of monthly charges.
          </p>
        </CardContent>
      </Card>
    </div>

    {/* Contact */}
    <Alert className="border-primary/30 bg-primary/5">
      <Server className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        For custom SLA agreements, dedicated support, or enterprise uptime requirements, contact{' '}
        <code className="bg-muted px-1 rounded">enterprise@kangopenbanking.com</code> or visit the{' '}
        <a href="/developer/support" className="text-primary underline">Developer Support</a> page.
        Real-time status is available at the <a href="/developer/status" className="text-primary underline">Status Page</a>.
      </AlertDescription>
    </Alert>

    <AutoDocNavigation />
  </div>
);

export default SLAPage;
