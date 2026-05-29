// supabase/functions/api-keys-create
// Admin endpoint to mint a new institution-scoped API key.
// POST /functions/v1/api-keys-create
// Body: { merchant_id: string, label?: string, environment?: 'sandbox'|'production' }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

function randHex(len: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (!(roleRows ?? []).some((r: any) => r.role === "admin")) {
    return new Response(JSON.stringify({ error: "Forbidden — admin required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { merchant_id?: string; label?: string; environment?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  if (!body.merchant_id || !/^[0-9a-f-]{36}$/i.test(body.merchant_id)) {
    return new Response(JSON.stringify({ error: "merchant_id (uuid) required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const env = body.environment === "production" ? "production" : "sandbox";
  const prefix = env === "production" ? "sk_live_" : "sk_test_";
  const plaintext = `${prefix}${randHex(24)}`;
  const hash = await sha256(plaintext);

  const { data: row, error } = await supabase
    .from("gateway_merchant_api_keys")
    .insert({
      merchant_id: body.merchant_id,
      api_key_hash: hash,
      api_key_prefix: plaintext.slice(0, 12),
      label: body.label ?? `Key ${new Date().toISOString().slice(0, 10)}`,
      environment: env,
      status: "active",
      is_active: true,
    })
    .select("id, api_key_prefix, environment, label, status, created_at")
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ...row,
      api_key: plaintext,
      shown_once: true,
      message: "Store this API key now — it will not be shown again.",
    }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
