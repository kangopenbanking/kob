// Revoke an API credential. Admin or institution owner only.
// Idempotent: revoking an already-revoked key returns 200 with unchanged state.

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
  const baseCtx = { correlationId, path: "/revoke-api-key", method: req.method };

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: withCorrelationHeader(corsHeaders, correlationId),
    });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, correlationId);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    logWarn("missing_bearer", baseCtx);
    return json({ error: "unauthorized" }, 401, correlationId);
  }

  // Identify caller via anon client + JWT
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

  let body: { credential_id?: string; key_prefix?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, correlationId);
  }
  if (!body.credential_id && !body.key_prefix) {
    return json({ error: "credential_id_or_key_prefix_required" }, 400, correlationId);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Load credential (service role — RLS bypassed, we enforce ownership below)
  let query = admin
    .from("api_credentials")
    .select("id, institution_id, key_prefix, key_type, status, revoked_at");
  if (body.credential_id) query = query.eq("id", body.credential_id);
  else query = query.eq("key_prefix", body.key_prefix!);

  const { data: cred, error: credErr } = await query.maybeSingle();
  if (credErr) {
    logError("credential_lookup_failed", baseCtx, { err: credErr.message });
    return json({ error: "lookup_failed" }, 500, correlationId);
  }
  if (!cred) {
    logWarn("credential_not_found", baseCtx);
    return json({ error: "not_found" }, 404, correlationId);
  }

  const ctx = { ...baseCtx, institution_id: cred.institution_id, actor_id: callerId };

  // Authorization: admin OR institution owner
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });

  let authorized = Boolean(isAdmin);
  if (!authorized) {
    const { data: inst, error: instErr } = await admin
      .from("institutions")
      .select("user_id")
      .eq("id", cred.institution_id)
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

  // Idempotent: already revoked → return current state
  if (cred.status === "revoked") {
    logInfo("already_revoked", ctx, { credential_id: cred.id });
    return json(
      {
        credential_id: cred.id,
        status: "revoked",
        revoked_at: cred.revoked_at,
        already_revoked: true,
      },
      200,
      correlationId,
    );
  }

  const { data: updated, error: updErr } = await admin
    .from("api_credentials")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: callerId,
    })
    .eq("id", cred.id)
    .eq("institution_id", cred.institution_id)
    .neq("status", "revoked")
    .select("id, status, revoked_at")
    .maybeSingle();

  if (updErr) {
    logError("revoke_update_failed", ctx, { err: updErr.message });
    return json({ error: "revoke_failed" }, 500, correlationId);
  }

  if (!updated) {
    // Race: status changed to revoked between read and update — treat as success
    logInfo("revoke_race_already_revoked", ctx, { credential_id: cred.id });
    return json(
      { credential_id: cred.id, status: "revoked", already_revoked: true },
      200,
      correlationId,
    );
  }

  logInfo("revoked", ctx, { credential_id: updated.id });
  return json(
    {
      credential_id: updated.id,
      status: updated.status,
      revoked_at: updated.revoked_at,
    },
    200,
    correlationId,
  );
});
