/**
 * Payment Facilitation REST Router
 *
 * Bridges the documented OpenAPI paths to the underlying edge functions:
 *   POST /v1/banking/facilitated-mobile-money-charge → facilitated-mobile-money-charge
 *   POST /v1/banking/facilitated-transfer            → facilitated-bank-transfer
 *   POST /v1/settlement/calculate                    → settlement-calculate
 *   POST /v1/settlement/process                      → settlement-process
 *
 * The leaf functions remain unchanged. This router only translates REST
 * paths into direct edge-function invocations and forwards auth + body.
 */
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

type Route = { method: string; pattern: RegExp; fn: string };

const ROUTES: Route[] = [
  { method: "POST", pattern: /^\/?v1\/banking\/facilitated-mobile-money-charge\/?$/, fn: "facilitated-mobile-money-charge" },
  { method: "POST", pattern: /^\/?v1\/banking\/facilitated-transfer\/?$/,            fn: "facilitated-bank-transfer" },
  { method: "POST", pattern: /^\/?v1\/settlement\/calculate\/?$/,                    fn: "settlement-calculate" },
  { method: "POST", pattern: /^\/?v1\/settlement\/process\/?$/,                      fn: "settlement-process" },
];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Strip the function-name prefix so internal callers and gateway calls both work
  const subpath = url.pathname.replace(/^\/?(payment-facilitation-router\/?)/, "/");

  // Discovery
  if (subpath === "/" || subpath === "") {
    return json({
      service: "Kang Open Banking — Payment Facilitation",
      version: "1.0.0",
      contract: "REST",
      documentation: "https://kangopenbanking.com/developer/payment-facilitation",
      routes: ROUTES.map((r) => `${r.method} ${r.pattern.source.replace(/[\\^$?]/g, "")}`),
    });
  }

  const match = ROUTES.find((r) => r.method === req.method && r.pattern.test(subpath));
  if (!match) {
    return json(
      {
        error: "route_not_found",
        message: `No Payment Facilitation route for ${req.method} ${subpath}`,
        hint: "See discovery at GET /payment-facilitation-router",
      },
      404,
    );
  }

  // Forward to the leaf edge function
  const targetUrl = `${SUPABASE_URL}/functions/v1/${match.fn}`;
  const fwdHeaders = new Headers();
  for (const [k, v] of req.headers.entries()) {
    const kl = k.toLowerCase();
    if (["host", "content-length", "connection"].includes(kl)) continue;
    fwdHeaders.set(k, v);
  }

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, { method: req.method, headers: fwdHeaders, body });
    const buf = await upstream.arrayBuffer();
    const respHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders)) respHeaders.set(k, v);
    return new Response(buf, { status: upstream.status, headers: respHeaders });
  } catch (err) {
    return json({ error: "upstream_error", message: String(err) }, 502);
  }
});
