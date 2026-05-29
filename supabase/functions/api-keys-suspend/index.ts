// supabase/functions/api-keys-suspend
// Admin endpoint to suspend (or unsuspend) an institution API key without
// destroying it. POST /functions/v1/api-keys-suspend
// Body: { api_key_id: string, action: 'suspend'|'resume', reason?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

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
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { api_key_id?: string; action?: string; reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }

  if (!body.api_key_id || !/^[0-9a-f-]{36}$/i.test(body.api_key_id)) {
    return new Response(JSON.stringify({ error: "api_key_id (uuid) required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!body.action || !["suspend", "resume"].includes(body.action)) {
    return new Response(JSON.stringify({ error: "action must be 'suspend' or 'resume'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const update =
    body.action === "suspend"
      ? { status: "suspended", suspended_at: new Date().toISOString(), suspended_reason: body.reason ?? null }
      : { status: "active", suspended_at: null, suspended_reason: null };

  const { data: row, error } = await supabase
    .from("gateway_merchant_api_keys")
    .update(update)
    .eq("id", body.api_key_id)
    .neq("status", "revoked")
    .select("id, status, suspended_at, suspended_reason")
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!row) {
    return new Response(JSON.stringify({ error: "Key not found or already revoked" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(row), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
