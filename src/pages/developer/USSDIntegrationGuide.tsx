import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Smartphone, Phone, Languages, Zap, ShieldCheck, ListTree } from "lucide-react";

const codeBlock =
  "rounded-md border border-border/40 bg-muted/30 p-4 text-xs font-mono overflow-x-auto";

const callbackPayload = `POST /v1/ussd/sessions
Content-Type: application/json
Accept-Language: fr

{
  "session_id": "AT_abc123",
  "msisdn": "+237671234567",
  "service_code": "*165#",
  "input": "1",
  "network_code": "MTN-CM",
  "aggregator": "africastalking"
}`;

const responsePayload = `200 OK
Content-Type: application/json
Content-Language: fr

{
  "session_id": "AT_abc123",
  "state": "active",
  "current_node": "balance",
  "node_type": "input",
  "prompt": "Entrez votre code PIN à 4 chiffres pour voir le solde:",
  "ussd_response": "CON Entrez votre code PIN à 4 chiffres pour voir le solde:"
}`;

const curlExample = `curl -X POST https://api.kangopenbanking.com/v1/ussd/sessions \\
  -H "Accept-Language: fr" \\
  -H "Content-Type: application/json" \\
  -d '{"session_id":"AT_abc123","msisdn":"+237671234567","service_code":"*165#","input":"1"}'`;

const nodeExample = `import fetch from "node-fetch";

const res = await fetch("https://api.kangopenbanking.com/v1/ussd/sessions", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Accept-Language": "fr" },
  body: JSON.stringify({
    session_id: "AT_abc123",
    msisdn: "+237671234567",
    service_code: "*165#",
    input: "1",
  }),
});
console.log(await res.json());`;

const pythonExample = `import requests

r = requests.post(
    "https://api.kangopenbanking.com/v1/ussd/sessions",
    headers={"Accept-Language": "fr", "Content-Type": "application/json"},
    json={"session_id": "AT_abc123", "msisdn": "+237671234567", "service_code": "*165#", "input": "1"},
)
print(r.json())`;

const states = [
  { state: "active", meaning: "Dialog open; aggregator should prefix response with CON" },
  { state: "completed", meaning: "Terminal node reached; aggregator prefixes with END" },
  { state: "expired", meaning: "No input for 180s (GSMA TTL); session auto-closed" },
  { state: "aborted", meaning: "Manually terminated via DELETE /v1/ussd/sessions/{id}" },
];

export default function USSDIntegrationGuide() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">USSD Session Engine</h1>
          <Badge variant="outline">v4.45.0</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">
          Reach every CEMAC subscriber, including feature-phone users without internet, through a
          standards-compliant USSD dialog engine. Aggregator-agnostic, bilingual (EN/FR), and
          standards-cited (3GPP TS 22.090, GSMA USSD Service Guidelines v1.1).
        </p>
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Why USSD
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Smartphone penetration in CEMAC averages 38 percent. USSD reaches the remaining 62
            percent on any GSM handset, with no app install and no data plan. It is the dominant
            channel for balance checks, P2P transfers, and bill payments across Cameroon, Chad,
            Gabon, Central African Republic, Republic of the Congo, and Equatorial Guinea.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Endpoints
          </CardTitle>
          <CardDescription>All endpoints accept Accept-Language: en or fr.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Method</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Path</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/20">
                  <td className="px-3 py-2 font-mono">POST</td>
                  <td className="px-3 py-2 font-mono">/v1/ussd/sessions</td>
                  <td className="px-3 py-2">Create or step a session (aggregator callback)</td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="px-3 py-2 font-mono">GET</td>
                  <td className="px-3 py-2 font-mono">/v1/ussd/sessions/{"{sessionId}"}</td>
                  <td className="px-3 py-2">Inspect session state and input history</td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="px-3 py-2 font-mono">DELETE</td>
                  <td className="px-3 py-2 font-mono">/v1/ussd/sessions/{"{sessionId}"}</td>
                  <td className="px-3 py-2">Abort an active session</td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="px-3 py-2 font-mono">GET</td>
                  <td className="px-3 py-2 font-mono">/v1/ussd/menu</td>
                  <td className="px-3 py-2">List the bilingual menu tree for a shortcode</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Callback Contract
          </CardTitle>
          <CardDescription>
            Africa's Talking-compatible. Hubtel and Beem aggregators map the same fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Request from aggregator</p>
            <pre className={codeBlock}>{callbackPayload}</pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Response back to subscriber</p>
            <pre className={codeBlock}>{responsePayload}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            The <code>ussd_response</code> field begins with <code>CON</code> while the dialog
            stays open and switches to <code>END</code> on a terminal node. This matches the
            Africa's Talking convention, so existing telco integrations work without a translator.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTree className="h-5 w-5 text-primary" />
            Session States
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">State</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {states.map((s) => (
                  <tr key={s.state} className="border-b border-border/20">
                    <td className="px-3 py-2 font-mono">{s.state}</td>
                    <td className="px-3 py-2">{s.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            Code Examples
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">cURL</p>
            <pre className={codeBlock}>{curlExample}</pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Node.js</p>
            <pre className={codeBlock}>{nodeExample}</pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Python</p>
            <pre className={codeBlock}>{pythonExample}</pre>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Compliance and Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            MSISDN must be E.164 (8-15 digits, optional leading +). Sessions auto-expire 180
            seconds after the last subscriber input per GSMA USSD Service Guidelines v1.1. Every
            inbound callback is persisted (raw payload, response text, latency, aggregator) for
            audit and dispute resolution.
          </p>
          <p>
            Row-level security restricts session reads to admins and the owning subscriber.
            Aggregators authenticate via the standard API key flow; mTLS is available on the
            Enterprise tier.
          </p>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
