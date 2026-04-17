import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, RefreshCw, Webhook, ShieldCheck } from "lucide-react";

const curlExample = `# Inspect pending poll rows for one of your charges
curl -X GET "https://wdzkzeahdtxlynetndqw.supabase.co/rest/v1/byo_charge_polls?provider_reference=eq.<REF>" \\
  -H "Authorization: Bearer <YOUR_USER_JWT>" \\
  -H "apikey: <ANON_KEY>"`;

const nodeExample = `// Subscribe to synthetic webhooks fired by the poller
// (delivered through the existing webhook-dispatcher with normal HMAC)
app.post('/webhooks/kob', verifyHmac, (req, res) => {
  const { event_type, event_data } = req.body;
  if (event_data.source === 'byo_poller_synthetic') {
    console.log('Reconciled', event_data.connector_id, event_data.status);
  }
  res.sendStatus(200);
});`;

const pythonExample = `# Webhook receiver — synthetic and direct events use the same contract
@app.post("/webhooks/kob")
def handler(req):
    body = await req.json()
    if body["event_type"] == "charge.completed":
        mark_paid(body["event_data"]["provider_reference"])
    return {"ok": True}`;

export default function PollingAndWebhooks() {
  return (
    <div className="container mx-auto px-4 py-10 space-y-8 max-w-5xl">
      <header className="space-y-3">
        <Badge variant="outline" className="border-primary text-primary">Reliability</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Polling & Synthetic Webhooks</h1>
        <p className="text-muted-foreground max-w-3xl">
          Direct mobile-money rails (MTN MoMo, Orange Money) do not always push final status
          reliably. KOB runs a server-side poller that reconciles every pending BYO charge and
          fires the same webhook events your integration already handles — so you never need
          to write polling code.
        </p>
      </header>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" />How it works</CardTitle>
          <CardDescription>Every pending direct-rail charge is enqueued automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-6 space-y-2">
            <li><strong>Charge initiated</strong> through <code className="text-xs bg-muted px-1 rounded">payment-router-charge</code>. If the connector returns <code>pending</code>, the router writes a row to <code>byo_charge_polls</code>.</li>
            <li><strong>Poller cron</strong> picks due rows every 30 seconds, calls <code>connector.getStatus()</code>, and applies exponential backoff.</li>
            <li><strong>On terminal status</strong> the poller updates <code>gateway_charges</code>, fires <code>charge.completed</code> or <code>charge.failed</code> through your registered webhook endpoint, and records the platform fee.</li>
            <li><strong>On exhaustion</strong> the row is marked <code>expired</code> after 20 attempts (about 30 minutes total).</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Backoff schedule</CardTitle>
          <CardDescription>Deterministic — same for every connector.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attempt</TableHead>
                <TableHead>Delay</TableHead>
                <TableHead>Cumulative time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { a: 1, d: "30 s", c: "30 s" },
                { a: 2, d: "1 min", c: "1 min 30 s" },
                { a: 3, d: "2 min", c: "3 min 30 s" },
                { a: 4, d: "5 min", c: "8 min 30 s" },
                { a: 5, d: "10 min", c: "18 min 30 s" },
                { a: "6 → 20", d: "30 min (cap)", c: "≈ 8 h" },
              ].map((r) => (
                <TableRow key={r.a}><TableCell className="font-mono">{r.a}</TableCell><TableCell>{r.d}</TableCell><TableCell>{r.c}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5 text-primary" />Synthetic webhook contract</CardTitle>
          <CardDescription>Identical envelope as direct provider webhooks — distinguishable via <code>source</code>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">{`{
  "event_type": "charge.completed" | "charge.failed",
  "event_data": {
    "charge_id": "uuid",
    "provider_reference": "string",
    "connector_id": "mtn_momo" | "orange_money" | "soap_bank",
    "status": "successful" | "failed",
    "source": "byo_poller_synthetic"
  }
}`}</pre>
          <p className="text-muted-foreground">
            HMAC signing, retry policy, and replay protection are unchanged from the standard webhook delivery layer.
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {[
          { title: "cURL", body: curlExample },
          { title: "Node.js", body: nodeExample },
          { title: "Python", body: pythonExample },
        ].map((ex) => (
          <Card key={ex.title}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{ex.title}</CardTitle></CardHeader>
            <CardContent><pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">{ex.body}</pre></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Standing Order alignment</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          Additive only — no existing webhook event types renamed (Order 1 — The Lock).
          OpenAPI version 4.11.0 (Order 6 — minor, additive).
        </CardContent>
      </Card>
    </div>
  );
}
