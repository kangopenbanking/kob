// List API credentials for an institution. Admin or institution owner only.
// Multi-tenant safety: every service-role query explicitly filters by institution_id.
// Never returns key_hash — only prefix + metadata.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  getCorrelationId,
  logInfo,
  logWarn,
  logError,
  withCorrelationHeader,
} from "../_shared/kob-logger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status: number, correlationId: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: withCorrelationHeader(
      { ...corsHeaders, "Content-Type": "application/json" },
      correlationId,
    ),
  });
}

Deno.serve(async (req) => {
  const correlationId = getCorrelationId(req);
  const baseCtx = { correlationId, path: "/list-api-keys", method: req.method };

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: withCorrelationHeader(corsHeaders, correlationId),
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, correlationId);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    logWarn("missing_bearer", baseCtx);
    return json({ error: "unauthorized" }, 401, correlationId);
  }

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) {
    logWarn("jwt_invalid", baseCtx, { err: userErr?.message });
    return json({ error: "unauthorized" }, 401, correlationId);
  }
  const callerId = userData.user.id;

  // Read institution_id from query string or JSON body
  const url = new URL(req.url);
  let institutionId = url.searchParams.get("institution_id");
  let includeRevoked = url.searchParams.get("include_revoked") === "true";
  if (!institutionId && req.method === "POST") {
    try {
      const body = await req.json();
      institutionId = body?.institution_id ?? null;
      includeRevoked = includeRevoked || Boolean(body?.include_revoked);
    } catch {
      // ignore
    }
  }
  if (!institutionId) {
    return json({ error: "institution_id_required" }, 400, correlationId);
  }

  const ctx = { ...baseCtx, institution_id: institutionId, actor_id: callerId };
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Authorization: admin OR owner of the specific institution
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });

  let authorized = Boolean(isAdmin);
  if (!authorized) {
    const { data: inst, error: instErr } = await admin
      .from("institutions")
      .select("user_id")
      .eq("id", institutionId) // explicit tenant filter
      .maybeSingle();
    if (instErr) {
      logError("institution_lookup_failed", ctx, { err: instErr.message });
      return json({ error: "lookup_failed" }, 500, correlationId);
    }
    authorized = inst?.user_id === callerId;
  }

  if (!authorized) {
    logWarn("forbidden", ctx);
    return json({ error: "forbidden" }, 403, correlationId);
  }

  // Explicit tenant filter — required with service_role.
  let listQuery = admin
    .from("api_credentials")
    .select(
      "id, institution_id, key_type, key_prefix, scopes, status, created_at, created_by, revoked_at, revoked_by",
    )
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });

  if (!includeRevoked) {
    listQuery = listQuery.eq("status", "active");
  }

  const { data, error } = await listQuery;
  if (error) {
    logError("list_failed", ctx, { err: error.message });
    return json({ error: "list_failed" }, 500, correlationId);
  }

  logInfo("listed", ctx, { count: data?.length ?? 0 });
  return json({ institution_id: institutionId, credentials: data ?? [] }, 200, correlationId);
});
