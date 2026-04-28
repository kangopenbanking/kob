import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Copy, CheckCircle, Terminal, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface MockResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: object;
  latency: number;
}

const ENDPOINTS = [
  {
    id: "create-charge",
    label: "Create Charge",
    method: "POST",
    path: "/v1/gateway/charges",
    description: "Create a mobile money charge",
    request: {
      merchant_id: "merch_test_001",
      amount: 5000,
      currency: "XAF",
      channel: "mobile_money",
      customer_phone: "+237650000000",
      tx_ref: "try_it_now_001",
    },
    response: {
      status: 201,
      statusText: "Created",
      body: {
        data: {
          id: "ch_" + "a1b2c3d4e5f6",
          merchant_id: "merch_test_001",
          amount: 5000,
          currency: "XAF",
          channel: "mobile_money",
          status: "successful",
          customer_phone: "+237650000000",
          tx_ref: "try_it_now_001",
          provider: "mtn_momo",
          created_at: new Date().toISOString(),
        },
        meta: { request_id: "req_try_001", timestamp: new Date().toISOString(), api_version: "4.7.0" },
      },
    },
  },
  {
    id: "list-accounts",
    label: "List Accounts",
    method: "GET",
    path: "/v1/aisp/accounts",
    description: "Retrieve aggregated bank accounts",
    request: null,
    response: {
      status: 200,
      statusText: "OK",
      body: {
        data: [
          { account_id: "ACC-001", account_holder_name: "Jean Kamga", currency: "XAF", account_type: "personal", balance: "2500000" },
          { account_id: "ACC-002", account_holder_name: "Jean Kamga", currency: "XAF", account_type: "savings", balance: "8750000" },
        ],
        meta: { request_id: "req_try_002", timestamp: new Date().toISOString(), api_version: "4.7.0", total_count: 2 },
      },
    },
  },
  {
    id: "get-exchange-rate",
    label: "Exchange Rates",
    method: "GET",
    path: "/v1/exchange-rates?base=XAF&target=EUR",
    description: "Get live XAF to EUR rate",
    request: null,
    response: {
      status: 200,
      statusText: "OK",
      body: {
        data: { base: "XAF", target: "EUR", rate: "0.001524", inverse_rate: "656.17", source: "BEAC", updated_at: new Date().toISOString() },
        meta: { request_id: "req_try_003", timestamp: new Date().toISOString(), api_version: "4.7.0" },
      },
    },
  },
  {
    id: "create-payout",
    label: "Create Payout",
    method: "POST",
    path: "/v1/gateway/payouts",
    description: "Send money to a mobile wallet",
    request: {
      merchant_id: "merch_test_001",
      amount: 10000,
      currency: "XAF",
      channel: "mobile_money",
      recipient_phone: "+237670000000",
      narration: "Salary payout",
    },
    response: {
      status: 201,
      statusText: "Created",
      body: {
        data: {
          id: "po_x1y2z3w4",
          merchant_id: "merch_test_001",
          amount: 10000,
          currency: "XAF",
          status: "processing",
          recipient_phone: "+237670000000",
          narration: "Salary payout",
          estimated_arrival: new Date(Date.now() + 60000).toISOString(),
        },
        meta: { request_id: "req_try_004", timestamp: new Date().toISOString(), api_version: "4.7.0" },
      },
    },
  },
  {
    id: "verify-charge",
    label: "Verify Charge",
    method: "GET",
    path: "/v1/gateway/charges/ch_a1b2c3d4e5f6",
    description: "Verify a charge status",
    request: null,
    response: {
      status: 200,
      statusText: "OK",
      body: {
        data: {
          id: "ch_a1b2c3d4e5f6",
          status: "successful",
          amount: 5000,
          currency: "XAF",
          channel: "mobile_money",
          settled: true,
          settlement_id: "stl_m1n2o3",
        },
        meta: { request_id: "req_try_005", timestamp: new Date().toISOString(), api_version: "4.7.0" },
      },
    },
  },
];

const statusColor = (code: number) => {
  if (code < 300) return "text-green-400";
  if (code < 400) return "text-yellow-400";
  return "text-red-400";
};

export function TryItNowPlayground() {
  const [selected, setSelected] = useState(ENDPOINTS[0].id);
  const [result, setResult] = useState<MockResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const endpoint = ENDPOINTS.find(e => e.id === selected)!;

  const execute = useCallback(() => {
    setLoading(true);
    setResult(null);
    const latency = 80 + Math.random() * 120;
    setTimeout(() => {
      setResult({
        status: endpoint.response.status,
        statusText: endpoint.response.statusText,
        headers: {
          "content-type": "application/json",
          "x-request-id": `req_${Math.random().toString(36).slice(2, 14)}`,
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "58",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60),
          "cache-control": endpoint.method === "GET" ? "private, max-age=60" : "no-store",
        },
        body: endpoint.response.body,
        latency: Math.round(latency),
      });
      setLoading(false);
    }, latency);
  }, [endpoint]);

  const curlCommand = endpoint.method === "POST"
    ? `curl -X POST https://api.kangopenbanking.com/v1${endpoint.path} \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '${JSON.stringify(endpoint.request, null, 2)}'`
    : `curl https://api.kangopenbanking.com/v1${endpoint.path} \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo"`;

  const copyResponse = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result.body, null, 2));
      setCopied(true);
      toast.success("Response copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/50">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Try It Now</CardTitle>
            <CardDescription>Execute API calls against the sandbox -- no keys required</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Endpoint selector */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENDPOINTS.map(ep => (
                <SelectItem key={ep.id} value={ep.id}>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 ${ep.method === "POST" ? "text-yellow-500 border-yellow-500/30" : "text-green-500 border-green-500/30"}`}>
                      {ep.method}
                    </Badge>
                    {ep.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={execute} disabled={loading} className="shrink-0">
            <Play className={`h-4 w-4 mr-1.5 ${loading ? "animate-pulse" : ""}`} />
            {loading ? "Sending..." : "Send Request"}
          </Button>
        </div>

        {/* Request preview */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs font-mono ${endpoint.method === "POST" ? "text-yellow-500 border-yellow-500/30" : "text-green-500 border-green-500/30"}`}>
                {endpoint.method}
              </Badge>
              <code className="text-xs text-muted-foreground font-mono">{endpoint.path}</code>
            </div>
            <span className="text-xs text-muted-foreground">{endpoint.description}</span>
          </div>
          {endpoint.request && (
            <div className="p-4 bg-muted/10">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">Request Body</p>
              <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre">
                {JSON.stringify(endpoint.request, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* cURL command */}
        <div className="rounded-lg border border-border bg-muted/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">cURL</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(curlCommand);
                toast.success("cURL command copied");
              }}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
          </div>
          <pre className="text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre">
            {curlCommand}
          </pre>
        </div>

        {/* Response */}
        {result && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-mono font-bold ${statusColor(result.status)}`}>
                  {result.status} {result.statusText}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {result.latency}ms
                </span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={copyResponse}>
                {copied ? <CheckCircle className="h-3 w-3 mr-1 text-primary" /> : <Copy className="h-3 w-3 mr-1" />}
                <span className="text-xs">Copy</span>
              </Button>
            </div>
            {/* Response headers */}
            <div className="px-4 py-2 border-b border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Response Headers</p>
              <div className="text-xs font-mono text-muted-foreground space-y-0.5">
                {Object.entries(result.headers).map(([k, v]) => (
                  <div key={k}><span className="text-foreground/70">{k}:</span> {v}</div>
                ))}
              </div>
            </div>
            {/* Response body */}
            <div className="p-4 bg-muted/10">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Response Body</p>
              <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre max-h-[400px] overflow-y-auto">
                {JSON.stringify(result.body, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
