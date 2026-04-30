// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P2, P6)
// Provider webhook onboarding checklist for merchants. Tells them exactly
// which fields to configure in the Stripe / Flutterwave / PayPal dashboards
// and which secret to ship to Kang Open Banking in return.
import { useState } from "react";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Check, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const EDGE = {
  production: "https://api.kangopenbanking.com",
  sandbox: "https://sandbox.api.kangopenbanking.com",
} as const;

type EnvKey = keyof typeof EDGE;

interface Step {
  title: string;
  detail: string;
  value?: string;
}

interface ProviderChecklist {
  provider: "Stripe" | "Flutterwave" | "PayPal";
  path: string;
  dashboardUrl: string;
  events: string[];
  secretField: string;
  secretEnv: string;
  steps: (env: EnvKey) => Step[];
}

const PROVIDERS: ProviderChecklist[] = [
  {
    provider: "Stripe",
    path: "/webhooks/v1/stripe",
    dashboardUrl: "https://dashboard.stripe.com/webhooks",
    events: [
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.closed",
      "payout.paid",
      "payout.failed",
    ],
    secretField: "Signing secret (whsec_…)",
    secretEnv: "STRIPE_WEBHOOK_SECRET",
    steps: (env) => [
      { title: "Open the Stripe Dashboard", detail: "Sign in and switch to the workspace you use for Kang Open Banking." },
      { title: "Go to Developers → Webhooks", detail: "Click Add endpoint." },
      { title: "Endpoint URL", detail: "Paste the URL below.", value: `${EDGE[env]}/webhooks/v1/stripe` },
      { title: "API version", detail: "Use your account's default API version unless told otherwise." },
      { title: "Listen to", detail: "Choose 'Select events' and tick the events listed under Required events on the right." },
      { title: "Reveal & copy the Signing secret", detail: "On the new endpoint detail page click 'Reveal' next to Signing secret. Copy the whsec_… value." },
      { title: "Send the secret to Kang Open Banking", detail: "Open Settings → Provider Secrets in your dashboard and paste the signing secret into STRIPE_WEBHOOK_SECRET." },
      { title: "Send a test event", detail: "Use 'Send test webhook' and confirm a 200 response. Failures will show in the Recent deliveries panel." },
    ],
  },
  {
    provider: "Flutterwave",
    path: "/webhooks/v1/flutterwave",
    dashboardUrl: "https://dashboard.flutterwave.com/dashboard/settings/webhooks",
    events: ["charge.completed", "transfer.completed", "transfer.failed"],
    secretField: "Secret hash",
    secretEnv: "FLW_WEBHOOK_HASH",
    steps: (env) => [
      { title: "Open the Flutterwave Dashboard", detail: "Sign in and select the live or test environment that matches the URL below." },
      { title: "Go to Settings → Webhooks", detail: "Open the Webhooks tab in the left navigation." },
      { title: "Webhook URL", detail: "Paste the URL below.", value: `${EDGE[env]}/webhooks/v1/flutterwave` },
      { title: "Generate a Secret hash", detail: "Use any 32+ character random string. Save it locally — you cannot view it again." },
      { title: "Save the webhook", detail: "Flutterwave will start sending verif-hash with every delivery." },
      { title: "Send the secret to Kang Open Banking", detail: "Open Settings → Provider Secrets and paste the same secret hash into FLW_WEBHOOK_HASH." },
      { title: "Trigger a test charge", detail: "Run a sandbox charge to confirm the webhook fires and is accepted (200)." },
    ],
  },
  {
    provider: "PayPal",
    path: "/webhooks/v1/paypal",
    dashboardUrl: "https://developer.paypal.com/dashboard/applications",
    events: [
      "PAYMENT.CAPTURE.COMPLETED",
      "CHECKOUT.ORDER.APPROVED",
      "PAYOUTS-ITEM.SUCCEEDED",
      "PAYOUTS-ITEM.FAILED",
      "PAYMENT.CAPTURE.REFUNDED",
    ],
    secretField: "Webhook ID",
    secretEnv: "PAYPAL_WEBHOOK_ID",
    steps: (env) => [
      { title: "Open the PayPal Developer Dashboard", detail: "Sign in and pick the application you use for Kang Open Banking." },
      { title: "Scroll to Webhooks → Add Webhook", detail: "Available under the application detail page." },
      { title: "Webhook URL", detail: "Paste the URL below.", value: `${EDGE[env]}/webhooks/v1/paypal` },
      { title: "Event types", detail: "Tick the events listed under Required events on the right." },
      { title: "Save the webhook", detail: "PayPal will assign a Webhook ID once saved." },
      { title: "Copy the Webhook ID", detail: "From the webhooks list, copy the Webhook ID for this entry." },
      { title: "Send the ID to Kang Open Banking", detail: "Open Settings → Provider Secrets and paste it into PAYPAL_WEBHOOK_ID." },
      { title: "Send a sample event", detail: "Use the 'Webhooks Simulator' on PayPal and confirm a 200 response from our edge." },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-2"
      aria-label={copied ? "Copied" : "Copy"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Copy failed");
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export default function ProviderOnboardingChecklist() {
  const [env, setEnv] = useState<EnvKey>("production");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const stepKey = (provider: string, idx: number) => `${env}:${provider}:${idx}`;
  const completed = (provider: string, total: number) => {
    let n = 0;
    for (let i = 0; i < total; i++) if (checked[stepKey(provider, i)]) n++;
    return n;
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <SEO
        title="Webhook Onboarding Checklist — Stripe, Flutterwave, PayPal | Kang Open Banking"
        description="Step-by-step dashboard configuration for Stripe, Flutterwave and PayPal webhooks. Copy-ready endpoint URLs and exact event lists."
      />
      <link rel="canonical" href="https://kangopenbanking.com/developer/webhooks/onboarding" />

      <header className="space-y-2">
        <Badge variant="outline">Merchants · Webhooks</Badge>
        <h1 className="text-3xl font-bold">Provider Webhook Onboarding</h1>
        <p className="text-muted-foreground">
          Follow the checklist for each provider you use. Each step is a single
          dashboard action — when all boxes are ticked, your account is wired to
          receive Stripe, Flutterwave and PayPal events through our Cloudflare
          edge.
        </p>
      </header>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Same URL for life</AlertTitle>
        <AlertDescription>
          Endpoint URLs below are stable and will not change between deploys. The
          edge is fronted by Cloudflare — your provider dashboard never sees our
          underlying compute origin.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Tabs value={env} onValueChange={(v) => setEnv(v as EnvKey)}>
          <TabsList>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs defaultValue="Stripe">
        <TabsList>
          {PROVIDERS.map((p) => (
            <TabsTrigger key={p.provider} value={p.provider}>{p.provider}</TabsTrigger>
          ))}
        </TabsList>

        {PROVIDERS.map((p) => {
          const steps = p.steps(env);
          const done = completed(p.provider, steps.length);
          const url = `${EDGE[env]}${p.path}`;
          return (
            <TabsContent key={p.provider} value={p.provider} className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle>{p.provider} webhook configuration</CardTitle>
                      <CardDescription>
                        Configure once per environment. All steps are reversible from the same dashboard page.
                      </CardDescription>
                    </div>
                    <Badge variant={done === steps.length ? "default" : "outline"}>
                      {done} / {steps.length} done
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Endpoint URL ({env})</div>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs break-all">{url}</code>
                        <CopyButton text={url} />
                      </div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Secret field on our side</div>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs">{p.secretEnv}</code>
                        <CopyButton text={p.secretEnv} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Provider field name: <strong>{p.secretField}</strong>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Required events</h3>
                    <div className="flex flex-wrap gap-2">
                      {p.events.map((e) => (
                        <Badge key={e} variant="secondary" className="font-mono text-xs">{e}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Steps</h3>
                    <ol className="space-y-3">
                      {steps.map((s, i) => {
                        const k = stepKey(p.provider, i);
                        return (
                          <li key={i} className="flex items-start gap-3 border rounded-lg p-3">
                            <Checkbox
                              checked={!!checked[k]}
                              onCheckedChange={(v) =>
                                setChecked((prev) => ({ ...prev, [k]: !!v }))
                              }
                              aria-label={`Mark step ${i + 1} done`}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">
                                {i + 1}. {s.title}
                              </div>
                              <div className="text-sm text-muted-foreground">{s.detail}</div>
                              {s.value && (
                                <div className="mt-2 flex items-center justify-between gap-2 bg-muted rounded px-2 py-1">
                                  <code className="text-xs break-all">{s.value}</code>
                                  <CopyButton text={s.value} />
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  <div>
                    <a
                      className="inline-flex items-center gap-1 text-sm underline"
                      href={p.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open {p.provider} dashboard
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
