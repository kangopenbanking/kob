import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Layers, KeyRound, FlaskConical, ShieldCheck, Rocket, CheckCircle2 } from "lucide-react";

const STAGES = [
  { icon: ClipboardList, title: "1. Assessment", desc: "Capture core banking system, existing API surface (REST/SOAP/DB/Files), expected data volumes, and operational constraints. Recorded in bank_onboarding_records.assessment_data." },
  { icon: Layers, title: "2. Adapter Selection", desc: "Pick one of the four built-in adapters: REST, SQL gateway, File (CSV/pain.001/MT940), or SOAP. Decision matrix on /developer/connectors/bank-adapter-framework." },
  { icon: KeyRound, title: "3. Credentials", desc: "Encrypt and store credentials in bank_connector_configs.credentials_encrypted using the existing AES-GCM key. Configured under /admin/tenant-connectors." },
  { icon: FlaskConical, title: "4. Sandbox Test", desc: "Invoke bank-data-router with sandbox credentials and exercise healthCheck, getAccountDetails, getTransactions. All attempts are recorded in bank_connector_attempts." },
  { icon: ShieldCheck, title: "5. Certification", desc: "Complete the six-item checklist: encrypted creds, healthy adapter, sample fetch, reconciliation pass, audit trail, signed runbook." },
  { icon: Rocket, title: "6. Go Live", desc: "Toggle bank_connector_configs.enabled = true. Wave 2 polling (bank-data-poller, every 5 minutes) starts pulling production data automatically." },
];

export default function BankOnboardingFlow() {
  return (
    <div className="container mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <Badge variant="outline" className="mb-2">Bank Connectors</Badge>
        <h1 className="text-3xl font-bold">Bank Onboarding Flow</h1>
        <p className="mt-2 text-muted-foreground">
          Six-stage certification path to bring any CEMAC bank — modern, legacy, or file-based — onto the KOB platform without changing /v1/* contracts.
        </p>
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle>The Six Stages</CardTitle>
          <CardDescription>Each stage is tracked in bank_onboarding_records and visible at /admin/bank-onboarding.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex gap-4 rounded-md border border-border/50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted/30">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader><CardTitle>Certification Checklist</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {[
              "Credentials encrypted and stored in bank_connector_configs",
              "Adapter health check returns OK",
              "Sample account fetch verified end-to-end via bank-data-router",
              "Reconciliation run completes without unflagged variance (bank-reconcile-engine)",
              "Connector attempt audit trail confirmed in bank_connector_attempts",
              "Operational runbook signed off by bank and KOB ops",
            ].map((c) => (
              <li key={c} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {c}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader><CardTitle>Ledger Audit Fields (Wave 3)</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Four additive columns on `transactions` track adapter provenance and sync state. All existing reads are unaffected (Standing Order 1).
          </p>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Column</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Default</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Purpose</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">source_connector</td><td className="px-3 py-2">NULL</td><td className="px-3 py-2">Adapter that produced the row</td></tr>
              <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">sync_status</td><td className="px-3 py-2">'synced'</td><td className="px-3 py-2">synced / pending_sync / failed_sync</td></tr>
              <tr className="border-b border-border/20"><td className="px-3 py-2 font-mono text-xs">reconciliation_status</td><td className="px-3 py-2">'pending'</td><td className="px-3 py-2">pending / matched / flagged / auto_corrected</td></tr>
              <tr><td className="px-3 py-2 font-mono text-xs">connector_audit_trail</td><td className="px-3 py-2">[]</td><td className="px-3 py-2">JSON history of connector touches</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
