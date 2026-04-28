import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Network, ListOrdered, History, ShieldCheck } from "lucide-react";

const curlAttempts = `curl -X GET "https://api.kangopenbanking.com/v1/rest/byo_routing_attempts?charge_reference=eq.KOB-2026-0001&order=attempt_index.asc" \\
  -H "Authorization: Bearer <USER_JWT>" \\
  -H "apikey: <ANON_KEY>"`;

const nodeCharge = `// Send a charge — multi-rail failover happens server-side
const { data } = await supabase.functions.invoke("payment-router-charge", {
  body: {
    owner_type: "institution",
    owner_id: institutionId,
    amount: 50000,
    currency: "XAF",
    phone_number: "+237699999999",
    reference: "KOB-2026-0001",
    country: "CM",
    // no \`connector\` field → engine tries all enabled rails by priority
  },
});
console.log(data.connector_used, data.attempts);`;

const pythonCharge = `r = requests.post(
  "https://api.kangopenbanking.com/v1/payment-router-charge",
  headers={"Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
  json={
    "owner_type": "institution", "owner_id": str(inst_id),
    "amount": 50000, "currency": "XAF",
    "phone_number": "+237699999999",
    "reference": "KOB-2026-0001", "country": "CM",
  }).json()
print(r["connector_used"], r["attempts"])`;

export default function MultiRailFailover() {
  return (
    <div className="container mx-auto px-4 py-10 space-y-8 max-w-5xl">
      <header className="space-y-3">
        <Badge variant="outline" className="border-primary text-primary">Routing</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Multi-Rail Cross-Bank Failover</h1>
        <p className="text-muted-foreground max-w-3xl">
          Register multiple BYO connectors with explicit priorities. The router tries each in
          order on every charge — if rail #1 fails, rail #2 is attempted, and so on. The
          KOB-managed Flutterwave rail is always the final fallback when the caller does not
          pin a specific connector.
        </p>
      </header>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5 text-primary" />Priority semantics</CardTitle>
          <CardDescription>Lower number = tried first. Ties broken by <code>created_at</code>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Table>
            <TableHeader><TableRow><TableHead>Priority</TableHead><TableHead>Connector</TableHead><TableHead>Outcome</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell className="font-mono">10</TableCell><TableCell>MTN MoMo (Direct, Live)</TableCell><TableCell>Tried first</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">20</TableCell><TableCell>Orange Money (Direct, Live)</TableCell><TableCell>Tried if MTN fails</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">50</TableCell><TableCell>SOAP Bank (T24 Core)</TableCell><TableCell>Tried if Orange fails</TableCell></TableRow>
              <TableRow><TableCell className="font-mono text-muted-foreground">∞</TableCell><TableCell className="text-muted-foreground">Flutterwave (KOB-managed)</TableCell><TableCell className="text-muted-foreground">Final fallback</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Network className="h-5 w-5 text-primary" />Failure types that advance to the next rail</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm list-disc pl-6 space-y-1">
            <li>Network timeout, DNS error, connection refused</li>
            <li>HTTP 5xx response from the provider</li>
            <li>Connector returns <code>success: false</code> with any <code>error_code</code></li>
            <li>Connector throws an exception (credentials missing, decryption failure)</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            <strong>Not retried:</strong> a successful response with <code>status: "pending"</code> — that's a real charge in flight and will be reconciled by the poller.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Routing attempt trail</CardTitle>
          <CardDescription>Every connector tried per charge is recorded in <code>byo_routing_attempts</code> for debugging.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">{`{
  "charge_reference": "KOB-2026-0001",
  "attempt_index": 1,
  "connector_id": "mtn_momo",
  "success": false,
  "status": "failed",
  "error_code": "MTN_TIMEOUT",
  "error_message": "MTN MoMo: HTTP 504",
  "duration_ms": 8421,
  "attempted_at": "2026-04-17T02:23:31Z"
}`}</pre>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {[
          { title: "cURL — read trail", body: curlAttempts },
          { title: "Node.js — send charge", body: nodeCharge },
          { title: "Python — send charge", body: pythonCharge },
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
          The default <code>mobile-money-charge</code> path is unchanged. Multi-rail failover
          is only active inside <code>payment-router-charge</code> with <code>use_tenant_connectors: true</code>.
          Order 1 (The Lock) preserved. Order 6 — version bumped to 4.11.0 (minor, additive).
        </CardContent>
      </Card>
    </div>
  );
}
