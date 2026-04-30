// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P2, P6)
// Phase 3 — Provider webhook receivers documentation
// Justification: PSD2 RTS Article 36 (event integrity), Stripe & PayPal/Flutterwave
// signature standards, plus webhook_inbox idempotency (Stripe-style baseline).
//
// Receiver URLs are served via the Cloudflare-fronted edge host
// (api.kangopenbanking.com) so the underlying Supabase project ref is never
// leaked to merchants or upstream providers. The Worker forwards verified
// signed requests to the internal gateway-webhook-* functions.
import { useState } from "react";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck, Inbox, Webhook, KeyRound, Info, Copy, Check,
  Cloud, Clock, RefreshCw, Lock, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

// PUBLIC EDGE HOST — Cloudflare Worker fronting the Supabase Edge Functions.
// The Worker terminates TLS, enforces WAF + rate limits, and proxies the raw
// signed body to the corresponding internal gateway-webhook-* function while
// preserving every provider signature header byte-for-byte.
const EDGE_HOST = {
  production: "https://api.kangopenbanking.com",
  sandbox: "https://sandbox.api.kangopenbanking.com",
} as const;

type EnvKey = keyof typeof EDGE_HOST;

interface Receiver {
  provider: string;
  path: string;
  sigHeader: string;
  algo: string;
  secretEnv: string;
  docs: string;
  retryPolicy: string;
}

const RECEIVERS: Receiver[] = [
  {
    provider: "Stripe",
    path: "/webhooks/v1/stripe",
    sigHeader: "Stripe-Signature",
    algo: "HMAC-SHA256, scheme v1",
    secretEnv: "STRIPE_WEBHOOK_SECRET",
    docs: "https://stripe.com/docs/webhooks/signatures",
    retryPolicy: "Up to 3 days with exponential backoff (Stripe-managed)",
  },
  {
    provider: "Flutterwave",
    path: "/webhooks/v1/flutterwave",
    sigHeader: "verif-hash",
    algo: "Static secret hash, constant-time compare",
    secretEnv: "FLW_WEBHOOK_HASH",
    docs: "https://developer.flutterwave.com/docs/integration-guides/webhooks/",
    retryPolicy: "5 attempts at 5/30/60/300/1800 second intervals",
  },
  {
    provider: "PayPal",
    path: "/webhooks/v1/paypal",
    sigHeader: "PayPal-Transmission-Sig",
    algo: "X.509 cert-chain verification (SHA256withRSA)",
    secretEnv: "PAYPAL_WEBHOOK_ID",
    docs: "https://developer.paypal.com/api/rest/webhooks/",
    retryPolicy: "Up to 25 attempts over 3 days (PayPal-managed)",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onCopy}
      className="h-7 px-2"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export default function ProviderWebhookReceiversGuide() {
  const [env, setEnv] = useState<EnvKey>("production");
  const host = EDGE_HOST[env];

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <SEO
        title="Provider Webhook Receivers — Stripe, Flutterwave, PayPal | Kang Open Banking"
        description="Public Cloudflare-fronted callback URLs for Stripe, Flutterwave and PayPal — signature verification, webhook_inbox deduplication, retry semantics and audit trail."
      />
      <link rel="canonical" href="https://kangopenbanking.com/developer/webhooks/provider-receivers" />

      <header>
        <Badge variant="outline" className="mb-2">Integration Layer</Badge>
        <h1 className="text-3xl font-bold">Provider Webhook Receivers</h1>
        <p className="text-muted-foreground mt-2">
          Configure these public endpoints inside your Stripe, Flutterwave and PayPal dashboards so
          Kang Open Banking receives charge, refund, payout and dispute events directly from the upstream
          provider. All receivers are fronted by our Cloudflare edge — your provider never sees the
          underlying compute origin.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Last updated: 30 April 2026 · Standards: PSD2 RTS Art. 36, Stripe Signing Spec v1, PayPal Cert-Chain Verification
        </p>
      </header>

      <Alert>
        <Cloud className="h-4 w-4" />
        <AlertTitle>Cloudflare-fronted, signed and idempotent</AlertTitle>
        <AlertDescription>
          Inbound webhooks terminate at <code>api.kangopenbanking.com</code> behind Cloudflare WAF,
          DDoS protection and per-provider rate limiting. The Worker forwards the raw signed body
          to the internal verifier with every signature header preserved byte-for-byte.
          Each accepted event is persisted to <code>webhook_inbox</code> with the provider event ID
          as a unique key, so retries and replays are deduplicated automatically.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-muted-foreground" />
              <CardTitle>1. Public callback URLs</CardTitle>
            </div>
            <Tabs value={env} onValueChange={(v) => setEnv(v as EnvKey)}>
              <TabsList>
                <TabsTrigger value="production">Production</TabsTrigger>
                <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CardDescription>
            Paste the URL for the matching environment into the corresponding provider dashboard.
            URLs are stable — they will not change between deploys.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Receiver URL</TableHead>
                <TableHead className="hidden md:table-cell">Signature header</TableHead>
                <TableHead className="hidden md:table-cell">Algorithm</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RECEIVERS.map((r) => {
                const url = `${host}${r.path}`;
                return (
                  <TableRow key={r.provider}>
                    <TableCell className="font-medium">
                      {r.provider}
                      <a
                        href={r.docs}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                        aria-label={`${r.provider} webhook docs`}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell><code className="text-xs break-all">{url}</code></TableCell>
                    <TableCell className="hidden md:table-cell"><code className="text-xs">{r.sigHeader}</code></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{r.algo}</TableCell>
                    <TableCell className="text-right"><CopyButton text={url} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <CardTitle>2. Edge protection</CardTitle>
          </div>
          <CardDescription>
            Cloudflare-level controls applied before any webhook reaches our verifier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Control</TableHead>
                <TableHead>Behaviour</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>TLS termination</TableCell>
                <TableCell>TLS 1.3 only, HSTS preloaded, modern cipher suite enforced.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>WAF</TableCell>
                <TableCell>OWASP Core Rule Set + custom rules per provider path.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Rate limiting</TableCell>
                <TableCell>500 req/min per provider path — bursts above are queued.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Origin shielding</TableCell>
                <TableCell>Origin compute is not addressable from the public internet — only the Worker can reach it via mTLS-pinned tunnel.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>IP allow-list</TableCell>
                <TableCell>Optional, opt-in per merchant. Stripe, PayPal and Flutterwave egress ranges pre-approved.</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            <CardTitle>3. Signature verification</CardTitle>
          </div>
          <CardDescription>
            Each receiver verifies authenticity using a provider-specific secret loaded server-side.
            Kang Open Banking never trusts an unsigned or mis-signed event.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="font-semibold mb-2">Stripe</h3>
            <p className="text-sm text-muted-foreground mb-3">
              We extract <code>t</code> and <code>v1</code> tokens from <code>Stripe-Signature</code>,
              recompute <code>HMAC-SHA256(timestamp + "." + rawBody, STRIPE_WEBHOOK_SECRET)</code>, and
              compare with timing-safe equality. Events older than 5 minutes are rejected to block replay.
            </p>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`const [t, v1] = parseStripeSig(req.headers["stripe-signature"]);
const expected = hmacSha256Hex(\`\${t}.\${rawBody}\`, STRIPE_WEBHOOK_SECRET);
if (!timingSafeEqual(v1, expected) || (Date.now()/1000 - Number(t)) > 300) {
  return new Response("invalid signature", { status: 401 });
}`}
            </pre>
          </section>

          <Separator />

          <section>
            <h3 className="font-semibold mb-2">Flutterwave</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Flutterwave sends a static secret in the <code>verif-hash</code> header. We compare it
              against <code>FLW_WEBHOOK_HASH</code> with constant-time equality, then validate the
              <code> data.tx_ref</code> matches a known charge before persisting.
            </p>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`const sig = req.headers["verif-hash"] ?? "";
if (!timingSafeEqual(sig, FLW_WEBHOOK_HASH)) {
  return new Response("invalid hash", { status: 401 });
}`}
            </pre>
          </section>

          <Separator />

          <section>
            <h3 className="font-semibold mb-2">PayPal</h3>
            <p className="text-sm text-muted-foreground mb-3">
              PayPal verification calls <code>POST /v1/notifications/verify-webhook-signature</code> with
              the transmission headers and the configured <code>PAYPAL_WEBHOOK_ID</code>. Only responses
              of <code>VERIFICATION_STATUS=SUCCESS</code> are accepted.
            </p>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`const verify = await paypal.post("/v1/notifications/verify-webhook-signature", {
  auth_algo:        req.headers["paypal-auth-algo"],
  cert_url:         req.headers["paypal-cert-url"],
  transmission_id:  req.headers["paypal-transmission-id"],
  transmission_sig: req.headers["paypal-transmission-sig"],
  transmission_time:req.headers["paypal-transmission-time"],
  webhook_id:       PAYPAL_WEBHOOK_ID,
  webhook_event:    JSON.parse(rawBody),
});
if (verify.verification_status !== "SUCCESS") {
  return new Response("invalid", { status: 401 });
}`}
            </pre>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-muted-foreground" />
            <CardTitle>4. webhook_inbox — deduplication & audit</CardTitle>
          </div>
          <CardDescription>
            Authoritative inbound event store. Inbound webhooks are the source of truth for upstream
            provider state; we reconcile our own ledger from these events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column</TableHead>
                <TableHead>Purpose</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell><code>provider</code></TableCell><TableCell>stripe · flutterwave · paypal</TableCell></TableRow>
              <TableRow><TableCell><code>provider_event_id</code></TableCell><TableCell>Upstream unique ID — UNIQUE constraint per provider, drives dedupe.</TableCell></TableRow>
              <TableRow><TableCell><code>event_type</code></TableCell><TableCell>Normalised type (e.g. <code>charge.succeeded</code>).</TableCell></TableRow>
              <TableRow><TableCell><code>raw_payload</code></TableCell><TableCell>Verbatim signed body — never mutated.</TableCell></TableRow>
              <TableRow><TableCell><code>signature_valid</code></TableCell><TableCell>Boolean, set during verification step.</TableCell></TableRow>
              <TableRow><TableCell><code>processed_at</code></TableCell><TableCell>NULL until <code>gateway_webhook_events</code> records success.</TableCell></TableRow>
              <TableRow><TableCell><code>received_at</code></TableCell><TableCell>Server-side receipt timestamp.</TableCell></TableRow>
            </TableBody>
          </Table>

          <p className="text-sm text-muted-foreground">
            On insert conflict (same <code>provider</code> + <code>provider_event_id</code>), the receiver
            returns HTTP 200 immediately without re-processing. This makes safe retries from the provider
            side a no-op for our pipeline.
          </p>

          <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`-- Idempotent persist (excerpt)
INSERT INTO webhook_inbox
  (provider, provider_event_id, event_type, raw_payload, signature_valid, received_at)
VALUES ($1, $2, $3, $4, true, now())
ON CONFLICT (provider, provider_event_id) DO NOTHING
RETURNING id;`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle>5. Provider retry & backoff</CardTitle>
          </div>
          <CardDescription>
            Each upstream provider implements its own retry schedule on non-2xx responses. Our
            receivers are designed to be idempotent so any retry is a safe no-op.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Retry policy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RECEIVERS.map((r) => (
                <TableRow key={r.provider}>
                  <TableCell className="font-medium">{r.provider}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.retryPolicy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <CardTitle>6. Test your endpoint</CardTitle>
          </div>
          <CardDescription>
            Send a probe to confirm the receiver is reachable from your network. An unsigned probe
            must return HTTP 401 — that proves signature verification is active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Currently showing <Badge variant="secondary">{env}</Badge> URLs.
            </p>
          </div>
          {RECEIVERS.map((r) => {
            const cmd = `curl -i -X POST ${host}${r.path} \\\n  -H "Content-Type: application/json" \\\n  -d '{"probe":"unsigned"}'`;
            return (
              <div key={r.provider} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.provider}</span>
                  <CopyButton text={cmd} />
                </div>
                <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">{cmd}</pre>
                <p className="text-xs text-muted-foreground">
                  Expected: <code>HTTP/1.1 401 Unauthorized</code> with body <code>{`{"error":"invalid_signature"}`}</code>.
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            <CardTitle>7. Operational guarantees</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Behaviour</TableHead>
                <TableHead>Guarantee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell>Signature failure</TableCell><TableCell>HTTP 401, event NOT inserted, alert raised in admin Health Monitor.</TableCell></TableRow>
              <TableRow><TableCell>Duplicate provider event ID</TableCell><TableCell>HTTP 200, no-op. Original processing result preserved.</TableCell></TableRow>
              <TableRow><TableCell>Provider retry (2xx pending)</TableCell><TableCell>Always idempotent — safe to retry indefinitely.</TableCell></TableRow>
              <TableRow><TableCell>Process logs</TableCell><TableCell>Stored in <code>gateway_webhook_events</code>; queryable in admin dashboard.</TableCell></TableRow>
              <TableRow><TableCell>Replay</TableCell><TableCell>Operators can re-fan an inbound event to merchant endpoints via the deliveries replay action.</TableCell></TableRow>
              <TableRow><TableCell>Origin disclosure</TableCell><TableCell>The internal compute origin is never returned in headers, error bodies, or DNS — only the Cloudflare edge host is public.</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Reporting a leaked URL</AlertTitle>
        <AlertDescription>
          If you discover any documentation, error response, or third-party reference exposing the
          underlying compute origin, please report it to <a className="underline" href="mailto:security@kangopenbanking.com">security@kangopenbanking.com</a>.
          Confirmed reports are eligible under our responsible disclosure programme.
        </AlertDescription>
      </Alert>
    </div>
  );
}
