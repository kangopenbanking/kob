/**
 * Health compatibility wrapper.
 * Proxies /health to api-health so nested path works.
 */
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const targetUrl = `${SUPABASE_URL}/functions/v1/api-health`;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: req.headers,
    });
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
