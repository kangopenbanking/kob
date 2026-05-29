// Sandbox fault-injection façade (Phase 8).
// Arms a specific failure mode for the next matching sandbox operation.
// Standing Order #3 citation: Plaid sandbox model — `/sandbox/transactions/refresh` analog.
//
// Body: { event, target_id?, delay_ms? }
//   event ∈ bank_timeout | network_unreachable | insufficient_funds | operator_unavailable
//           | customer_not_registered | daily_limit_exceeded | rate_limited_429 | provider_504

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { problemResponse } from "../_shared/integration-layer/problem.ts";

const VALID_EVENTS = new Set([
  "bank_timeout",
  "network_unreachable",
  "insufficient_funds",
  "operator_unavailable",
  "customer_not_registered",
  "daily_limit_exceeded",
  "rate_limited_429",
  "provider_504",
]);

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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return problemResponse(req, 400, "Bad Request", "Request body must be valid JSON.");
    }
    const { event, target_id, delay_ms } = body as Record<string, unknown>;
    if (typeof event !== "string" || !VALID_EVENTS.has(event)) {
      return problemResponse(req, 422, "Unprocessable Entity",
        `event must be one of: ${[...VALID_EVENTS].join(", ")}`);
    }

    // Persist fault. The sandbox-provider-simulator function consults this on next call.
    const { data: fault, error } = await supabase
      .from("sandbox_fault_triggers")
      .insert({
        user_id: userData.user.id,
        event,
        target_id: typeof target_id === "string" ? target_id : null,
        delay_ms: Number.isInteger(delay_ms) ? Math.max(0, Math.min(60000, delay_ms as number)) : 0,
        consumed: false,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      // Table may not exist yet — return success with synthetic id so the API surface
      // is usable while the storage backend rolls out.
      console.warn("[sandbox-trigger] persistence skipped:", error.message);
      return new Response(JSON.stringify({ trigger_id: crypto.randomUUID(), persisted: false }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ trigger_id: fault?.id }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return problemResponse(req, 500, "Internal Server Error", (err as Error).message);
  }
});
