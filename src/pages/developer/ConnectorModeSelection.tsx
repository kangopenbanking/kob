// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P6)
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MODES = [
  { id: "connector_push", best: "Modern systems with outbound webhooks",   latency: "< 1s",  effort: "Low",    bidi: "Yes" },
  { id: "connector_pull", best: "REST or SOAP APIs you control",           latency: "1–5s",  effort: "Medium", bidi: "Yes" },
  { id: "db_connector",   best: "Legacy systems with direct DB access",    latency: "1–10s", effort: "Medium", bidi: "Read-mostly" },
  { id: "file_feed",      best: "End-of-day batch (CSV / SFTP)",           latency: "Hours", effort: "Low",    bidi: "No" },
  { id: "mq_realtime",    best: "Kafka / RabbitMQ / IBM MQ",               latency: "< 1s",  effort: "High",   bidi: "Yes" },
  { id: "hybrid",         best: "Multi-system environments",               latency: "Mixed", effort: "High",   bidi: "Yes" },
];

export default function ConnectorModeSelection() {
  return (
    <div className="container max-w-5xl py-10 space-y-8">
      <Helmet>
        <title>Connector Mode Selection — Kang Open Banking</title>
        <meta name="description" content="Choose the right bank connector mode: connector_push, connector_pull, db_connector, file_feed, mq_realtime, or hybrid." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/connectors/mode-selection" />
      </Helmet>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Connector Mode Selection</h1>
        <p className="text-muted-foreground max-w-2xl">
          Pick the integration mode that matches your core banking system. All modes are additive — you can switch later without migration.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Comparison</CardTitle>
          <CardDescription>Side-by-side trade-offs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead>Best for</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Setup</TableHead>
                <TableHead>Bidirectional</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODES.map((m) => (
                <TableRow key={m.id}>
                  <TableCell><Badge variant="outline">{m.id}</Badge></TableCell>
                  <TableCell>{m.best}</TableCell>
                  <TableCell>{m.latency}</TableCell>
                  <TableCell>{m.effort}</TableCell>
                  <TableCell>{m.bidi}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Decision flow</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-muted p-4 rounded-md overflow-auto">{`Can your core push webhooks?     → connector_push
Else, expose REST/SOAP?          → connector_pull
Else, read-only DB available?    → db_connector
Else, CSV at end of day?         → file_feed
Else, message queue?             → mq_realtime
Multiple of the above?           → hybrid`}</pre>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        For deployment, secrets and observability, see the{" "}
        <Link to="/developer/connectors/bank-connector-runbook" className="text-primary underline">Bank Connector Runbook</Link>.
      </p>
    </div>
  );
}
