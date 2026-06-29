// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P6)
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, FileSearch, RotateCcw, GitCompare, ShieldCheck, Activity } from "lucide-react";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { ConnectorSandboxSimulator } from "@/components/developer/ConnectorSandboxSimulator";

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

        <section className="space-y-3" id="simulator">
          <h2 className="text-xl font-bold">Run a sandbox simulation</h2>
          <p className="text-sm text-muted-foreground">
            Walk through the connector pipeline without uploading a real file. Pick a phase, choose a
            fixture, and watch the status timeline render — same vocabulary your live dashboards use.
          </p>
          <ConnectorSandboxSimulator />
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
curl -X POST https://api.kangopenbanking.com/v1/bank-connector-file-ingest \\
  -H "Authorization: Bearer $INSTITUTION_TOKEN" \\
  -H "X-File-Type: transactions" \\
  -H "X-Correlation-ID: $(uuidgen)" \\
  -F "file=@./transactions-2026-04-30.csv"`,
              },
              {
                language: "bash",
                label: "cURL — poll status",
                code: `curl https://api.kangopenbanking.com/v1/bank-connector-file-status?file_id=$FILE_ID \\
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

        <section className="space-y-3" id="mtls">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> mTLS certificate request &amp; rotation
          </h2>
          <p className="text-sm text-muted-foreground">
            Every file ingestion and outbound webhook is mutually authenticated. The bank
            holds a client certificate; KOB pins it on first use and refuses traffic from
            any other certificate against the same <code>institution_id</code>.
          </p>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr className="text-left">
                <th className="p-3 font-medium">Step</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Owner</th>
                <th className="p-3 font-medium">SLA</th>
              </tr></thead>
              <tbody className="[&_td]:p-3 [&_td]:align-top [&_tr]:border-t [&_tr]:border-border text-muted-foreground">
                <tr><td className="font-mono text-xs">1</td><td>Generate a 2048-bit RSA (or P-256 EC) keypair offline. Never email the private key.</td><td>Bank</td><td>—</td></tr>
                <tr><td className="font-mono text-xs">2</td><td>Submit a CSR with CN = your institution short-code, O = legal entity, C = country (ISO-3166).</td><td>Bank</td><td>—</td></tr>
                <tr><td className="font-mono text-xs">3</td><td>Open a Connector Cert request on the Institution Portal &rarr; Connectors &rarr; mTLS. Attach the CSR and a signed declaration of the requesting officer.</td><td>Bank Ops</td><td>—</td></tr>
                <tr><td className="font-mono text-xs">4</td><td>KOB issues a 13-month leaf cert signed by the KOB Connector CA. Returned via the portal — never email.</td><td>KOB CA</td><td>2 business days</td></tr>
                <tr><td className="font-mono text-xs">5</td><td>Install on the egress proxy. Run <code>openssl s_client -connect sandbox-api.kangopenbanking.com:443 -cert leaf.pem -key leaf.key</code> and confirm <code>Verify return code: 0 (ok)</code>.</td><td>Bank Eng</td><td>same day</td></tr>
                <tr><td className="font-mono text-xs">6</td><td>Send 1 test file in sandbox. KOB pins the SHA-256 of the certificate to your institution.</td><td>Bank Eng</td><td>same day</td></tr>
                <tr><td className="font-mono text-xs">R1</td><td>Rotation: 60 days before expiry KOB emits <code>connector.cert.expiring</code> webhook + portal banner. Generate a new CSR and repeat steps 2–6 — both certs are accepted during the overlap window.</td><td>Bank Eng + KOB CA</td><td>start ≥ 30 days before expiry</td></tr>
                <tr><td className="font-mono text-xs">R2</td><td>Emergency revocation: call the 24/7 Connector hotline; KOB revokes within 15 minutes and emits <code>connector.cert.revoked</code>. All in-flight files are quarantined.</td><td>Bank CISO + KOB SOC</td><td>15 min</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Error codes you may see: <code>CERT_001</code> (no cert presented), <code>CERT_002</code> (cert not pinned to institution), <code>CERT_003</code> (cert expired), <code>CERT_004</code> (cert revoked). See the <Link to="/developer/api-reference/errors" className="text-primary underline">error catalog</Link>.
          </p>
        </section>

        <section className="space-y-3" id="sftp">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> SFTP file feed — format &amp; schedule
          </h2>
          <p className="text-sm text-muted-foreground">
            Banks that cannot push over HTTPS may use the SFTP drop-zone. Both transports
            produce identical downstream records; only the delivery channel differs.
          </p>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr className="text-left">
                <th className="p-3 font-medium">Parameter</th>
                <th className="p-3 font-medium">Value</th>
              </tr></thead>
              <tbody className="[&_td]:p-3 [&_tr]:border-t [&_tr]:border-border text-muted-foreground">
                <tr><td>Host (sandbox)</td><td className="font-mono text-xs">sftp-sandbox.kangopenbanking.com:2222</td></tr>
                <tr><td>Host (production)</td><td className="font-mono text-xs">sftp.kangopenbanking.com:2222</td></tr>
                <tr><td>Auth</td><td>SSH ed25519 public key registered on the Institution Portal. Password auth is disabled.</td></tr>
                <tr><td>Inbound directory</td><td className="font-mono text-xs">/inbound/&#123;institution_id&#125;/&#123;file_type&#125;/</td></tr>
                <tr><td>Outbound directory (KOB &rarr; bank)</td><td className="font-mono text-xs">/outbound/&#123;institution_id&#125;/&#123;batch_id&#125;/</td></tr>
                <tr><td>Filename convention</td><td className="font-mono text-xs">&#123;file_type&#125;_&#123;YYYY-MM-DD&#125;_&#123;seq&#125;.csv</td></tr>
                <tr><td>Encoding / line-ending</td><td>UTF-8, LF only. BOM and CRLF are rejected.</td></tr>
                <tr><td>Compression</td><td>Optional <code>.gz</code> suffix; KOB decompresses before SHA-256 hashing.</td></tr>
                <tr><td>Atomic write</td><td>Upload as <code>.part</code> then rename to final name. Polling worker ignores <code>.part</code>.</td></tr>
                <tr><td>File-types accepted</td><td className="font-mono text-xs">balances · transactions · beneficiaries · accounts · pain002_status</td></tr>
                <tr><td>Max file size</td><td>250 MB compressed / 2 GB uncompressed. Split larger feeds by date.</td></tr>
                <tr><td>Retention on SFTP</td><td>7 days after pickup, then auto-purged. Authoritative copy lives in KOB object storage.</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Schedule</strong> — inbound files are polled every 60&nbsp;seconds.
            Outbound pain.001 batches are dropped at <code>03:00</code>, <code>11:00</code>, <code>15:00</code>,
            and <code>19:00</code> local. Banks must produce a pain.002 status file within 4&nbsp;hours of each
            outbound drop; reconciliation gaps older than 24&nbsp;hours auto-escalate.
          </p>
        </section>

        <section className="space-y-3" id="integration-mode">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" /> integration_mode — pick the right contract
          </h2>
          <p className="text-sm text-muted-foreground">
            Every institution carries an <code>integration_mode</code> attribute on its connector
            record. It tells KOB which contract to use for ingest, outbound, and reconciliation.
            Switching modes requires Guardian approval (Standing Order 4 — additive first).
          </p>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr className="text-left">
                <th className="p-3 font-medium">Mode</th>
                <th className="p-3 font-medium">When to choose</th>
                <th className="p-3 font-medium">Inbound</th>
                <th className="p-3 font-medium">Outbound</th>
              </tr></thead>
              <tbody className="[&_td]:p-3 [&_td]:align-top [&_tr]:border-t [&_tr]:border-border text-muted-foreground">
                <tr><td className="font-mono text-xs">file_https</td><td>Bank can push CSV/XML over mTLS HTTPS to <code>/v1/bank-connector-file-ingest</code>.</td><td>HTTPS POST multipart</td><td>HTTPS GET signed URL</td></tr>
                <tr><td className="font-mono text-xs">file_sftp</td><td>Bank can only operate inside its own DMZ; HTTPS egress is restricted.</td><td>SFTP drop-zone</td><td>SFTP drop-zone</td></tr>
                <tr><td className="font-mono text-xs">db_pull</td><td>Bank exposes a read-replica with a service account; KOB pulls deltas on a cron.</td><td>JDBC over VPN/PrivateLink</td><td>Outbound JSON to bank webhook</td></tr>
                <tr><td className="font-mono text-xs">queue_stream</td><td>Bank publishes events to a Kafka / RabbitMQ topic the connector subscribes to.</td><td>Kafka/AMQP</td><td>Kafka/AMQP</td></tr>
                <tr><td className="font-mono text-xs">realtime_api</td><td>Bank exposes a REST adapter implementing the <Link to="/developer/connectors/bank-adapter-framework" className="text-primary underline">Bank Adapter Framework</Link>.</td><td>HTTPS pull on demand</td><td>HTTPS push from KOB</td></tr>
              </tbody>
            </table>
          </div>
          <CodeBlock
            examples={[
              {
                language: "json",
                label: "Connector record — file_https example",
                code: `{
  "institution_id": "inst_01HXBANKKOB",
  "display_name": "Bank of Test, S.A.",
  "integration_mode": "file_https",
  "endpoints": {
    "ingest": "https://api.kangopenbanking.com/v1/bank-connector-file-ingest",
    "status_webhook": "https://bank.example.com/kob/webhooks/connector"
  },
  "mtls": {
    "cert_fingerprint_sha256": "9c8b…",
    "expires_at": "2027-05-31T00:00:00Z"
  },
  "schedule": {
    "inbound_cutoff_local": "07:00",
    "outbound_drops_local": ["03:00","11:00","15:00","19:00"]
  }
}`,
              },
              {
                language: "json",
                label: "Connector record — file_sftp example",
                code: `{
  "institution_id": "inst_01HXBANKSFTP",
  "display_name": "Banque Régionale CEMAC",
  "integration_mode": "file_sftp",
  "sftp": {
    "host": "sftp.kangopenbanking.com",
    "port": 2222,
    "user": "inst_01hxbanksftp",
    "auth": "ssh_ed25519",
    "public_key_fingerprint": "SHA256:8k1…"
  },
  "schedule": {
    "poll_interval_seconds": 60,
    "outbound_drops_local": ["03:00","11:00","15:00","19:00"]
  }
}`,
              },
            ]}
          />
        </section>

        <section className="space-y-3" id="bank-engineering-requirements">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Bank engineering requirements
          </h2>
          <p className="text-sm text-muted-foreground">
            Before sandbox activation the bank's engineering team must confirm each item.
            Use the checklist below as the agenda for the integration kickoff call.
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li><strong className="text-foreground">Network</strong> — egress to <code>*.kangopenbanking.com</code> on 443 (and 2222 for SFTP). Whitelist KOB egress IPs (published on the Institution Portal &rarr; Network) for inbound webhooks.</li>
            <li><strong className="text-foreground">Identity</strong> — at least one named integration officer with a portal account and MFA enabled; at least one CISO contact for certificate revocation.</li>
            <li><strong className="text-foreground">Cryptography</strong> — TLS 1.2+ only, AEAD ciphers (AES-GCM or ChaCha20-Poly1305), HSTS on the bank's webhook endpoint, no SSLv3/TLS 1.0/1.1.</li>
            <li><strong className="text-foreground">Data model</strong> — ability to produce balances, transactions, beneficiaries, accounts, and pain.002 status in the canonical schema (see <Link to="/developer/connectors/byo-mobile-money" className="text-primary underline">Connector Contract</Link>). Stable per-row dedupe key required.</li>
            <li><strong className="text-foreground">Operational</strong> — 24/7 monitoring of the egress proxy and SFTP drop-zone; pager rotation that can act on <code>connector.cert.expiring</code> and <code>connector.reconciliation.exception</code> within 30 minutes.</li>
            <li><strong className="text-foreground">Compliance</strong> — Data Processing Agreement signed; PII classification of any free-text fields submitted; retention policy aligned with COBAC retention requirements.</li>
            <li><strong className="text-foreground">Webhook receiver</strong> — idempotent on KOB <code>event_id</code>, verifies the <code>X-KOB-Signature</code> HMAC, returns 2xx within 5 seconds (or 202 with async processing).</li>
            <li><strong className="text-foreground">Go-live test pack</strong> — successful run of all sandbox simulator phases above, plus one full reconciliation cycle (outbound pain.001 &rarr; pain.002 status &rarr; <code>reconciled</code>).</li>
          </ul>
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
