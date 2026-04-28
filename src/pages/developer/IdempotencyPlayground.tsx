import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { KeyRound, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Endpoint = "charges" | "transfers" | "refunds" | "payouts";
type Outcome = "first_call" | "exact_replay" | "conflicting_replay" | "concurrent";

const ENDPOINTS: Record<Endpoint, { method: string; path: string; sample: Record<string, unknown> }> = {
  charges: {
    method: "POST",
    path: "/v1/gateway/charges",
    sample: { merchant_id: "merch_test_001", amount: 5000, currency: "XAF", channel: "mobile_money", customer_phone: "237677123456", tx_ref: "order_001" },
  },
  transfers: {
    method: "POST",
    path: "/v1/transfers",
    sample: { source_account: "acc_src_001", destination_account: "acc_dst_001", amount: 25000, currency: "XAF", reference: "salary_2026_04" },
  },
  refunds: {
    method: "POST",
    path: "/v1/refunds",
    sample: { charge_id: "ch_1A2b3C", amount: 5000, currency: "XAF", reason: "requested_by_customer" },
  },
  payouts: {
    method: "POST",
    path: "/v1/gateway/payouts",
    sample: { merchant_id: "merch_test_001", amount: 100000, currency: "XAF", destination: "acc_dst_001" },
  },
};

const OUTCOMES: Record<Outcome, { status: number; code: string; type: string; title: string; detail: string; behavior: string }> = {
  first_call: { status: 201, code: "OK_CREATED", type: "https://kangopenbanking.com/errors/none", title: "Created", detail: "Resource created and idempotency key recorded for 24h.", behavior: "Server processes the request, persists the response, and links it to the idempotency key." },
  exact_replay: { status: 200, code: "IDEMPOTENT_REPLAY", type: "https://kangopenbanking.com/errors/none", title: "Idempotent replay", detail: "Returning cached response from initial request.", behavior: "Server returns the original response (same status code, same body) and sets X-Idempotent-Replayed: true." },
  conflicting_replay: { status: 422, code: "IDEMPOTENCY_KEY_REUSED", type: "https://kangopenbanking.com/errors/idempotency_key_reused", title: "Idempotency key reused with different payload", detail: "An idempotency key was reused with a request body that does not match the original. Use a new key.", behavior: "Server rejects the request to protect against accidental double-charges." },
  concurrent: { status: 409, code: "IDEMPOTENT_REQUEST_IN_PROGRESS", type: "https://kangopenbanking.com/errors/concurrent_request", title: "Concurrent request in progress", detail: "Another request with this idempotency key is still being processed. Retry after a short backoff.", behavior: "Server holds a row-level lock. Retry with exponential backoff (250ms, 500ms, 1s)." },
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function IdempotencyPlayground() {
  const [endpoint, setEndpoint] = useState<Endpoint>("charges");
  const [outcome, setOutcome] = useState<Outcome>("first_call");
  const [key, setKey] = useState(() => uuid());

  const ep = ENDPOINTS[endpoint];
  const o = OUTCOMES[outcome];

  const curl = useMemo(() => {
    return `curl -X ${ep.method} https://api.kangopenbanking.com${ep.path} \\
  -H "Authorization: Bearer $KOB_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ${key}" \\
  -d '${JSON.stringify(ep.sample)}'`;
  }, [ep, key]);

  const responseEnvelope = useMemo(() => {
    if (outcome === "first_call") {
      return JSON.stringify({ id: `${endpoint.slice(0, 2)}_${uuid().slice(0, 8)}`, status: "pending", ...ep.sample, created: Math.floor(Date.now() / 1000) }, null, 2);
    }
    if (outcome === "exact_replay") {
      return JSON.stringify({ id: `${endpoint.slice(0, 2)}_replayed_001`, status: "pending", ...ep.sample, created: Math.floor(Date.now() / 1000) - 60, idempotent_replayed: true }, null, 2);
    }
    return JSON.stringify({
      error: { type: o.type, title: o.title, status: o.status, code: o.code, detail: o.detail, instance: `urn:kob:request:${uuid()}` },
    }, null, 2);
  }, [outcome, endpoint, ep, o]);

  const responseHeaders = useMemo(() => {
    const base: Record<string, string> = { "Content-Type": "application/json", "X-Request-ID": `req_${uuid().slice(0, 12)}` };
    if (outcome === "exact_replay") base["X-Idempotent-Replayed"] = "true";
    if (outcome === "concurrent") base["Retry-After"] = "1";
    return base;
  }, [outcome]);

  return (
    <>
      <Helmet>
        <title>Idempotency Key Playground — Kang Open Banking</title>
        <meta name="description" content="See exactly how duplicate charges, transfers, refunds, and payouts behave with idempotency keys, and view the documented error envelope for each scenario." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/idempotency-playground" />
      </Helmet>

      <div className="max-w-5xl mx-auto p-6 space-y-6" data-testid="idempotency-playground-page">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <KeyRound className="h-7 w-7" /> Idempotency Key Playground
          </h1>
          <p className="text-muted-foreground mt-2">
            Explore how duplicate requests behave across the gateway. Pick an endpoint and a scenario to see the documented response envelope, status code, and headers.
          </p>
        </div>

        <Alert>
          <AlertTitle>How idempotency works</AlertTitle>
          <AlertDescription>
            Provide a unique <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Idempotency-Key</code> header (UUID v4 recommended). The server caches the response for 24 hours so safe retries return the same result. Reusing a key with a different payload is rejected.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure scenario</CardTitle>
            <CardDescription>Pick an endpoint and a duplicate-call scenario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Endpoint</Label>
                <Select value={endpoint} onValueChange={(v) => setEndpoint(v as Endpoint)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charges">POST /v1/gateway/charges</SelectItem>
                    <SelectItem value="transfers">POST /v1/transfers</SelectItem>
                    <SelectItem value="refunds">POST /v1/refunds</SelectItem>
                    <SelectItem value="payouts">POST /v1/gateway/payouts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scenario</Label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v as Outcome)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_call">First call (new key)</SelectItem>
                    <SelectItem value="exact_replay">Exact replay (same key + body)</SelectItem>
                    <SelectItem value="conflicting_replay">Conflicting replay (same key, different body)</SelectItem>
                    <SelectItem value="concurrent">Concurrent in-flight request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Idempotency-Key</Label>
              <div className="flex gap-2">
                <Input value={key} onChange={(e) => setKey(e.target.value)} className="font-mono text-xs" />
                <Button variant="outline" onClick={() => { setKey(uuid()); toast.success("New key generated"); }}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">UUID v4 recommended. Maximum 255 characters. Stored for 24 hours.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock examples={[{ language: "bash", label: "cURL", code: curl }]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {outcome === "first_call" || outcome === "exact_replay" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
              Documented response
              <Badge variant={o.status < 400 ? "default" : "destructive"} className="ml-2">HTTP {o.status}</Badge>
              <Badge variant="outline" className="font-mono">{o.code}</Badge>
            </CardTitle>
            <CardDescription>{o.behavior}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Response headers</Label>
              <pre className="text-xs bg-muted/30 border border-border rounded-md p-3 overflow-auto font-mono mt-1">{JSON.stringify(responseHeaders, null, 2)}</pre>
            </div>
            <div>
              <Label className="text-xs">Response body</Label>
              <pre className="text-xs bg-muted/30 border border-border rounded-md p-3 overflow-auto font-mono mt-1">{responseEnvelope}</pre>
            </div>
            <p className="text-xs text-muted-foreground">
              See the <a href="/developer/guides/idempotency" className="underline">Idempotency Guide</a> and full <a href="/developer/errors" className="underline">Error Catalog</a> for the complete contract.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
