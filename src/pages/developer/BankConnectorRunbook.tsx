// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P6)
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, FileSearch, RotateCcw, GitCompare, ShieldCheck, Activity } from "lucide-react";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const STATUSES = [
  { code: "queued", meaning: "File received, SHA-256 hash computed, awaiting validation worker" },
  { code: "validating", meaning: "Header + per-row schema validation in progress" },
  { code: "duplicate_rejected", meaning: "Same content (file_type + SHA-256) was already accepted within retention window" },
  { code: "partially_accepted", meaning: "Some rows passed, some failed validation — error CSV available for download" },
  { code: "accepted", meaning: "All rows passed validation, ready to ingest" },
  { code: "ingested", meaning: "Rows upserted into canonical tables (accounts / transactions / balances / beneficiaries)" },
  { code: "reconciled", meaning: "Outbound batch matched 100% against bank status feed" },
  { code: "reconciliation_partial", meaning: "Some outbound items unmatched — investigate via reconciliation dashboard" },
  { code: "failed", meaning: "Hard failure (file unreadable, mTLS broken, or institution suspended)" },
];

const PHASES = [
  {
    id: "ingest",
    Icon: Upload,
    title: "1. Ingest",
    body: "Upload a CSV (or pain.001 XML for outbound) via the Connector Uploads page or the file ingestion endpoint. KOB computes a SHA-256 hash and rejects exact duplicates immediately to prevent double-posting.",
    statuses: ["queued", "duplicate_rejected"],
  },
  {
    id: "review",
    Icon: FileSearch,
    title: "2. Review",
    body: "The validation worker checks headers against the canonical schema, validates each row (date format, amount precision, currency, dedupe key), and produces a per-row report. Operators triage partial failures from the Connector Status dashboard.",
    statuses: ["validating", "partially_accepted", "accepted"],
  },
  {
    id: "reupload",
    Icon: RotateCcw,
    title: "3. Re-upload",
    body: "Download the error CSV, fix the offending rows in your source system, and re-upload. Already-accepted rows are skipped on the dedupe key — only the corrected rows enter the queue, so re-uploads are safe to repeat.",
    statuses: ["accepted", "ingested"],
  },
  {
    id: "reconcile",
    Icon: GitCompare,
    title: "4. Reconcile",
    body: "For outbound batches (pain.001), upload the bank's status file. KOB matches each instruction by reference, marks settled items, opens an exception for unmatched items, and emits dispute / settlement webhooks where applicable.",
    statuses: ["reconciled", "reconciliation_partial"],
  },
];

export default function BankConnectorRunbook() {
  return (
    <>
      <Helmet>
        <title>Bank Connector Runbook | Kang Open Banking</title>
        <meta
          name="description"
          content="Public operational runbook for the Kang Open Banking file-based bank connector — ingest, review, re-upload, reconcile. Lists every operational status and the action that resolves it."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/connectors/bank-connector-runbook" />
      </Helmet>

      <div className="max-w-5xl mx-auto p-6 space-y-10">
        <header className="space-y-3">
          <Badge variant="outline">Operational Runbook</Badge>
          <h1 className="text-3xl font-bold">Bank Connector Runbook</h1>
          <p className="text-muted-foreground">
            A single page that walks an integrating bank from "we have CSV exports" to
            "we are reconciled with KOB every business day". Covers the four operational
            phases, every status code your dashboards will display, and the exact action
            that resolves each status.
          </p>
        </header>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Who this is for</CardTitle>
            <CardDescription>
              CEMAC banks integrating via the file-based connector kit (CSV / pain.001).
              For real-time API-based connectors see the <Link to="/developer/connectors/bank-adapter-framework" className="text-primary underline">Bank Adapter Framework</Link>.
              For the schema reference, see the <Link to="/developer/connectors/byo-mobile-money" className="text-primary underline">Connector Contract</Link> docs.
            </CardDescription>
          </CardHeader>
        </Card>

        <section className="grid md:grid-cols-2 gap-4">
          {PHASES.map((p) => {
            const Icon = p.Icon;
            return (
              <Card key={p.id} id={p.id} className="scroll-mt-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-5 w-5 text-primary" /> {p.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{p.body}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.statuses.map((s) => (
                      <a key={s} href={`#status-${s}`}>
                        <Badge variant="outline" className="font-mono text-[11px] hover:bg-primary/10">{s}</Badge>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Operational status codes
          </h2>
          <p className="text-sm text-muted-foreground">
            Every file the connector processes carries one of these statuses. Both the
            Institution Portal dashboard and the <code>connector-file-status</code> webhook
            event use the same vocabulary.
          </p>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Meaning</th>
                  <th className="p-3 font-medium">Resolution</th>
                </tr>
              </thead>
              <tbody>
                {STATUSES.map((s) => (
                  <tr key={s.code} id={`status-${s.code}`} className="border-t border-border align-top scroll-mt-24">
                    <td className="p-3 font-mono text-xs whitespace-nowrap">
                      <a href={`#status-${s.code}`} className="text-primary hover:underline">{s.code}</a>
                    </td>
                    <td className="p-3 text-muted-foreground">{s.meaning}</td>
                    <td className="p-3 text-muted-foreground">
                      {RESOLUTIONS[s.code]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Reference: ingest a transactions CSV</h2>
          <CodeBlock
            examples={[
              {
                language: "bash",
                label: "cURL — file upload",
                code: `# Upload a transactions CSV to the connector ingest endpoint.
# The institution must already be approved and have an active mTLS cert.
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/bank-connector-file-ingest \\
  -H "Authorization: Bearer $INSTITUTION_TOKEN" \\
  -H "X-File-Type: transactions" \\
  -H "X-Correlation-ID: $(uuidgen)" \\
  -F "file=@./transactions-2026-04-30.csv"`,
              },
              {
                language: "bash",
                label: "cURL — poll status",
                code: `curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/bank-connector-file-status?file_id=$FILE_ID \\
  -H "Authorization: Bearer $INSTITUTION_TOKEN"

# 200 OK
# {
#   "id": "file_01HX...",
#   "file_type": "transactions",
#   "sha256": "9c8b...",
#   "status": "partially_accepted",
#   "rows_total": 1248,
#   "rows_accepted": 1240,
#   "rows_failed": 8,
#   "error_report_url": "https://...&download=errors.csv",
#   "created_at": "2026-04-30T08:01:22Z",
#   "updated_at": "2026-04-30T08:01:31Z"
# }`,
              },
            ]}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Daily operating rhythm
          </h2>
          <ol className="list-decimal pl-6 space-y-2 text-sm text-muted-foreground">
            <li><strong className="text-foreground">07:00 local</strong> — bank exports prior-day balances, transactions, and beneficiaries from core banking; uploads to KOB.</li>
            <li><strong className="text-foreground">07:15</strong> — Connector Status dashboard shows <code>accepted</code> for clean files; operator triages any <code>partially_accepted</code> within 1 hour.</li>
            <li><strong className="text-foreground">All day</strong> — KOB pushes outbound payment instructions (pain.001 batches). Bank executes and produces a status file.</li>
            <li><strong className="text-foreground">17:30</strong> — bank uploads outbound status file. Reconciliation dashboard shows <code>reconciled</code> or <code>reconciliation_partial</code>.</li>
            <li><strong className="text-foreground">18:00</strong> — exceptions older than 24 h are auto-escalated to the on-call operator and emit a <code>connector.reconciliation.exception</code> webhook.</li>
          </ol>
        </section>

        <section className="space-y-3 text-sm text-muted-foreground">
          <h2 className="text-xl font-bold text-foreground">Related</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><Link to="/developer/connectors/bank-onboarding-flow" className="text-primary underline">Bank onboarding flow</Link></li>
            <li><Link to="/developer/connectors/cemac-bank-integration" className="text-primary underline">CEMAC bank integration guide</Link></li>
            <li><Link to="/developer/api-reference/errors" className="text-primary underline">Error catalog (CERT_*, FLW_*, GEN_*)</Link></li>
            <li><Link to="/developer/compliance/fapi" className="text-primary underline">FAPI 1.0 Advanced conformance statement</Link></li>
            <li><Link to="/developer/authentication/mtls" className="text-primary underline">mTLS certificate lifecycle</Link></li>
          </ul>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}

const RESOLUTIONS: Record<string, string> = {
  queued: "No action — wait for the validator (typically < 30 s).",
  validating: "No action — in progress.",
  duplicate_rejected: "Either you re-uploaded the same file (safe — no action), or your source system regenerated identical content. Check before forcing a re-upload.",
  partially_accepted: "Download the error CSV, fix the listed rows in your source system, and re-upload only the fixed rows. Accepted rows are skipped on the dedupe key.",
  accepted: "No action — ingestion will proceed automatically.",
  ingested: "Rows are now visible via the AISP endpoints and reflected in dashboards.",
  reconciled: "No action — outbound batch fully matched.",
  reconciliation_partial: "Open the reconciliation dashboard, inspect unmatched references, and either (a) request the bank re-send the status row, or (b) mark the instruction as failed via the operator action.",
  failed: "Check the error_id in the file detail. If mTLS-related, regenerate and re-register your certificate (see CERT_001 / CERT_002).",
};
