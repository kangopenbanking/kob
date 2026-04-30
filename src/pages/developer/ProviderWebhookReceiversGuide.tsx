// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P2, P6)
// Phase 3 — Provider webhook receivers documentation
// Justification: PSD2 RTS Article 36 (event integrity), Stripe & PayPal/Flutterwave
// signature standards, plus webhook_inbox idempotency (Stripe-style baseline).
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, Inbox, Webhook, KeyRound, Info } from "lucide-react";

const RECEIVERS = [
  {
    provider: "Stripe",
    url: "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-webhook-stripe",
    sigHeader: "Stripe-Signature",
    algo: "HMAC-SHA256, scheme v1",
    secretEnv: "STRIPE_WEBHOOK_SECRET",
    docs: "https://stripe.com/docs/webhooks/signatures",
  },
  {
    provider: "Flutterwave",
    url: "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-webhook-flutterwave",
    sigHeader: "verif-hash",
    algo: "Static secret hash comparison",
    secretEnv: "FLW_WEBHOOK_HASH",
    docs: "https://developer.flutterwave.com/docs/integration-guides/webhooks/",
  },
  {
    provider: "PayPal",
    url: "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-webhook-paypal",
    sigHeader: "PayPal-Transmission-Sig",
    algo: "Cert-chain verification (x509 + SHA256)",
    secretEnv: "PAYPAL_WEBHOOK_ID",
    docs: "https://developer.paypal.com/api/rest/webhooks/",
  },
];

export default function ProviderWebhookReceiversGuide() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <SEO
        title="Provider Webhook Receivers — Stripe, Flutterwave, PayPal | Kang Open Banking"
        description="Public callback URLs for Stripe, Flutterwave and PayPal — signature verification methods, webhook_inbox deduplication, retry semantics and audit trail."
      />

      <header>
        <Badge variant="outline" className="mb-2">Integration Layer</Badge>
        <h1 className="text-3xl font-bold">Provider Webhook Receivers</h1>
        <p className="text-muted-foreground mt-2">
          Configure these public endpoints inside your Stripe, Flutterwave and PayPal dashboards so KOB
          receives charge, refund, payout and dispute events directly from the upstream provider.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Last updated: 30 April 2026 · Standards: PSD2 RTS Art. 36, Stripe Signing Spec v1, PayPal Cert-Chain Verification
        </p>
      </header>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Public, signed and idempotent</AlertTitle>
        <AlertDescription>
          The receivers below are intentionally public — they accept POSTs only from the upstream provider
          and fail closed on signature mismatch. Every accepted event is persisted to <code>webhook_inbox</code>
          with the provider event ID as a unique key, so retries and replays are safely deduplicated.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-muted-foreground" />
            <CardTitle>1. Public callback URLs</CardTitle>
          </div>
          <CardDescription>Paste these URLs into the corresponding provider dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Receiver URL</TableHead>
                <TableHead>Signature header</TableHead>
                <TableHead>Algorithm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RECEIVERS.map((r) => (
                <TableRow key={r.provider}>
                  <TableCell className="font-medium">{r.provider}</TableCell>
                  <TableCell><code className="text-xs">{r.url}</code></TableCell>
                  <TableCell><code className="text-xs">{r.sigHeader}</code></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.algo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            <CardTitle>2. Signature verification</CardTitle>
          </div>
          <CardDescription>
            Each receiver verifies authenticity using a provider-specific secret loaded server-side. KOB never
            trusts an unsigned or mis-signed event.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="font-semibold mb-2">Stripe</h3>
            <p className="text-sm text-muted-foreground mb-3">
              KOB extracts <code>t</code> and <code>v1</code> tokens from <code>Stripe-Signature</code>,
              recomputes <code>HMAC-SHA256(timestamp + "." + rawBody, STRIPE_WEBHOOK_SECRET)</code>, and
              compares with timing-safe equality. Events older than 5 minutes are rejected to block replay.
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
              Flutterwave sends a static secret in the <code>verif-hash</code> header. KOB compares it
              against <code>FLW_WEBHOOK_HASH</code> with constant-time equality, then validates the
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
            <CardTitle>3. webhook_inbox — deduplication & audit</CardTitle>
          </div>
          <CardDescription>
            Authoritative inbound event store. Inbound webhooks are the source of truth for upstream
            provider state; KOB reconciles its own ledger from these events.
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
            side a no-op for KOB.
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
            <Info className="h-5 w-5 text-muted-foreground" />
            <CardTitle>4. Operational guarantees</CardTitle>
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
