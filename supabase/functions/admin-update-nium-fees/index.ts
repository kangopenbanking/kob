// POST /functions/v1/admin-update-nium-fees
// Admin-only. Updates platform fee_structures for Nium (nium_fx_spread, nium_withdrawal)
// and writes an entry to public.audit_logs for the change history.
//
// COMPLIANCE CHECK (Double-spread FX transparency): every change to the platform
// FX spread or MoMo withdrawal fee is logged with before/after values + actor.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  fx_spread_percentage?: number;       // e.g. 0.0075 (= 75 bps)
  momo_fixed_amount?: number;          // XAF
  momo_percentage_rate?: number;       // e.g. 0.01 (= 1%)
  momo_min_fee_amount?: number;        // XAF
  momo_max_fee_amount?: number | null; // XAF or null = no cap
  reason?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: userErr } = await svc.auth.getUser(auth.replace("Bearer ", ""));
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r: any) => r.role === "admin")) return json({ error: "forbidden" }, 403);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  // Validate
  const errors: string[] = [];
  if (body.fx_spread_percentage !== undefined) {
    if (!Number.isFinite(body.fx_spread_percentage) || body.fx_spread_percentage < 0 || body.fx_spread_percentage > 0.1) {
      errors.push("fx_spread_percentage must be between 0 and 0.1 (0%-10%)");
    }
  }
  if (body.momo_percentage_rate !== undefined && (body.momo_percentage_rate < 0 || body.momo_percentage_rate > 0.2)) {
    errors.push("momo_percentage_rate must be 0-0.2");
  }
  for (const k of ["momo_fixed_amount", "momo_min_fee_amount"] as const) {
    if (body[k] !== undefined && (!Number.isFinite(body[k]!) || body[k]! < 0)) {
      errors.push(`${k} must be ≥ 0`);
    }
  }
  if (body.momo_max_fee_amount !== undefined && body.momo_max_fee_amount !== null && body.momo_max_fee_amount < 0) {
    errors.push("momo_max_fee_amount must be ≥ 0 or null");
  }
  if (errors.length) return json({ error: "validation_failed", errors }, 400);

  // Helper to upsert a platform fee row + log
  async function applyChange(txType: "nium_fx_spread" | "nium_withdrawal", patch: Record<string, any>) {
    const { data: current } = await svc.from("fee_structures").select("*")
      .eq("transaction_type", txType).eq("fee_scope", "platform").eq("is_active", true)
      .order("effective_from", { ascending: false }).limit(1).maybeSingle();

    const before = current ?? null;
    const next = {
      transaction_type: txType,
      fee_scope: "platform" as const,
      fee_model: txType === "nium_fx_spread" ? "percentage" : "hybrid",
      is_active: true,
      effective_from: new Date().toISOString().slice(0, 10),
      updated_by: user!.id,
      updated_at: new Date().toISOString(),
      ...patch,
    };

    let saved;
    if (current) {
      const { data, error } = await svc.from("fee_structures").update(next).eq("id", current.id).select().single();
      if (error) throw new Error(error.message);
      saved = data;
    } else {
      const { data, error } = await svc.from("fee_structures").insert({ ...next, created_by: user!.id }).select().single();
      if (error) throw new Error(error.message);
      saved = data;
    }

    await svc.from("audit_logs").insert({
      action_type: "update",
      entity_type: "fee_structure_nium",
      entity_id: saved.id,
      performed_by: user!.id,
      details: { transaction_type: txType, reason: body.reason ?? null, before, after: saved },
    });
    return saved;
  }

  const results: Record<string, any> = {};
  try {
    if (body.fx_spread_percentage !== undefined) {
      results.fx_spread = await applyChange("nium_fx_spread", { percentage_rate: body.fx_spread_percentage });
    }
    const momoPatch: Record<string, any> = {};
    if (body.momo_fixed_amount !== undefined) momoPatch.fixed_amount = body.momo_fixed_amount;
    if (body.momo_percentage_rate !== undefined) momoPatch.percentage_rate = body.momo_percentage_rate;
    if (body.momo_min_fee_amount !== undefined) momoPatch.min_fee_amount = body.momo_min_fee_amount;
    if (body.momo_max_fee_amount !== undefined) momoPatch.max_fee_amount = body.momo_max_fee_amount;
    if (Object.keys(momoPatch).length) {
      results.momo = await applyChange("nium_withdrawal", momoPatch);
    }
  } catch (e) {
    return json({ error: "update_failed", message: String(e instanceof Error ? e.message : e) }, 500);
  }

  return json({ ok: true, updated: results }, 200);
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
