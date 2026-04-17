import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, FileText, Globe, Layers } from "lucide-react";

export default function BankAdapterFramework() {
  return (
    <div className="container mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-3">
        <Badge variant="outline">Bank Connectors</Badge>
        <h1 className="text-3xl font-bold tracking-tight">Bank Adapter Framework</h1>
        <p className="text-muted-foreground">
          A unified contract for connecting any CEMAC bank to KOB — modern, legacy, or file-based.
          One interface, four adapters, zero impact on existing endpoints.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>The Unified BankConnector Interface</CardTitle>
          <CardDescription>Every adapter implements the same contract.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-sm overflow-x-auto"><code>{`interface BankConnector {
  getAccountDetails(ctx, externalAccountId): Promise<BankAccountDetails>
  getBalance(ctx, externalAccountId): Promise<BankBalance>
  getTransactions(ctx, externalAccountId, dateRange): Promise<BankTransaction[]>
  initiateTransfer(ctx, payload): Promise<TransferResult>
  reconcile(ctx, dateRange): Promise<ReconcileResult>
  healthCheck(ctx): Promise<BankHealthResult>
}`}</code></pre>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { icon: Globe, title: "REST Adapter", badge: "Modern", desc: "For banks with REST/JSON APIs. Configurable paths, bearer/basic/API-key auth." },
          { icon: Database, title: "SQL Adapter", badge: "Read-only", desc: "Read from a bank-supplied query gateway. Parameterized only — no raw SQL." },
          { icon: FileText, title: "File Adapter", badge: "Batch", desc: "CSV / pain.001 / MT940 from Supabase Storage. Daily batch ingestion." },
          { icon: Layers, title: "SOAP Adapter", badge: "Legacy", desc: "T24, Flexcube, OBDX cores via WSDL + WS-Security UsernameToken." },
        ].map((a) => (
          <Card key={a.title}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <a.icon className="h-7 w-7 text-primary" />
                <Badge variant="outline">{a.badge}</Badge>
              </div>
              <CardTitle className="mt-2">{a.title}</CardTitle>
              <CardDescription>{a.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calling the Bank Data Router</CardTitle>
          <CardDescription>One endpoint, automatic adapter resolution by priority, full failover.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="node">Node</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl">
              <pre className="rounded-md bg-muted p-4 text-sm overflow-x-auto"><code>{`curl -X POST https://api.kangopenbanking.com/functions/v1/bank-data-router \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "bank_id": "uuid",
    "operation": "get_transactions",
    "external_account_id": "ACC-001",
    "date_range": { "from": "2026-04-01T00:00:00Z", "to": "2026-04-17T00:00:00Z" }
  }'`}</code></pre>
            </TabsContent>
            <TabsContent value="node">
              <pre className="rounded-md bg-muted p-4 text-sm overflow-x-auto"><code>{`const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bank_id, operation: 'get_balance', external_account_id: 'ACC-001'
  })
});
const data = await res.json();`}</code></pre>
            </TabsContent>
            <TabsContent value="python">
              <pre className="rounded-md bg-muted p-4 text-sm overflow-x-auto"><code>{`import requests
r = requests.post(url, headers={'Authorization': f'Bearer {token}'},
  json={'bank_id': bank_id, 'operation': 'health_check'})
print(r.json())`}</code></pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Decision Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left"><th className="pb-2">Adapter</th><th>Best for</th><th>Real-time</th><th>Transfers</th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="py-2 font-medium text-foreground">REST</td><td>Modern banks</td><td>Yes</td><td>Yes</td></tr>
              <tr className="border-b"><td className="py-2 font-medium text-foreground">SQL</td><td>Read replicas</td><td>Near real-time</td><td>No (read-only)</td></tr>
              <tr className="border-b"><td className="py-2 font-medium text-foreground">File</td><td>No-API banks</td><td>Daily batch</td><td>No</td></tr>
              <tr><td className="py-2 font-medium text-foreground">SOAP</td><td>T24/Flexcube</td><td>Yes</td><td>Yes</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
