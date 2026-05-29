// Charge-scoped sandbox simulation façade (Phase 8).
// POST /v1/sandbox/charges/{chargeId}/simulate
// Body: { action: approve|decline|timeout|reverse, decline_code?, delay_ms? }
// Delegates to the existing sandbox-provider-simulator function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { problemResponse } from "../_shared/integration-layer/problem.ts";

const VALID_ACTIONS = new Set(["approve", "decline", "timeout", "reverse"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return problemResponse(req, 405, "Method Not Allowed", "Only POST is supported.");
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return problemResponse(req, 401, "Unauthorized", "Missing Authorization header.");
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) return problemResponse(req, 401, "Unauthorized", "Invalid credentials.");

    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // Expect .../sandbox-charge-simulate/<chargeId>  OR receive chargeId in body.
    const fnIdx = parts.indexOf("sandbox-charge-simulate");
    const chargeId = (fnIdx >= 0 && parts[fnIdx + 1]) || url.searchParams.get("chargeId");
    if (!chargeId) {
      return problemResponse(req, 400, "Bad Request", "chargeId is required (path or ?chargeId=).");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return problemResponse(req, 400, "Bad Request", "Request body must be valid JSON.");
    }
    const { action, decline_code, delay_ms } = body as Record<string, unknown>;
    if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
      return problemResponse(req, 422, "Unprocessable Entity",
        `action must be one of: ${[...VALID_ACTIONS].join(", ")}`);
    }

    // Delegate to the existing sandbox-provider-simulator.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const upstream = await fetch(`${supabaseUrl}/functions/v1/sandbox-provider-simulator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        charge_id: chargeId,
        action,
        decline_code: typeof decline_code === "string" ? decline_code : undefined,
        delay_ms: Number.isInteger(delay_ms) ? delay_ms : 0,
        user_id: userData.user.id,
      }),
    });

    const text = await upstream.text();
    return new Response(text || JSON.stringify({ ok: upstream.ok, charge_id: chargeId, action }), {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
    });
  } catch (err) {
    return problemResponse(req, 500, "Internal Server Error", (err as Error).message);
  }
});
