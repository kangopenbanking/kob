import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { sendManagedEmail, getUserName, getUserEmail } from "../_shared/send-managed-email.ts";
import { recordRemittanceAudit } from "../_shared/remittance-audit.ts";
import {
  reserveIdempotency,
  storeIdempotency,
  idempotencyResponse,
  sha256,
  validateIdempotencyKey,
} from "../_shared/integration-layer/idempotency.ts";

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
        return await sendRemittance(supabase, user, body, req);
      case "cancel":
        return await cancelRemittance(supabase, user, body);
      case "track":
        return await trackRemittance(supabase, user, body);
      case "list_outbound":
        return await listOutbound(supabase, user, body);
      case "compliance_decision":
        return await complianceDecision(supabase, user, body);
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
    .eq("is_active", true)
    .eq("from_country", "CM")
    .in("direction", ["outbound", "bidirectional"]);

  if (to_country) query = query.eq("to_country", to_country);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const corridors = (data || []).filter((corridor: any) => corridor.remittance_partners?.status === "active");
  return json({ corridors });
}

// ─── Get a quote for outbound transfer ───────────────────────
async function getQuote(supabase: any, user: any, body: any) {
  const { corridor_id, amount, currency_in = "XAF" } = body;
  if (!corridor_id || !amount) return json({ error: "corridor_id and amount required" }, 400);

  const { data: corridor, error: cErr } = await supabase
    .from("remittance_corridors")
    .select("*, remittance_partners(name), remittance_corridor_limits(*)")
    .eq("id", corridor_id)
    .single();

  if (cErr || !corridor) return json({ error: "Corridor not found" }, 404);

  const limits = corridor.remittance_corridor_limits?.[0];
  if (limits) {
    if (amount < (limits.per_transaction_min || 0)) {
      return json({ error: `Minimum amount is ${limits.per_transaction_min} ${currency_in}` }, 400);
    }
    if (amount > (limits.per_transaction_max || Infinity)) {
      return json({ error: `Maximum amount is ${limits.per_transaction_max} ${currency_in}` }, 400);
    }

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

  const fxRate = corridor.fees_model?.fx_rate || 1;
  // Fee resolution: unified admin-managed fee_structures.
  // Admin edits to `remittance_outbound` in /admin/fee-management apply here live.
  const { resolveFee } = await import('../_shared/resolve-fee.ts');
  const quote = await resolveFee(supabase, {
    transaction_type: 'remittance_outbound',
    amount,
    fallback: {
      percentage_rate: Number(corridor.fees_model?.fee_percent ?? 2.5),
      fixed_amount: Number(corridor.fees_model?.fixed_fee ?? 0),
    },
  });
  const feeTotal = Math.round(quote.final_fee);
  const feePercent = quote.percentage_rate || Number(corridor.fees_model?.fee_percent ?? 2.5);
  const fixedFee = quote.fixed_amount || Number(corridor.fees_model?.fixed_fee ?? 0);
  const amountOut = Math.round((amount - feeTotal) * fxRate * 100) / 100;

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
async function sendRemittance(supabase: any, user: any, body: any, req?: Request) {
  // ─── Idempotency-Key gate (UUID v4) ─────────────────────────
  const headerKey = req?.headers.get("Idempotency-Key")?.trim() || null;
  let commitIdem: ((status: number, payload: unknown) => Promise<void>) | null = null;
  if (headerKey) {
    const invalid = validateIdempotencyKey(headerKey);
    if (invalid) {
      const resp = idempotencyResponse(invalid, corsHeaders)!;
      await recordRemittanceAudit({ endpoint: 'remittance-outbound', action: 'send', decision: 'denied_idempotency', userId: user?.id, req, metadata: { reason: invalid.reason } });
      return resp;
    }
    const requestHash = await sha256(JSON.stringify(body));
    const reservation = await reserveIdempotency({
      key: headerKey,
      merchantId: user?.id ?? null,
      resource: "remittance.outbound.send",
      requestHash,
    });
    if (reservation.kind !== "miss") {
      const resp = idempotencyResponse(reservation, corsHeaders);
      if (resp) {
        await recordRemittanceAudit({ endpoint: 'remittance-outbound', action: 'send', decision: 'denied_idempotency', userId: user?.id, req, metadata: { kind: reservation.kind } });
        return resp;
      }
    }
    commitIdem = async (status, payload) => storeIdempotency({
      key: headerKey, merchantId: user?.id ?? null, resource: "remittance.outbound.send",
      requestHash, status, body: payload as Record<string, unknown>,
    });
  }

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

  const { data: corridor } = await supabase
    .from("remittance_corridors")
    .select("*, remittance_partners(name, id), remittance_corridor_limits(*)")
    .eq("id", corridor_id)
    .single();

  if (!corridor) return json({ error: "Corridor not found" }, 404);

  // ─── F3 fix: KYC gate (was entirely absent) ─────────────────
  // Cross-border outflow requires at least one approved KYC verification on file.
  const { data: kyc } = await supabase
    .from("kyc_verifications")
    .select("id, status")
    .eq("user_id", user.id)
    .in("status", ["approved", "verified"])
    .limit(1)
    .maybeSingle();
  if (!kyc) {
    return json({
      error: "kyc_required",
      error_code: "RMT_KYC_001",
      message: "KYC verification is required before initiating an outbound remittance.",
    }, 403);
  }

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

  // ─── F8 fix: FX peg fallback ────────────────────────────────
  // XAF/XOF are pegged to EUR at 655.957 (CEMAC/UEMOA monetary union, fixed).
  // Previously `|| 1` allowed a ~655× pricing error if corridor.fees_model.fx_rate was missing.
  const PEG_XAF_PER_EUR = 655.957;
  function fallbackFxRate(from: string, to: string): number | null {
    const f = (from || "").toUpperCase();
    const t = (to || "").toUpperCase();
    if ((f === "XAF" || f === "XOF") && t === "EUR") return 1 / PEG_XAF_PER_EUR;
    if (f === "EUR" && (t === "XAF" || t === "XOF")) return PEG_XAF_PER_EUR;
    if ((f === "XAF" || f === "XOF") && (t === "XAF" || t === "XOF")) return 1;
    return null;
  }
  const corridorOutCurrency = corridor.to_currency || "XAF";
  const pegRate = fallbackFxRate(currency_in, corridorOutCurrency);
  const fxRate = quoteData?.fx_rate
    ?? corridor.fees_model?.fx_rate
    ?? pegRate
    ?? null;
  if (fxRate == null || fxRate <= 0) {
    return json({
      error: "fx_rate_unavailable",
      error_code: "RMT_FX_001",
      message: `No FX rate available for ${currency_in} → ${corridorOutCurrency}. Provide a valid quote_id or configure corridor.fees_model.fx_rate.`,
    }, 422);
  }
  const feePercent = corridor.fees_model?.fee_percent || 2.5;
  const fixedFee = corridor.fees_model?.fixed_fee || 0;
  const feeTotal = quoteData?.fee_total || (Math.round(amount * feePercent / 100) + fixedFee);
  const amountOut = quoteData?.amount_out || Math.round((amount - feeTotal) * fxRate * 100) / 100;

  const limits = corridor.remittance_corridor_limits?.[0];
  if (limits) {
    if (amount < (limits.per_transaction_min || 0)) return json({ error: "Below minimum" }, 400);
    if (amount > (limits.per_transaction_max || Infinity)) return json({ error: "Above maximum" }, 400);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone_number")
    .eq("id", user.id)
    .single();

  const partnerRef = `KOB-OUT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const correlationId = crypto.randomUUID();

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
      sender_phone: profile?.phone_number || null,
      sender_email: profile?.email || user.email,
      sender_user_id: user.id,
      receiver_name,
      receiver_phone: receiver_phone || null,
      receiver_email: receiver_email || null,
      receiver_country: receiver_country || corridor.to_country,
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

    // Auto-fulfill: trigger payout rail immediately
    try {
      await supabase.functions.invoke("remittance-fulfill", {
        body: { remittance_id: remittance.id },
      });
    } catch (fulfillErr: any) {
      console.error("Auto-fulfill failed (non-blocking):", fulfillErr?.message);
    }
  }

  // Log event
  await supabase.from("remittance_events").insert({
    remittance_id: remittance.id,
    event_type: "outbound_created",
    payload_raw: JSON.stringify({ sender: profile?.full_name, receiver: receiver_name, amount, delivery_method }),
    signature_valid: true,
  });

  // Usage tracking via atomic RPC
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 8) + "01";
  for (const [periodType, periodStart] of [["daily", today], ["monthly", monthStart]] as const) {
    await supabase.rpc("increment_remittance_usage", {
      _user_id: user.id,
      _corridor_id: corridor_id,
      _period_type: periodType,
      _period_start: periodStart,
      _amount: amount,
      _currency: currency_in,
    });
  }

  // In-app notification
  await supabase.from("app_notifications").insert({
    user_id: user.id,
    type: "info",
    title: "Outbound Transfer Initiated",
    message: `Your transfer of ${amount.toLocaleString()} ${currency_in} to ${receiver_name} (${corridor.to_country}) has been submitted.`,
    icon: "send",
    metadata: { remittance_id: remittance.id, partner_ref: partnerRef },
  });

  // Email notification
  const senderEmail = profile?.email || user.email;
  if (senderEmail) {
    await sendManagedEmail(supabase, {
      email_key: "remittance_outbound_created",
      recipient_email: senderEmail,
      variables: {
        customer_name: profile?.full_name || "Customer",
        amount_in: new Intl.NumberFormat("fr-CM").format(amount),
        currency_in,
        amount_out: new Intl.NumberFormat("fr-CM").format(amountOut),
        currency_out: corridor.to_currency || "XAF",
        receiver_name,
        receiver_country: receiver_country || corridor.to_country,
        partner_reference: partnerRef,
        delivery_method: (delivery_method || "bank_transfer").replace(/_/g, " "),
        fee_total: new Intl.NumberFormat("fr-CM").format(feeTotal),
      },
    });
  }

  const responseBody = {
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
  };
  if (commitIdem) await commitIdem(200, responseBody);
  await recordRemittanceAudit({
    endpoint: 'remittance-outbound', action: 'send', decision: 'allowed',
    userId: user.id, remittanceId: remittance.id, req,
    metadata: { amount, currency_in, delivery_method, partner_reference: partnerRef },
  });
  return json(responseBody);
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
    .eq("sender_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    // Fallback to email-based query for backward compatibility
    let fallbackQuery = supabase
      .from("remittances")
      .select("*, remittance_partners(name)")
      .eq("direction", "outbound")
      .eq("sender_email", user.email)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) fallbackQuery = fallbackQuery.eq("status", status);
    const { data: fbData, error: fbErr } = await fallbackQuery;
    if (fbErr) return json({ error: fbErr.message }, 500);
    return json({ transfers: fbData || [] });
  }
  return json({ transfers: data || [] });
}

// ─── Compliance Decision (admin) ─────────────────────────────
async function complianceDecision(supabase: any, user: any, body: any) {
  const { check_id, decision, note, remittance_id } = body;
  if (!check_id || !decision || !remittance_id) {
    return json({ error: "check_id, decision, and remittance_id required" }, 400);
  }
  if (!["approved", "rejected"].includes(decision)) {
    return json({ error: "decision must be approved or rejected" }, 400);
  }

  // Verify admin role
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "Admin access required" }, 403);

  // Get remittance
  const { data: rem } = await supabase.from("remittances").select("*").eq("id", remittance_id).single();
  if (!rem) return json({ error: "Remittance not found" }, 404);

  // Update compliance check
  await supabase.from("remittance_compliance_checks").update({
    status: decision,
    notes: note || null,
    resolved_at: new Date().toISOString(),
    resolved_by: user.id,
  }).eq("id", check_id);

  // Update remittance status
  if (decision === "approved") {
    await supabase.from("remittances").update({
      status: "pending",
      compliance_status: "cleared",
      compliance_cleared_at: new Date().toISOString(),
    }).eq("id", remittance_id);

    // F9 fix: fulfill failure was previously swallowed, leaving remittances stuck cleared-but-not-paid.
    // We now record the failure as an event, alert the sender, and flag the remittance for cron retry.
    try {
      const { error: invokeErr } = await supabase.functions.invoke("remittance-fulfill", {
        body: { remittance_id },
      });
      if (invokeErr) throw invokeErr;
    } catch (fulfillErr: any) {
      const msg = fulfillErr?.message || String(fulfillErr);
      console.error("Post-compliance fulfill failed — queued for retry:", msg);
      await supabase.from("remittances").update({
        status: "fulfillment_retry",
        cancellation_reason: `auto-retry: ${msg}`.slice(0, 500),
      }).eq("id", remittance_id);
      await supabase.from("remittance_events").insert({
        remittance_id,
        event_type: "fulfillment_failed",
        payload_raw: JSON.stringify({ error: msg, source: "post_compliance" }),
        signature_valid: true,
      });
      // Best-effort operator alert
      await supabase.from("audit_logs").insert({
        action_type: "remittance_fulfillment_failed",
        entity_type: "remittance",
        entity_id: remittance_id,
        performed_by: user.id,
        details: { error: msg, requires_manual_retry: true },
      }).then(() => {}).catch(() => {});
    }
  } else {
    await supabase.from("remittances").update({
      status: "failed",
      compliance_status: "rejected",
      cancellation_reason: note || "Compliance review rejected",
      cancelled_at: new Date().toISOString(),
    }).eq("id", remittance_id);
  }

  // Log event
  await supabase.from("remittance_events").insert({
    remittance_id,
    event_type: decision === "approved" ? "compliance_approved" : "compliance_rejected",
    payload_raw: JSON.stringify({ decision, note, reviewed_by: user.id }),
    signature_valid: true,
  });

  // Audit log
  await supabase.from("audit_logs").insert({
    action_type: `remittance_compliance_${decision}`,
    entity_type: "remittance",
    entity_id: remittance_id,
    performed_by: user.id,
    details: { check_id, decision, note, partner_reference: rem.partner_reference, amount: rem.amount_in },
  });

  // Notify sender
  const senderId = rem.sender_user_id;
  if (senderId) {
    await supabase.from("app_notifications").insert({
      user_id: senderId,
      type: decision === "approved" ? "success" : "warning",
      title: decision === "approved" ? "Transfer Approved" : "Transfer Rejected",
      message: decision === "approved"
        ? `Your outbound transfer ${rem.partner_reference} has been approved and is being processed.`
        : `Your outbound transfer ${rem.partner_reference} has been rejected. ${note || "Contact support for details."}`,
      icon: decision === "approved" ? "check-circle" : "x-circle",
      metadata: { remittance_id },
    });

    // Email notification
    const senderEmail = await getUserEmail(supabase, senderId);
    const senderName = await getUserName(supabase, senderId);
    if (senderEmail) {
      await sendManagedEmail(supabase, {
        email_key: decision === "approved" ? "remittance_outbound_approved" : "remittance_outbound_rejected",
        recipient_email: senderEmail,
        variables: {
          customer_name: senderName,
          partner_reference: rem.partner_reference,
          amount_in: new Intl.NumberFormat("fr-CM").format(rem.amount_in),
          currency_in: rem.currency_in,
          receiver_name: rem.receiver_name,
          rejection_reason: note || "Compliance review",
        },
      });
    }
  }

  return json({ success: true, decision });
}
