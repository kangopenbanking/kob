import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Network,
  Database,
  FileText,
  Workflow,
  ShieldCheck,
  RefreshCw,
  Activity,
  CheckCircle2,
} from "lucide-react";

const ADAPTERS = [
  {
    icon: Network,
    name: "REST",
    when: "Modern banks exposing JSON over HTTPS with OAuth2/Bearer/Basic auth.",
    contract: "_shared/bank-connectors/rest-bank.ts",
  },
  {
    icon: Database,
    name: "SQL Gateway",
    when: "Banks providing read-only PostgreSQL or MySQL replicas. Parameterised queries only.",
    contract: "_shared/bank-connectors/sql-bank.ts",
  },
  {
    icon: FileText,
    name: "File (CSV / pain.001 / MT940)",
    when: "Legacy core banking systems that drop daily extracts to SFTP or Supabase Storage.",
    contract: "_shared/bank-connectors/file-bank.ts",
  },
  {
    icon: Workflow,
    name: "SOAP",
    when: "Legacy core banking with WSDL contracts and XML envelopes.",
    contract: "_shared/payment-connectors/soap-bank.ts",
  },
];

const WAVES = [
  {
    icon: Building2,
    title: "Wave 1 — Connector Contract & Adapters",
    items: [
      "Unified BankConnector interface (getAccountDetails, getBalance, getTransactions, initiateTransfer, reconcile, healthCheck)",
      "REST, SQL, File, SOAP adapters under _shared/bank-connectors/*",
      "bank-data-router edge function with priority-ordered failover",
      "bank_connector_configs and bank_connector_attempts tables (RLS-enforced)",
    ],
  },
  {
    icon: RefreshCw,
    title: "Wave 2 — Polling & Reconciliation",
    items: [
      "bank-data-poller cron (every 5 minutes) processing bank_sync_jobs",
      "Exponential backoff (60s base, 1h cap) on transient failures",
      "bank-reconcile-engine with rule-based discrepancy flagging",
      "reconciliation_reports persisted per run; auto-credit deliberately disabled",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Wave 3 — Ledger Audit & Onboarding",
    items: [
      "Additive transactions columns: source_connector, sync_status, reconciliation_status, connector_audit_trail",
      "bank_onboarding_records with six-stage certification lifecycle",
      "Admin wizard at /admin/bank-onboarding",
      "Public certification guide at /developer/connectors/bank-onboarding-flow",
    ],
  },
  {
    icon: Activity,
    title: "Wave 4 — Documentation & Spec",
    items: [
      "OpenAPI bumped to v4.15.0 (additive metadata only, zero contract changes)",
      "Changelog entry within 48h (ORDER P7)",
      "This architecture overview page (ORDER P6: explanation + table + diagram)",
      "Multi-language adapter examples on the Bank Adapter Framework page (ORDER P9)",
    ],
  },
];

export default function CemacBankIntegration() {
  return (
    <div className="container mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <Badge variant="outline" className="mb-2">Bank Connectors</Badge>
        <h1 className="text-3xl font-bold">CEMAC Universal Bank Integration</h1>
        <p className="mt-2 text-muted-foreground">
          A plug-and-play bank integration layer for every CEMAC institution — from modern REST APIs to
          legacy SOAP and overnight file feeds — without altering a single existing /v1/* contract.
        </p>
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle>Architecture at a Glance</CardTitle>
          <CardDescription>
            All new components sit beside the existing payment rails. The /v1/* surface, AISP, PISP, and
            mobile money connectors are untouched (Standing Order 1).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border border-border/50 bg-muted/30 p-4 text-xs leading-relaxed text-foreground">
{`            EXISTING /v1/* SURFACE (UNCHANGED)
                         |
        +----------------+----------------+
        |                                 |
 payment-router-charge           bank-data-router (new)
        |                                 |
   payment-connectors            bank-connectors (new)
   (MTN, Orange, FW, SOAP)       REST | SQL | File | SOAP
        |                                 |
        +----> outbox <-------------------+
                |
         webhook-dispatcher
                ^
                |
       bank-data-poller (cron 5 min, new)`}
          </pre>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle>Adapter Decision Matrix</CardTitle>
          <CardDescription>Pick the adapter that matches the bank's capability today; switch later without touching downstream code.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left">
                  <th className="py-2 pr-4 font-medium">Adapter</th>
                  <th className="py-2 pr-4 font-medium">When to use</th>
                  <th className="py-2 font-medium">Implementation</th>
                </tr>
              </thead>
              <tbody>
                {ADAPTERS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <tr key={a.name} className="border-b border-border/30 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{a.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{a.when}</td>
                      <td className="py-3 font-mono text-xs text-muted-foreground">{a.contract}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle>Delivery Waves</CardTitle>
          <CardDescription>Each wave is additive and independently deployable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {WAVES.map((w, i) => {
            const Icon = w.icon;
            return (
              <div key={i} className="rounded-md border border-border/50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">{w.title}</h3>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {w.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle>Operating the Platform</CardTitle>
          <CardDescription>Day-to-day runbook for bank operations and compliance teams.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left">
                  <th className="py-2 pr-4 font-medium">Surface</th>
                  <th className="py-2 pr-4 font-medium">Audience</th>
                  <th className="py-2 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-3 pr-4 font-mono text-xs">/admin/bank-onboarding</td>
                  <td className="py-3 pr-4 text-muted-foreground">Platform admin</td>
                  <td className="py-3 text-muted-foreground">Six-stage certification wizard for new banks.</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-3 pr-4 font-mono text-xs">/admin/tenant-connectors</td>
                  <td className="py-3 pr-4 text-muted-foreground">Platform admin</td>
                  <td className="py-3 text-muted-foreground">Manage credentials, priority, polling, and routing trail.</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-3 pr-4 font-mono text-xs">bank-data-router</td>
                  <td className="py-3 pr-4 text-muted-foreground">Internal services</td>
                  <td className="py-3 text-muted-foreground">Server-to-server execution of any BankConnector op.</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-3 pr-4 font-mono text-xs">bank-data-poller</td>
                  <td className="py-3 pr-4 text-muted-foreground">Cron (5 min)</td>
                  <td className="py-3 text-muted-foreground">Automated incremental sync with backoff.</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-mono text-xs">bank-reconcile-engine</td>
                  <td className="py-3 pr-4 text-muted-foreground">Compliance ops</td>
                  <td className="py-3 text-muted-foreground">On-demand reconciliation with rule-based flagging.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle>Compliance Posture</CardTitle>
          <CardDescription>How the integration layer respects the Guardian Standing Orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><strong className="text-foreground">Standing Order 1 (The Lock):</strong> No /v1/* operationId, schema, or response field renamed or removed.</li>
            <li><strong className="text-foreground">Standing Order 4 (Surgeon Rule):</strong> Every database change is additive — new tables and nullable columns with defaults only.</li>
            <li><strong className="text-foreground">Standing Order 6 (Version Gate):</strong> OpenAPI minor version increments per wave (4.12 → 4.13 → 4.14 → 4.15).</li>
            <li><strong className="text-foreground">Order P1 (Public First):</strong> This page and all bank-connector docs are reachable without authentication.</li>
            <li><strong className="text-foreground">Order P7 (Changelog):</strong> Each wave logged in /changelog.json within 48 hours of deployment.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
