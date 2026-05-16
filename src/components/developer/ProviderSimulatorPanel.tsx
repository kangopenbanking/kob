import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, ArrowRight } from "lucide-react";

type Provider = "stripe" | "flutterwave" | "paypal";
type Scenario = "success" | "declined" | "timeout" | "dispute_opened" | "refund";

// Resolve backend at runtime via env var (Direct Backend Mandate); keeps
// the developer-portal source free of hard-coded *.supabase.co hosts.
const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "success", label: "Successful payment" },
  { value: "declined", label: "Declined" },
  { value: "timeout", label: "Provider timeout" },
  { value: "dispute_opened", label: "Dispute opened" },
  { value: "refund", label: "Refund" },
];

const STEPS = [
  "Build provider payload",
  "Sign with provider secret",
  "Receiver verifies signature",
  "Inbox row + charge updated",
  "Outbound webhook delivered",
];

export function ProviderSimulatorPanel() {
  const [provider, setProvider] = useState<Provider>("stripe");
  const [scenario, setScenario] = useState<Scenario>("success");
  const [amount, setAmount] = useState("5000");
  const [currency, setCurrency] = useState("XAF");
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    setActiveStep(0);
    try {
      // step 1+2 happen server-side; advance UI optimistically
      await new Promise((r) => setTimeout(r, 200));
      setActiveStep(1);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-sandbox': 'true',
      };
      if (ANON_KEY) {
        headers['apikey'] = ANON_KEY;
        headers['Authorization'] = `Bearer ${ANON_KEY}`;
      }
      const res = await fetch(`${FN_BASE}/sandbox-provider-simulator/${provider}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ scenario, amount: Number(amount), currency }),
      });
      setActiveStep(2);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!res.ok) throw new Error(data?.error ?? data?.detail ?? `simulation_failed (HTTP ${res.status})`);
      setActiveStep(3);
      await new Promise((r) => setTimeout(r, 200));
      setActiveStep(4);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed.");
      setActiveStep(-1);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Per-provider end-to-end simulator</CardTitle>
        <CardDescription>
          Mints a realistic provider event, signs it with the matching webhook secret, and forwards it
          into the canonical Kang receiver. Use this to verify your integration against the same code path
          a live Stripe / Flutterwave / PayPal event would take.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={provider} onValueChange={(v) => setProvider(v as Provider)}>
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="stripe">Stripe</TabsTrigger>
            <TabsTrigger value="flutterwave">Flutterwave</TabsTrigger>
            <TabsTrigger value="paypal">PayPal</TabsTrigger>
          </TabsList>
          {(["stripe", "flutterwave", "paypal"] as Provider[]).map((p) => (
            <TabsContent key={p} value={p} className="pt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Scenario</label>
                  <Select value={scenario} onValueChange={(v) => setScenario(v as Scenario)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCENARIOS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Amount (minor units)</label>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Currency</label>
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                </div>
                <div className="flex items-end">
                  <Button onClick={run} disabled={running} className="w-full">
                    {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                    Simulate
                  </Button>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="rounded-md border p-3 space-y-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <span className={
                "h-5 w-5 rounded-full border flex items-center justify-center text-[10px] " +
                (activeStep > i ? "bg-primary text-primary-foreground border-primary" :
                  activeStep === i ? "border-primary text-primary" : "border-muted text-muted-foreground")
              }>
                {activeStep > i ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={activeStep >= i ? "" : "text-muted-foreground"}>{s}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">event_id</Badge>
              <code className="text-xs">{result.event_id ?? "—"}</code>
              <Badge variant="outline">receiver status</Badge>
              <code className="text-xs">{result.delivery?.status ?? "—"}</code>
            </div>
            <details className="rounded-md border p-3 text-xs">
              <summary className="cursor-pointer">View receiver response</summary>
              <pre className="mt-2 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
