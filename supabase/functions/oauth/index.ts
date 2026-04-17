/**
 * OAuth compatibility router.
 * Maps /oauth/token, /oauth/authorize, etc. to flat functions.
 */
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ROUTE_MAP: Record<string, string> = {
  "token":      "oauth-token",
  "authorize":  "oauth-authorize",
  "introspect": "oauth-introspect",
  "revoke":     "oauth-revoke",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/oauth\/?/, "").split("/").filter(Boolean);
  const routeKey = parts[0]?.toLowerCase() ?? "";

  if (!routeKey) {
    return new Response(
      JSON.stringify({
        service: "Kang Open Banking — OAuth 2.0 / FAPI",
        routes: Object.keys(ROUTE_MAP),
        discovery: `${SUPABASE_URL}/functions/v1/oidc-config`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const targetFn = ROUTE_MAP[routeKey];
  if (!targetFn) {
    return new Response(
      JSON.stringify({ error: "not_found", message: `Unknown oauth route: /${routeKey}` }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const remainingPath = parts.slice(1).join("/");
  const targetUrl = `${SUPABASE_URL}/functions/v1/${targetFn}${remainingPath ? `/${remainingPath}` : ""}${url.search}`;

  // Forward headers as-is. Do NOT inject service role — OAuth endpoints
  // must authenticate the actual caller (client credentials, etc.).
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");

  const init: RequestInit = {
    method: req.method,
    headers,
    ...(req.body && req.method !== "GET" && req.method !== "HEAD" ? { body: req.body, duplex: "half" as any } : {}),
  };

  try {
    const upstream = await fetch(targetUrl, init);
    const body = await upstream.arrayBuffer();
    const respHeaders = new Headers(upstream.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => respHeaders.set(k, v));
    return new Response(body, { status: upstream.status, headers: respHeaders });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "upstream_error", message: String(err) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
