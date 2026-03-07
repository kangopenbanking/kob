import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { corsHeaders } from "../_shared/cors.ts";

/**
 * POST /v1/payouts/instant — Instant payout auto-router
 *
 * Automatically selects the fastest available rail based on destination_type,
 * currency, country, and amount. Falls back to standard speed if instant
 * rails are unavailable or lack float.
 *
 * Body:
 *   merchant_id: UUID (required for merchant-initiated)
 *   destination_type: 'card' | 'bank' | 'momo' (required)
 *   amount: number (required)
 *   currency: string (default 'XAF')
 *   country: string (default 'CM')
 *   speed: 'instant' | 'standard' | 'auto' (default 'auto')
 *   beneficiary: {
 *     name: string (required)
 *     account?: string (for bank)
 *     bank_code?: string (for bank)
 *     phone?: string (for momo)
 *     card_token?: string (for card)
 *     card_last4?: string (for card)
 *     card_network?: string (for card)
 *   }
 *   narration: string (optional)
 *   metadata: object (optional)
 *
 * Headers:
 *   Idempotency-Key: UUID (required)
 *   Authorization: Bearer <JWT>
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return error(405, "Only POST is supported.", "GW_001");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return error(401, "Missing Authorization header.", "AUTH_001");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return error(401, "Invalid or expired token.", "AUTH_002");

    // --- Idempotency ---
    const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");
    if (!idempotencyKey) return error(400, "Idempotency-Key header is required.", "GW_002");

    const { data: cached } = await supabase
      .from("idempotency_keys")
      .select("response_body, response_status")
      .eq("idempotency_key", idempotencyKey)
      .eq("endpoint", "gateway-instant-payout")
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify(cached.response_body), {
        status: cached.response_status || 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Idempotency-Replayed": "true" },
      });
    }

    // --- Parse ---
    const body = await req.json();
    const {
      merchant_id,
      destination_type,
      amount,
      currency = "XAF",
      country = "CM",
      speed = "auto",
      beneficiary,
      narration,
      metadata,
    } = body;

    if (!destination_type || !["card", "bank", "momo"].includes(destination_type)) {
      return error(400, "destination_type must be 'card', 'bank', or 'momo'.", "GW_003");
    }
    if (!amount || amount <= 0) return error(400, "amount must be positive.", "GW_004");
    if (!beneficiary || !beneficiary.name) return error(400, "beneficiary.name is required.", "GW_005");

    // --- Rail selection ---
    const { data: rails, error: railErr } = await supabase
      .from("payout_rails")
      .select("*")
      .eq("destination_type", destination_type)
      .eq("is_active", true)
      .contains("supported_currencies", [currency])
      .contains("supported_countries", [country])
      .order("estimated_time_seconds", { ascending: true });

    if (railErr || !rails || rails.length === 0) {
      return error(503, `No active payout rails available for ${destination_type} in ${country}/${currency}.`, "GW_006");
    }

    // Filter by amount bounds
    const eligible = rails.filter((r: any) => amount >= r.min_amount && amount <= r.max_amount);
    if (eligible.length === 0) {
      return error(422, `Amount ${amount} ${currency} is outside the supported range for all ${destination_type} rails.`, "GW_007", {
        available_ranges: rails.map((r: any) => ({ rail: r.rail_code, min: r.min_amount, max: r.max_amount })),
      });
    }

    // Speed preference
    let selectedRail: any = null;
    let selectedSpeed = speed;

    if (speed === "instant" || speed === "auto") {
      // Try instant rails first
      const instantRails = eligible.filter((r: any) => r.speed === "instant");

      for (const rail of instantRails) {
        if (rail.requires_prefunding) {
          const { data: floatData } = await supabase
            .from("treasury_float")
            .select("available_balance")
            .eq("rail_id", rail.id)
            .eq("currency", currency)
            .maybeSingle();

          if (floatData && floatData.available_balance >= amount) {
            selectedRail = rail;
            selectedSpeed = "instant";
            break;
          }
        } else {
          selectedRail = rail;
          selectedSpeed = "instant";
          break;
        }
      }

      // Fallback to standard if instant not available
      if (!selectedRail && speed === "instant") {
        return error(503, "No instant rail available with sufficient float. Use speed='auto' for automatic fallback.", "GW_008");
      }
    }

    if (!selectedRail) {
      // Pick fastest standard rail
      const standardRails = eligible.filter((r: any) => r.speed === "standard");
      selectedRail = standardRails[0] || eligible[0];
      selectedSpeed = "standard";
    }

    // --- Fee calculation ---
    const fee = Math.round(selectedRail.fee_fixed + amount * (selectedRail.fee_percentage / 100));
    const totalDebit = amount + fee;

    // --- Inline compliance ---
    const userId = body.user_id || user.id;
    const compliance = await screenCompliance(supabase, userId, amount, currency);
    if (compliance.decision === "deny") {
      return error(422, "Payout denied by compliance screening.", "GW_009", { risk_flags: compliance.risk_flags });
    }

    // --- Debit source ---
    if (merchant_id) {
      const { error: walletErr } = await supabase.rpc("update_merchant_wallet", {
        _merchant_id: merchant_id,
        _currency: currency,
        _available_delta: -totalDebit,
        _ledger_delta: -totalDebit,
      });
      if (walletErr) return error(422, "Insufficient merchant wallet balance.", "GW_010");
    }

    // --- Create payout ---
    const txRef = `ip_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const estimatedArrival = new Date(Date.now() + selectedRail.estimated_time_seconds * 1000).toISOString();

    // Determine channel and beneficiary fields
    let channel = selectedRail.channel;
    let beneficiaryAccount = beneficiary.account || beneficiary.phone || beneficiary.card_token || null;
    let beneficiaryBank = beneficiary.bank_code || null;
    let beneficiaryPhone = beneficiary.phone || null;

    const { data: payout, error: payoutErr } = await supabase
      .from("gateway_payouts")
      .insert({
        merchant_id: merchant_id || null,
        tx_ref: txRef,
        amount,
        currency,
        channel,
        provider: selectedRail.provider,
        status: "pending",
        speed: selectedSpeed,
        rail_id: selectedRail.id,
        estimated_arrival_at: estimatedArrival,
        beneficiary_name: beneficiary.name,
        beneficiary_account: beneficiaryAccount,
        beneficiary_bank: beneficiaryBank,
        beneficiary_phone: beneficiaryPhone,
        narration: narration || `Instant payout via ${selectedRail.rail_name}`,
        idempotency_key: idempotencyKey,
        fee_amount: fee,
        compliance_check_id: null,
        metadata: {
          ...(metadata || {}),
          routed_rail: selectedRail.rail_code,
          requested_speed: speed,
          actual_speed: selectedSpeed,
          compliance_decision: compliance.decision,
        },
      })
      .select()
      .single();

    if (payoutErr) {
      // Rollback
      if (merchant_id) {
        await supabase.rpc("update_merchant_wallet", {
          _merchant_id: merchant_id,
          _currency: currency,
          _available_delta: totalDebit,
          _ledger_delta: totalDebit,
        });
      }
      return error(500, "Failed to create payout record.", "GW_011");
    }

    // Reserve float if instant + prefunded
    if (selectedSpeed === "instant" && selectedRail.requires_prefunding) {
      await supabase.rpc("update_treasury_float_reserve", {
        _rail_id: selectedRail.id,
        _currency: currency,
        _amount: amount,
      }).catch(() => {
        // Non-critical: float reservation is best-effort, reconciliation handles discrepancies
        console.warn("Float reservation failed, will reconcile later");
      });

      // Fallback direct update if RPC doesn't exist
      const { data: currentFloat } = await supabase
        .from("treasury_float")
        .select("available_balance, reserved_balance")
        .eq("rail_id", selectedRail.id)
        .eq("currency", currency)
        .maybeSingle();

      if (currentFloat) {
        await supabase
          .from("treasury_float")
          .update({
            available_balance: currentFloat.available_balance - amount,
            reserved_balance: (currentFloat.reserved_balance || 0) + amount,
          })
          .eq("rail_id", selectedRail.id)
          .eq("currency", currency);
      }
    }

    // Update status to submitted
    await supabase
      .from("gateway_payouts")
      .update({
        status: "submitted",
        provider_raw: {
          provider: selectedRail.provider,
          rail: selectedRail.rail_code,
          submitted_at: new Date().toISOString(),
          note: `Routed to ${selectedRail.rail_name}. Awaiting provider confirmation.`,
        },
      })
      .eq("id", payout.id);

    // --- For card push, also create audit record ---
    if (destination_type === "card" && beneficiary.card_token) {
      await supabase.from("push_to_card_transactions").insert({
        payout_id: payout.id,
        merchant_id: merchant_id || null,
        user_id: userId,
        card_token: beneficiary.card_token,
        card_last4: beneficiary.card_last4 || "****",
        card_network: beneficiary.card_network || "visa",
        amount,
        currency,
        speed: selectedSpeed,
        provider: selectedRail.provider,
        status: "submitted",
        risk_score: compliance.risk_score,
        compliance_decision: compliance.decision,
        submitted_at: new Date().toISOString(),
      });
    }

    // --- Response ---
    const responseBody = {
      id: payout.id,
      tx_ref: txRef,
      status: "submitted",
      speed: selectedSpeed,
      rail: {
        code: selectedRail.rail_code,
        name: selectedRail.rail_name,
        provider: selectedRail.provider,
        estimated_time_seconds: selectedRail.estimated_time_seconds,
        estimated_time_human: formatTime(selectedRail.estimated_time_seconds),
      },
      amount,
      fee,
      total_debit: totalDebit,
      currency,
      beneficiary: {
        name: beneficiary.name,
        destination_type,
      },
      estimated_arrival_at: estimatedArrival,
      compliance: {
        decision: compliance.decision,
        risk_score: compliance.risk_score,
      },
      routing: {
        requested_speed: speed,
        actual_speed: selectedSpeed,
        fallback_used: speed === "auto" && selectedSpeed === "standard",
        rails_evaluated: eligible.length,
      },
      created_at: payout.created_at,
    };

    // Cache idempotency
    await supabase.from("idempotency_keys").insert({
      idempotency_key: idempotencyKey,
      endpoint: "gateway-instant-payout",
      request_hash: await hashPayload(JSON.stringify(body)),
      response_body: responseBody,
      response_status: 201,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return new Response(JSON.stringify(responseBody), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    });
  } catch (err) {
    console.error("Instant payout error:", err);
    return error(500, "Internal server error during instant payout.", "GW_099");
  }
});

// --- Helpers ---

function error(status: number, detail: string, code: string, extras?: Record<string, any>) {
  const titles: Record<number, string> = {
    400: "Bad Request", 401: "Unauthorized", 405: "Method Not Allowed",
    422: "Unprocessable Entity", 503: "Service Unavailable", 500: "Internal Server Error",
  };
  return new Response(
    JSON.stringify({
      type: `https://kangopenbanking.com/errors/${code.toLowerCase().replace(/_/g, "-")}`,
      title: titles[status] || "Error",
      status, detail,
      error_code: code,
      error_id: `err_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      ...(extras ? { details: extras } : {}),
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } }
  );
}

async function screenCompliance(supabase: any, userId: string, amount: number, currency: string) {
  try {
    const { data: riskScore } = await supabase.rpc("calculate_kyc_risk_score", { _user_id: userId });

    const { data: sanctions } = await supabase
      .from("sanctions_screening")
      .select("screening_status")
      .eq("user_id", userId)
      .in("screening_status", ["potential_match", "confirmed_match"])
      .limit(1);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("gateway_payouts")
      .select("*", { count: "exact", head: true })
      .eq("status", "submitted")
      .gte("created_at", since);

    const flags: string[] = [];
    let score = riskScore || 0;

    if (sanctions?.length) { flags.push("sanctions_match"); score += 50; }
    if ((count || 0) >= 10) { flags.push("high_velocity"); score += 20; }
    if (amount >= 5000000) { flags.push("high_value_payout"); score += 15; }

    let decision: "approve" | "review" | "deny" = "approve";
    if (score >= 70) decision = "deny";
    else if (score >= 40) decision = "review";

    return { decision, risk_score: Math.min(score, 100), risk_flags: flags };
  } catch {
    return { decision: "review" as const, risk_score: 50, risk_flags: ["compliance_error"] };
  }
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  return `${Math.round(seconds / 86400)} days`;
}

async function hashPayload(payload: string): Promise<string> {
  const data = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
