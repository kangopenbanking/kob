import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Treasury Float Management API
 *
 * GET  ?action=balance           — Float balance per rail (all or filtered)
 * GET  ?action=utilization       — Float utilization stats
 * GET  ?action=ledger&rail_id=X  — Float ledger history
 * GET  ?action=alerts            — Unresolved float alerts
 * POST action=replenish          — Manual float replenishment
 * POST action=adjust             — Manual float adjustment (admin correction)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Auth — admin only
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return err(401, "Missing Authorization header.", "TREAS_001");

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return err(401, "Invalid or expired token.", "TREAS_002");

  // Check admin role
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return err(403, "Treasury API requires admin role.", "TREAS_003");

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const action = url.searchParams.get("action") || "balance";

      if (action === "balance") {
        return await getFloatBalances(supabase, url);
      } else if (action === "utilization") {
        return await getUtilization(supabase);
      } else if (action === "ledger") {
        return await getLedger(supabase, url);
      } else if (action === "alerts") {
        return await getAlerts(supabase);
      }
      return err(400, `Unknown action: ${action}`, "TREAS_004");
    }

    if (req.method === "POST") {
      const body = await req.json();
      const action = body.action;

      if (action === "replenish") {
        return await replenishFloat(supabase, body, user.id);
      } else if (action === "adjust") {
        return await adjustFloat(supabase, body, user.id);
      }
      return err(400, `Unknown action: ${action}`, "TREAS_005");
    }

    return err(405, "Method not allowed.", "TREAS_006");
  } catch (e) {
    console.error("Treasury error:", e);
    return err(500, "Internal server error.", "TREAS_099");
  }
});

// ——— GET: Float Balances ———

async function getFloatBalances(supabase: any, url: URL) {
  const railCode = url.searchParams.get("rail_code");
  const currency = url.searchParams.get("currency");

  let query = supabase
    .from("treasury_float")
    .select("*, payout_rails!inner(rail_code, rail_name, provider, speed, is_active)");

  if (railCode) query = query.eq("payout_rails.rail_code", railCode);
  if (currency) query = query.eq("currency", currency);

  const { data, error } = await query;
  if (error) throw error;

  const enriched = (data || []).map((f: any) => ({
    id: f.id,
    rail: {
      code: f.payout_rails.rail_code,
      name: f.payout_rails.rail_name,
      provider: f.payout_rails.provider,
      speed: f.payout_rails.speed,
      is_active: f.payout_rails.is_active,
    },
    currency: f.currency,
    available_balance: f.available_balance,
    reserved_balance: f.reserved_balance,
    total_balance: f.available_balance + f.reserved_balance,
    total_funded: f.total_funded,
    total_disbursed: f.total_disbursed,
    low_balance_threshold: f.low_balance_threshold,
    is_low: f.available_balance <= f.low_balance_threshold,
    auto_replenish: f.auto_replenish,
    last_replenished_at: f.last_replenished_at,
    updated_at: f.updated_at,
  }));

  return json({ data: enriched, pagination: { total: enriched.length } });
}

// ——— GET: Utilization ———

async function getUtilization(supabase: any) {
  const { data: floats } = await supabase
    .from("treasury_float")
    .select("*, payout_rails!inner(rail_code, rail_name, speed)");

  // Last 24h settlement stats
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRuns } = await supabase
    .from("settlement_runs")
    .select("*")
    .gte("started_at", since)
    .order("started_at", { ascending: false });

  const totalAvailable = (floats || []).reduce((s: number, f: any) => s + f.available_balance, 0);
  const totalReserved = (floats || []).reduce((s: number, f: any) => s + f.reserved_balance, 0);
  const totalFunded = (floats || []).reduce((s: number, f: any) => s + f.total_funded, 0);
  const totalDisbursed = (floats || []).reduce((s: number, f: any) => s + f.total_disbursed, 0);
  const lowBalanceRails = (floats || []).filter((f: any) => f.available_balance <= f.low_balance_threshold);

  const last24hSettled = (recentRuns || []).reduce((s: number, r: any) => s + (r.total_settled_amount || 0), 0);
  const last24hFees = (recentRuns || []).reduce((s: number, r: any) => s + (r.total_fees_collected || 0), 0);

  return json({
    summary: {
      total_available_balance: totalAvailable,
      total_reserved_balance: totalReserved,
      total_balance: totalAvailable + totalReserved,
      total_lifetime_funded: totalFunded,
      total_lifetime_disbursed: totalDisbursed,
      utilization_rate: totalFunded > 0 ? Math.round((totalDisbursed / totalFunded) * 10000) / 100 : 0,
      rails_count: (floats || []).length,
      low_balance_rails_count: lowBalanceRails.length,
    },
    last_24h: {
      settled_amount: last24hSettled,
      fees_collected: last24hFees,
      settlement_runs: (recentRuns || []).length,
    },
    low_balance_rails: lowBalanceRails.map((f: any) => ({
      rail: f.payout_rails.rail_code,
      currency: f.currency,
      available: f.available_balance,
      threshold: f.low_balance_threshold,
    })),
  });
}

// ——— GET: Ledger ———

async function getLedger(supabase: any, url: URL) {
  const railId = url.searchParams.get("rail_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = supabase
    .from("treasury_float_ledger")
    .select("*, payout_rails!inner(rail_code, rail_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (railId) query = query.eq("rail_id", railId);

  const { data, count, error } = await query;
  if (error) throw error;

  return json({
    data: data || [],
    pagination: { total: count || 0, limit, offset, has_more: (offset + limit) < (count || 0) },
  });
}

// ——— GET: Alerts ———

async function getAlerts(supabase: any) {
  const { data, error } = await supabase
    .from("treasury_float_alerts")
    .select("*, payout_rails!inner(rail_code, rail_name)")
    .eq("is_resolved", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return json({ data: data || [], count: (data || []).length });
}

// ——— POST: Replenish ———

async function replenishFloat(supabase: any, body: any, adminId: string) {
  const { rail_id, currency = "XAF", amount, notes } = body;

  if (!rail_id) return err(400, "rail_id is required.", "TREAS_010");
  if (!amount || amount <= 0) return err(400, "amount must be positive.", "TREAS_011");

  // Get current float
  const { data: floatRow, error: fErr } = await supabase
    .from("treasury_float")
    .select("*")
    .eq("rail_id", rail_id)
    .eq("currency", currency)
    .maybeSingle();

  if (fErr || !floatRow) return err(404, "Float account not found for this rail/currency.", "TREAS_012");

  const balanceBefore = floatRow.available_balance;
  const balanceAfter = balanceBefore + amount;

  // Update float
  const { error: updateErr } = await supabase
    .from("treasury_float")
    .update({
      available_balance: balanceAfter,
      total_funded: floatRow.total_funded + amount,
      last_replenished_at: new Date().toISOString(),
    })
    .eq("id", floatRow.id);

  if (updateErr) throw updateErr;

  // Ledger entry
  await supabase.from("treasury_float_ledger").insert({
    float_id: floatRow.id,
    rail_id,
    currency,
    entry_type: "replenish",
    amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    reference_type: "manual",
    notes: notes || "Manual replenishment by admin",
    performed_by: adminId,
  });

  // Resolve any low-balance alerts
  await supabase
    .from("treasury_float_alerts")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("float_id", floatRow.id)
    .eq("is_resolved", false);

  return json({
    message: "Float replenished successfully.",
    float_id: floatRow.id,
    rail_id,
    currency,
    amount_added: amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    replenished_at: new Date().toISOString(),
  }, 200);
}

// ——— POST: Adjust ———

async function adjustFloat(supabase: any, body: any, adminId: string) {
  const { rail_id, currency = "XAF", amount, direction = "credit", notes } = body;

  if (!rail_id) return err(400, "rail_id is required.", "TREAS_020");
  if (!amount || amount <= 0) return err(400, "amount must be positive.", "TREAS_021");
  if (!["credit", "debit"].includes(direction)) return err(400, "direction must be 'credit' or 'debit'.", "TREAS_022");

  const { data: floatRow, error: fErr } = await supabase
    .from("treasury_float")
    .select("*")
    .eq("rail_id", rail_id)
    .eq("currency", currency)
    .maybeSingle();

  if (fErr || !floatRow) return err(404, "Float account not found.", "TREAS_023");

  const balanceBefore = floatRow.available_balance;
  const delta = direction === "credit" ? amount : -amount;
  const balanceAfter = balanceBefore + delta;

  if (balanceAfter < 0) return err(422, "Adjustment would result in negative balance.", "TREAS_024");

  await supabase
    .from("treasury_float")
    .update({ available_balance: balanceAfter })
    .eq("id", floatRow.id);

  await supabase.from("treasury_float_ledger").insert({
    float_id: floatRow.id,
    rail_id,
    currency,
    entry_type: "adjustment",
    amount: delta,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    reference_type: "manual",
    notes: notes || `Manual ${direction} adjustment by admin`,
    performed_by: adminId,
  });

  return json({
    message: "Float adjusted successfully.",
    float_id: floatRow.id,
    direction,
    amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
  });
}

// ——— Helpers ———

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(status: number, detail: string, code: string) {
  const titles: Record<number, string> = {
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 405: "Method Not Allowed", 422: "Unprocessable Entity",
    500: "Internal Server Error",
  };
  return new Response(
    JSON.stringify({
      type: `https://kangopenbanking.com/errors/${code.toLowerCase().replace(/_/g, "-")}`,
      title: titles[status] || "Error",
      status, detail,
      error_code: code,
      error_id: `err_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } },
  );
}
