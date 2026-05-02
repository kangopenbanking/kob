// PERMANENT PUBLIC EDGE FUNCTION (sandbox surface).
//
// /v1/sandbox/providers/{stripe|flutterwave|paypal}/simulate
//
// Body:  { scenario: "success" | "declined" | "timeout" | "dispute_opened" | "refund",
//          amount: number, currency: string, customer?: { name?, email? } }
//
// What it does:
//   1. Builds a realistic provider payload for the requested scenario.
//   2. Signs it with the provider's secret (using the same algorithm the
//      live receivers verify against).
//   3. POSTs the signed payload into the canonical receiver function URL
//      (gateway-webhook-stripe / -flutterwave / -paypal) so the rest of
//      the platform behaves identically to a real provider event.
//   4. Returns the receiver's response and a links object so the developer
//      can poll the resulting charge / outbound webhook delivery.
//
// Auth: requires sandbox API key OR the x-sandbox header (sandbox-router
//       handles auth before forwarding here).

import { corsHeaders } from "../_shared/cors.ts";

type Scenario = "success" | "declined" | "timeout" | "dispute_opened" | "refund";

type SimReq = {
  scenario: Scenario;
  amount?: number;
  currency?: string;
  customer?: { name?: string; email?: string };
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const PROVIDER_RECEIVERS: Record<string, { fn: string; sigHeader: string; secretEnv: string }> = {
  stripe: { fn: "gateway-webhook-stripe", sigHeader: "stripe-signature", secretEnv: "STRIPE_WEBSECRET_KEY" },
  flutterwave: { fn: "gateway-webhook-flutterwave", sigHeader: "verif-hash", secretEnv: "FLUTTERWAVE_SECRET_HASH" },
  paypal: { fn: "gateway-webhook-paypal", sigHeader: "paypal-transmission-sig", secretEnv: "PAYPAL_WEBHOOK_ID" },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-Fapi-Interaction-Id": crypto.randomUUID() },
  });
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildStripePayload(s: SimReq) {
  const id = `evt_test_${crypto.randomUUID().replace(/-/g, "")}`;
  const charge = `ch_test_${crypto.randomUUID().slice(0, 12)}`;
  const status = s.scenario === "declined" ? "failed" : s.scenario === "refund" ? "succeeded" : "succeeded";
  const type = s.scenario === "dispute_opened" ? "charge.dispute.created"
    : s.scenario === "refund" ? "charge.refunded"
    : "charge.succeeded";
  return {
    id, object: "event", api_version: "2024-09-30", type,
    data: { object: { id: charge, object: "charge", amount: s.amount ?? 5000, currency: s.currency ?? "usd", status, paid: status === "succeeded", customer: null, metadata: { sandbox: "true" } } },
  };
}

function buildFlutterwavePayload(s: SimReq) {
  const id = `flw_test_${Date.now()}`;
  const status = s.scenario === "declined" ? "failed" : "successful";
  return {
    event: s.scenario === "dispute_opened" ? "charge.dispute.opened" : "charge.completed",
    "event.type": "Transaction",
    data: { id, tx_ref: `kob_sbx_${crypto.randomUUID().slice(0, 8)}`, flw_ref: id, amount: s.amount ?? 5000, currency: s.currency ?? "XAF", status, customer: s.customer ?? { email: "sandbox@kangopenbanking.com" }, meta: { sandbox: true } },
  };
}

function buildPaypalPayload(s: SimReq) {
  const id = `WH-TEST-${crypto.randomUUID()}`;
  const event_type = s.scenario === "dispute_opened" ? "CUSTOMER.DISPUTE.CREATED"
    : s.scenario === "refund" ? "PAYMENT.CAPTURE.REFUNDED"
    : s.scenario === "declined" ? "PAYMENT.CAPTURE.DENIED"
    : "PAYMENT.CAPTURE.COMPLETED";
  return {
    id, event_version: "1.0", create_time: new Date().toISOString(), resource_type: "capture", event_type,
    resource: { id: `CAP-${crypto.randomUUID().slice(0, 12)}`, status: s.scenario === "declined" ? "DECLINED" : "COMPLETED", amount: { currency_code: s.currency ?? "USD", value: ((s.amount ?? 5000) / 100).toFixed(2) }, custom_id: "kob-sandbox" },
  };
}

async function signAndForward(provider: string, payload: any) {
  const cfg = PROVIDER_RECEIVERS[provider];
  if (!cfg) throw new Error(`unknown_provider:${provider}`);
  const secret = Deno.env.get(cfg.secretEnv) ?? "sandbox_secret_not_configured";
  const raw = JSON.stringify(payload);

  let signatureHeader: string;
  if (provider === "stripe") {
    const t = Math.floor(Date.now() / 1000).toString();
    const v1 = await hmacSha256Hex(secret, `${t}.${raw}`);
    signatureHeader = `t=${t},v1=${v1}`;
  } else if (provider === "flutterwave") {
    // Flutterwave uses a static verif-hash — the receiver compares against the env value directly.
    signatureHeader = secret;
  } else {
    // PayPal uses an asymmetric signature; for the sandbox we deliver a synthetic value
    // and rely on the receiver's sandbox-mode verification path.
    signatureHeader = `sandbox.${await hmacSha256Hex(secret, raw)}`;
  }

  const url = `${SUPABASE_URL}/functions/v1/${cfg.fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [cfg.sigHeader]: signatureHeader,
      "x-sandbox": "true",
    },
    body: raw,
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* keep as text */ }
  return { status: res.status, body, signature_header: cfg.sigHeader };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = new URL(req.url);
    // Path style: /functions/v1/sandbox-provider-simulator/{provider}
    // OR routed via sandbox-router which puts provider in body.
    const pathParts = url.pathname.split("/").filter(Boolean);
    let provider = pathParts[pathParts.length - 1];

    let body: SimReq;
    try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

    if (!PROVIDER_RECEIVERS[provider] && (body as any).provider) {
      provider = (body as any).provider;
    }
    if (!PROVIDER_RECEIVERS[provider]) {
      return json({ error: "unknown_provider", supported: Object.keys(PROVIDER_RECEIVERS) }, 400);
    }
    const validScenarios: Scenario[] = ["success", "declined", "timeout", "dispute_opened", "refund"];
    if (!validScenarios.includes(body.scenario)) {
      return json({ error: "invalid_scenario", supported: validScenarios }, 400);
    }

    if (body.scenario === "timeout") {
      // Simulate provider timeout — return synthetic outcome without forwarding.
      return json({
        provider, scenario: body.scenario, simulated: true,
        delivery: { status: 0, body: "provider_timeout (simulated)" },
        message: "Sandbox timeout simulated — receiver not invoked.",
      });
    }

    const payload = provider === "stripe" ? buildStripePayload(body)
      : provider === "flutterwave" ? buildFlutterwavePayload(body)
      : buildPaypalPayload(body);

    const delivery = await signAndForward(provider, payload);

    return json({
      provider,
      scenario: body.scenario,
      event_id: payload.id ?? null,
      payload,
      delivery,
      links: {
        webhook_inbox: `/admin/webhooks/replay?source=${provider}`,
        gateway_charges: `/v1/gateway/charges?provider=${provider}`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: "simulator_failed", detail: msg }, 500);
  }
});
