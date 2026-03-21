import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "get_corridors":
        return await getCorridors(supabase, body);
      case "get_quote":
        return await getQuote(supabase, user, body);
      case "send":
        return await sendRemittance(supabase, user, body);
      case "cancel":
        return await cancelRemittance(supabase, user, body);
      case "track":
        return await trackRemittance(supabase, user, body);
      case "list_outbound":
        return await listOutbound(supabase, user, body);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("remittance-outbound error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Get available outbound corridors ─────────────────────────
async function getCorridors(supabase: any, body: any) {
  const { to_country } = body;
  let query = supabase
    .from("remittance_corridors")
    .select("*, remittance_partners(name, status), remittance_corridor_limits(*)")
    .eq("status", "active")
    .eq("from_country", "CM")
    .in("direction", ["outbound", "bidirectional"]);

  if (to_country) query = query.eq("to_country", to_country);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);
  return json({ corridors: data });
}

// ─── Get a quote for outbound transfer ───────────────────────
async function getQuote(supabase: any, user: any, body: any) {
  const { corridor_id, amount, currency_in = "XAF" } = body;
  if (!corridor_id || !amount) return json({ error: "corridor_id and amount required" }, 400);

  // Get corridor details
  const { data: corridor, error: cErr } = await supabase
    .from("remittance_corridors")
    .select("*, remittance_partners(name), remittance_corridor_limits(*)")
    .eq("id", corridor_id)
    .single();

  if (cErr || !corridor) return json({ error: "Corridor not found" }, 404);

  // Check limits
  const limits = corridor.remittance_corridor_limits?.[0];
  if (limits) {
    if (amount < (limits.per_transaction_min || 0)) {
      return json({ error: `Minimum amount is ${limits.per_transaction_min} ${currency_in}` }, 400);
    }
    if (amount > (limits.per_transaction_max || Infinity)) {
      return json({ error: `Maximum amount is ${limits.per_transaction_max} ${currency_in}` }, 400);
    }

    // Check daily usage
    const today = new Date().toISOString().split("T")[0];
    const { data: dailyUsage } = await supabase
      .from("remittance_usage_tracking")
      .select("total_amount")
      .eq("user_id", user.id)
      .eq("corridor_id", corridor_id)
      .eq("period_type", "daily")
      .eq("period_start", today)
      .maybeSingle();

    if (dailyUsage && (dailyUsage.total_amount + amount) > (limits.daily_max_amount || Infinity)) {
      return json({ error: "Daily transfer limit exceeded" }, 400);
    }
  }

  // Calculate FX and fees
  const fxRate = corridor.fees_model?.fx_rate || 1;
  const feePercent = corridor.fees_model?.fee_percent || 2.5;
  const fixedFee = corridor.fees_model?.fixed_fee || 0;
  const feeTotal = Math.round(amount * feePercent / 100) + fixedFee;
  const amountOut = Math.round((amount - feeTotal) * fxRate * 100) / 100;

  // Create quote record
  const { data: quote, error: qErr } = await supabase
    .from("remittance_quotes")
    .insert({
      partner_id: corridor.partner_id,
      corridor_id,
      amount_in: amount,
      currency_in,
      amount_out: amountOut,
      currency_out: corridor.to_currency || "XAF",
      fee_total: feeTotal,
      fx_rate: fxRate,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      quote_raw: { fee_percent: feePercent, fixed_fee: fixedFee, delivery_est_seconds: corridor.est_delivery_seconds },
    })
    .select()
    .single();

  if (qErr) return json({ error: qErr.message }, 500);

  return json({
    quote_id: quote.id,
    amount_in: amount,
    currency_in,
    amount_out: amountOut,
    currency_out: corridor.to_currency,
    fee_total: feeTotal,
    fx_rate: fxRate,
    expires_at: quote.expires_at,
    delivery_estimate_seconds: corridor.est_delivery_seconds,
    partner: corridor.remittance_partners?.name,
    corridor: `${corridor.from_country} → ${corridor.to_country}`,
  });
}

// ─── Send outbound remittance ────────────────────────────────
async function sendRemittance(supabase: any, user: any, body: any) {
  const {
    quote_id, corridor_id, amount, currency_in = "XAF",
    receiver_name, receiver_phone, receiver_email, receiver_country,
    receiver_bank_name, receiver_bank_code, receiver_account_number,
    receiver_mobile_wallet, delivery_method = "bank_transfer",
    purpose_code, narration,
  } = body;

  if (!corridor_id || !amount || !receiver_name) {
    return json({ error: "corridor_id, amount, and receiver_name required" }, 400);
  }

  // Get corridor
  const { data: corridor } = await supabase
    .from("remittance_corridors")
    .select("*, remittance_partners(name, id), remittance_corridor_limits(*)")
    .eq("id", corridor_id)
    .single();

  if (!corridor) return json({ error: "Corridor not found" }, 404);

  // Verify quote if provided
  let quoteData: any = null;
  if (quote_id) {
    const { data: q } = await supabase
      .from("remittance_quotes")
      .select("*")
      .eq("id", quote_id)
      .single();
    if (q && new Date(q.expires_at) > new Date()) {
      quoteData = q;
    }
  }

  const fxRate = quoteData?.fx_rate || corridor.fees_model?.fx_rate || 1;
  const feePercent = corridor.fees_model?.fee_percent || 2.5;
  const fixedFee = corridor.fees_model?.fixed_fee || 0;
  const feeTotal = quoteData?.fee_total || (Math.round(amount * feePercent / 100) + fixedFee);
  const amountOut = quoteData?.amount_out || Math.round((amount - feeTotal) * fxRate * 100) / 100;

  // Compliance check — basic limits
  const limits = corridor.remittance_corridor_limits?.[0];
  if (limits) {
    if (amount < (limits.per_transaction_min || 0)) return json({ error: "Below minimum" }, 400);
    if (amount > (limits.per_transaction_max || Infinity)) return json({ error: "Above maximum" }, 400);
  }

  // Get sender profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .single();

  const partnerRef = `KOB-OUT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const correlationId = crypto.randomUUID();

  // Create remittance record
  const { data: remittance, error: rErr } = await supabase
    .from("remittances")
    .insert({
      direction: "outbound",
      partner_id: corridor.partner_id,
      partner_reference: partnerRef,
      quote_id: quote_id || null,
      corridor_id,
      sender_name: profile?.full_name || user.email,
      sender_country: "CM",
      sender_phone: profile?.phone || null,
      sender_email: profile?.email || user.email,
      receiver_name,
      receiver_phone: receiver_phone || null,
      receiver_email: receiver_email || null,
      receiver_country: receiver_country || corridor.to_country,
      receiver_id: null,
      receiver_bank_name: receiver_bank_name || null,
      receiver_bank_code: receiver_bank_code || null,
      receiver_account_number: receiver_account_number || null,
      receiver_mobile_wallet: receiver_mobile_wallet || null,
      delivery_method,
      amount_in: amount,
      currency_in,
      amount_out: amountOut,
      currency_out: corridor.to_currency || "XAF",
      fee_total: feeTotal,
      fx_rate: fxRate,
      purpose_code: purpose_code || "personal",
      narration: narration || `Outbound transfer to ${receiver_name}`,
      destination_type: delivery_method === "mobile_wallet" ? "kob_wallet" : "bank_account",
      destination_ref: receiver_account_number || receiver_mobile_wallet || "",
      status: "created",
      compliance_status: "pending",
      correlation_id: correlationId,
      trace_id: correlationId,
    })
    .select()
    .single();

  if (rErr) return json({ error: rErr.message }, 500);

  // Create compliance check
  await supabase.from("remittance_compliance_checks").insert({
    remittance_id: remittance.id,
    check_type: "outbound_screening",
    status: amount >= 100000 ? "pending" : "auto_approved",
    risk_score: amount >= 500000 ? 50 : amount >= 100000 ? 25 : 5,
    screening_result: { auto_check: true, threshold: amount >= 100000 ? "manual_review" : "auto_pass" },
  });

  // Auto-approve low-risk transfers
  if (amount < 100000) {
    await supabase.from("remittances").update({
      status: "pending",
      compliance_status: "cleared",
      compliance_cleared_at: new Date().toISOString(),
    }).eq("id", remittance.id);

    await supabase.from("remittance_compliance_checks").update({
      status: "approved",
      resolved_at: new Date().toISOString(),
    }).eq("remittance_id", remittance.id);
  }

  // Log event
  await supabase.from("remittance_events").insert({
    remittance_id: remittance.id,
    event_type: "outbound_created",
    payload_raw: JSON.stringify({ sender: profile?.full_name, receiver: receiver_name, amount, delivery_method }),
    signature_valid: true,
  });

  // Update usage tracking
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 8) + "01";

  for (const [periodType, periodStart] of [["daily", today], ["monthly", monthStart]]) {
    await supabase.from("remittance_usage_tracking").upsert({
      user_id: user.id,
      corridor_id,
      period_type: periodType,
      period_start: periodStart,
      total_amount: amount,
      transaction_count: 1,
      currency: currency_in,
    }, { onConflict: "user_id,corridor_id,period_type,period_start" });
  }

  // Notify user
  await supabase.from("app_notifications").insert({
    user_id: user.id,
    type: "info",
    title: "Outbound Transfer Initiated",
    message: `Your transfer of ${amount.toLocaleString()} ${currency_in} to ${receiver_name} (${corridor.to_country}) has been submitted.`,
    icon: "send",
    metadata: { remittance_id: remittance.id, partner_ref: partnerRef },
  });

  return json({
    remittance_id: remittance.id,
    partner_reference: partnerRef,
    status: amount < 100000 ? "pending" : "created",
    compliance_status: amount < 100000 ? "cleared" : "pending",
    amount_in: amount,
    currency_in,
    amount_out: amountOut,
    currency_out: corridor.to_currency,
    fee_total: feeTotal,
    fx_rate: fxRate,
  }, 201);
}

// ─── Cancel outbound remittance ──────────────────────────────
async function cancelRemittance(supabase: any, user: any, body: any) {
  const { remittance_id, reason } = body;
  if (!remittance_id) return json({ error: "remittance_id required" }, 400);

  const { data: rem } = await supabase
    .from("remittances")
    .select("*")
    .eq("id", remittance_id)
    .single();

  if (!rem) return json({ error: "Not found" }, 404);
  if (!["created", "pending"].includes(rem.status)) {
    return json({ error: "Cannot cancel — transfer already processed" }, 400);
  }

  await supabase.from("remittances").update({
    status: "failed",
    cancellation_reason: reason || "User cancelled",
    cancelled_at: new Date().toISOString(),
  }).eq("id", remittance_id);

  await supabase.from("remittance_events").insert({
    remittance_id,
    event_type: "outbound_cancelled",
    payload_raw: JSON.stringify({ reason, cancelled_by: user.id }),
    signature_valid: true,
  });

  await supabase.from("app_notifications").insert({
    user_id: user.id,
    type: "warning",
    title: "Transfer Cancelled",
    message: `Your outbound transfer ${rem.partner_reference} has been cancelled.`,
    icon: "x-circle",
  });

  return json({ success: true, remittance_id });
}

// ─── Track a specific outbound remittance ────────────────────
async function trackRemittance(supabase: any, user: any, body: any) {
  const { remittance_id } = body;
  if (!remittance_id) return json({ error: "remittance_id required" }, 400);

  const { data: rem } = await supabase
    .from("remittances")
    .select("*, remittance_partners(name), remittance_corridors(from_country, to_country)")
    .eq("id", remittance_id)
    .single();

  if (!rem) return json({ error: "Not found" }, 404);

  const { data: events } = await supabase
    .from("remittance_events")
    .select("*")
    .eq("remittance_id", remittance_id)
    .order("created_at", { ascending: true });

  const { data: compliance } = await supabase
    .from("remittance_compliance_checks")
    .select("*")
    .eq("remittance_id", remittance_id);

  return json({ remittance: rem, events: events || [], compliance: compliance || [] });
}

// ─── List user's outbound remittances ────────────────────────
async function listOutbound(supabase: any, user: any, body: any) {
  const { status, limit = 50 } = body;

  let query = supabase
    .from("remittances")
    .select("*, remittance_partners(name)")
    .eq("direction", "outbound")
    .eq("sender_email", user.email)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);
  return json({ transfers: data || [] });
}
