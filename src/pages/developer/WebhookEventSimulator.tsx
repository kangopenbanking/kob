import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Webhook, AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";

type Variant = "fresh" | "stale_timestamp" | "duplicate_id" | "invalid_signature";

interface EventDef {
  type: string;
  description: string;
  sampleData: Record<string, unknown>;
}

const EVENTS: EventDef[] = [
  {
    type: "charge.succeeded",
    description: "Fired when a charge transitions to succeeded.",
    sampleData: { id: "ch_1A2b3C", amount: 5000, currency: "XAF", status: "succeeded", channel: "mobile_money" },
  },
  {
    type: "charge.failed",
    description: "Fired when a charge fails permanently.",
    sampleData: { id: "ch_4D5e6F", amount: 5000, currency: "XAF", status: "failed", failure_code: "insufficient_funds" },
  },
  {
    type: "transfer.completed",
    description: "Fired when a transfer settles.",
    sampleData: { id: "tr_7G8h9I", amount: 25000, currency: "XAF", status: "completed" },
  },
  {
    type: "refund.created",
    description: "Fired when a refund is created.",
    sampleData: { id: "rf_J1k2L3", charge_id: "ch_1A2b3C", amount: 5000, currency: "XAF", status: "pending" },
  },
  {
    type: "payout.paid",
    description: "Fired when a payout reaches the destination.",
    sampleData: { id: "po_M4n5O6", amount: 100000, currency: "XAF", status: "paid" },
  },
];

const ERROR_CATALOG: Record<Variant, { code: string; status: number; type: string; title: string; guidance: string }> = {
  fresh: { code: "OK_000", status: 200, type: "https://kangopenbanking.com/errors/none", title: "Accepted", guidance: "Respond with HTTP 200 within 10s. We'll mark the delivery as successful." },
  stale_timestamp: { code: "WH_005", status: 401, type: "https://kangopenbanking.com/errors/stale_timestamp", title: "Webhook timestamp outside tolerance window", guidance: "Reject events older than 300s. Re-sync your server clock with NTP." },
  duplicate_id: { code: "WH_004", status: 409, type: "https://kangopenbanking.com/errors/duplicate_webhook", title: "Duplicate webhook ID", guidance: "Already-processed event. Return 200 to stop retries (idempotent receiver pattern)." },
  invalid_signature: { code: "WH_002", status: 401, type: "https://kangopenbanking.com/errors/invalid_signature", title: "Webhook signature verification failed", guidance: "Recompute HMAC-SHA256 over `${timestamp}.${rawBody}` using your endpoint secret. Compare with X-KOB-Signature in constant time." },
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function WebhookEventSimulator() {
  const [eventType, setEventType] = useState(EVENTS[0].type);
  const [variant, setVariant] = useState<Variant>("fresh");
  const [pretty, setPretty] = useState(true);

  const event = useMemo(() => EVENTS.find((e) => e.type === eventType)!, [eventType]);
  const error = ERROR_CATALOG[variant];

  const { headers, body } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const ts = variant === "stale_timestamp" ? now - 1800 : now;
    const id = variant === "duplicate_id" ? "evt_duplicate_demo_001" : `evt_${uuid()}`;
    const sig = variant === "invalid_signature" ? "t=" + ts + ",v1=DELIBERATELY_INVALID_SIG" : "t=" + ts + ",v1=<hmac_sha256_of_timestamp.body>";
    const payload = {
      id,
      type: event.type,
      created: ts,
      api_version: "2026-04-28",
      livemode: false,
      data: { object: event.sampleData },
    };
    return {
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-ID": id,
        "X-KOB-Signature": sig,
        "X-KOB-Timestamp": String(ts),
        "User-Agent": "Kang-OB-Webhooks/1.0",
      },
      body: pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload),
    };
  }, [event, variant, pretty]);

  const errorEnvelope = JSON.stringify({
    error: {
      type: error.type,
      title: error.title,
      status: error.status,
      code: error.code,
      detail: error.guidance,
      instance: `urn:kob:webhook:delivery:${uuid()}`,
    },
  }, null, 2);

  const copy = (s: string, label: string) => {
    navigator.clipboard.writeText(s);
    toast.success(`${label} copied`);
  };

  return (
    <>
      <Helmet>
        <title>Webhook Event Simulator — Kang Open Banking</title>
        <meta name="description" content="Generate any documented webhook payload variant — fresh, stale timestamp, duplicate ID, or invalid signature — and instantly see the matching error catalog entry." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/webhook-simulator" />
      </Helmet>

      <div className="max-w-5xl mx-auto p-6 space-y-6" data-testid="webhook-simulator-page">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Webhook className="h-7 w-7" /> Webhook Event Simulator
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate any OpenAPI-described webhook payload, switch between variants — including stale timestamps and duplicate IDs — and see the documented error catalog entry your endpoint should produce.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure event</CardTitle>
            <CardDescription>Choose an event type and a delivery variant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event type</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENTS.map((e) => <SelectItem key={e.type} value={e.type}>{e.type}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{event.description}</p>
              </div>
              <div className="space-y-2">
                <Label>Variant</Label>
                <Select value={variant} onValueChange={(v) => setVariant(v as Variant)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fresh">Fresh delivery (valid)</SelectItem>
                    <SelectItem value="stale_timestamp">Stale timestamp (&gt; 300s)</SelectItem>
                    <SelectItem value="duplicate_id">Duplicate X-Webhook-ID</SelectItem>
                    <SelectItem value="invalid_signature">Invalid signature</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={pretty} onCheckedChange={setPretty} id="pretty" />
              <Label htmlFor="pretty" className="text-sm">Pretty-print JSON</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated request</CardTitle>
            <CardDescription>Headers your endpoint will receive, plus the JSON body.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Headers</Label>
                <Button variant="ghost" size="sm" onClick={() => copy(JSON.stringify(headers, null, 2), "Headers")}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</Button>
              </div>
              <pre className="text-xs bg-muted/30 border border-border rounded-md p-3 overflow-auto font-mono">{JSON.stringify(headers, null, 2)}</pre>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Body</Label>
                <Button variant="ghost" size="sm" onClick={() => copy(body, "Body")}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</Button>
              </div>
              <pre className="text-xs bg-muted/30 border border-border rounded-md p-3 overflow-auto font-mono">{body}</pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {variant === "fresh" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
              Expected response
              <Badge variant={variant === "fresh" ? "default" : "destructive"} className="ml-2">HTTP {error.status}</Badge>
              <Badge variant="outline" className="font-mono">{error.code}</Badge>
            </CardTitle>
            <CardDescription>{error.guidance}</CardDescription>
          </CardHeader>
          <CardContent>
            {variant === "fresh" ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Acknowledge with 2xx</AlertTitle>
                <AlertDescription>Return any 2xx response within 10 seconds. Body content is ignored.</AlertDescription>
              </Alert>
            ) : (
              <CodeBlock examples={[{ language: "json", label: "Error envelope (RFC 7807)", code: errorEnvelope }]} />
            )}
            <p className="text-xs text-muted-foreground mt-3">
              See the full <a className="underline" href="/developer/errors">Error Catalog</a> for every documented code.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
