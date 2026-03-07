import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { corsHeaders } from "../_shared/cors.ts";

/**
 * POST /v1/payouts/card/push — Visa Direct / Mastercard Send push-to-card payout
 *
 * Body:
 *   merchant_id: UUID (required for merchant-initiated)
 *   user_id: UUID (required for consumer-initiated)
 *   card_token: string (tokenized card reference)
 *   card_last4: string
 *   card_network: 'visa' | 'mastercard'
 *   amount: number
 *   currency: string (default 'XAF')
 *   narration: string (optional)
 *   metadata: object (optional)
 *
 * Headers:
 *   Idempotency-Key: UUID (required)
 *   Authorization: Bearer <JWT>
 *
 * This function:
 *   1. Validates the request
 *   2. Runs inline compliance screening
 *   3. Checks treasury float availability
 *   4. Routes to Visa Direct or Mastercard Send
 *   5. Records the transaction
 *   6. Debits merchant wallet or account balance
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        type: "https://kangopenbanking.com/errors/method-not-allowed",
        title: "Method Not Allowed",
        status: 405,
        detail: "Only POST is supported.",
        error_id: `err_${crypto.randomUUID().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
      }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(401, "Missing Authorization header", "AUTH_001");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return errorResponse(401, "Invalid or expired token", "AUTH_002");
    }

    // --- Idempotency ---
    const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      return errorResponse(400, "Idempotency-Key header is required for push-to-card payouts.", "PISP_010");
    }

    const { data: existingKey } = await supabaseAdmin
      .from("idempotency_keys")
      .select("response_body, response_status")
      .eq("idempotency_key", idempotencyKey)
      .eq("endpoint", "gateway-push-to-card")
      .maybeSingle();

    if (existingKey) {
      return new Response(JSON.stringify(existingKey.response_body), {
        status: existingKey.response_status || 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "Idempotency-Replayed": "true",
        },
      });
    }

    // --- Parse body ---
    const body = await req.json();
    const {
      merchant_id,
      card_token,
      card_last4,
      card_network,
      amount,
      currency = "XAF",
      narration,
      metadata,
    } = body;

    // Validation
    if (!card_token || !card_last4 || !card_network) {
      return errorResponse(400, "card_token, card_last4, and card_network are required.", "PISP_011");
    }
    if (!["visa", "mastercard"].includes(card_network)) {
      return errorResponse(400, "card_network must be 'visa' or 'mastercard'.", "PISP_012");
    }
    if (!amount || amount <= 0) {
      return errorResponse(400, "amount must be a positive number.", "PISP_013");
    }

    // --- Select rail ---
    const railCode = card_network === "visa" ? "visa_direct" : "mc_send";
    const { data: rail, error: railError } = await supabaseAdmin
      .from("payout_rails")
      .select("*")
      .eq("rail_code", railCode)
      .eq("is_active", true)
      .maybeSingle();

    if (railError || !rail) {
      return errorResponse(503, `${card_network} push-to-card rail is not currently available.`, "PISP_014");
    }

    // Amount bounds check
    if (amount < rail.min_amount || amount > rail.max_amount) {
      return errorResponse(422, `Amount must be between ${rail.min_amount} and ${rail.max_amount} ${currency}.`, "PISP_015", {
        min_amount: rail.min_amount,
        max_amount: rail.max_amount,
      });
    }

    // --- Treasury float check (prefunding) ---
    const { data: floatData } = await supabaseAdmin
      .from("treasury_float")
      .select("available_balance")
      .eq("rail_id", rail.id)
      .eq("currency", currency)
      .maybeSingle();

    const fee = Math.round(rail.fee_fixed + amount * (rail.fee_percentage / 100));
    const totalDebit = amount + fee;

    if (!floatData || floatData.available_balance < amount) {
      return errorResponse(503, "Insufficient float balance for instant card payout. Please try standard speed.", "PISP_016", {
        available_float: floatData?.available_balance || 0,
        required: amount,
      });
    }

    // --- Inline compliance screening ---
    const userId = body.user_id || user.id;
    const screeningResult = await runComplianceScreen(supabaseAdmin, userId, amount, currency);
    if (screeningResult.decision === "deny") {
      return errorResponse(422, "Payout denied by compliance screening.", "PISP_017", {
        risk_flags: screeningResult.risk_flags,
      });
    }

    // --- Debit merchant wallet or account balance ---
    if (merchant_id) {
      const { error: walletError } = await supabaseAdmin.rpc("update_merchant_wallet", {
        _merchant_id: merchant_id,
        _currency: currency,
        _available_delta: -totalDebit,
        _ledger_delta: -totalDebit,
      });
      if (walletError) {
        return errorResponse(422, "Failed to debit merchant wallet.", "PISP_018");
      }
    }

    // --- Create payout record ---
    const txRef = `ptc_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const estimatedArrival = new Date(Date.now() + rail.estimated_time_seconds * 1000).toISOString();

    const { data: payout, error: payoutError } = await supabaseAdmin
      .from("gateway_payouts")
      .insert({
        merchant_id: merchant_id || null,
        tx_ref: txRef,
        amount,
        currency,
        channel: "card_push",
        provider: rail.provider,
        status: "pending",
        speed: "instant",
        rail_id: rail.id,
        estimated_arrival_at: estimatedArrival,
        beneficiary_name: card_last4,
        narration: narration || `Push-to-card ${card_network} ****${card_last4}`,
        idempotency_key: idempotencyKey,
        fee_amount: fee,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (payoutError) {
      // Rollback merchant wallet
      if (merchant_id) {
        await supabaseAdmin.rpc("update_merchant_wallet", {
          _merchant_id: merchant_id,
          _currency: currency,
          _available_delta: totalDebit,
          _ledger_delta: totalDebit,
        });
      }
      return errorResponse(500, "Failed to create payout record.", "PISP_019");
    }

    // --- Create push-to-card audit record ---
    const { error: ptcError } = await supabaseAdmin
      .from("push_to_card_transactions")
      .insert({
        payout_id: payout.id,
        merchant_id: merchant_id || null,
        user_id: userId,
        card_token,
        card_last4,
        card_network,
        amount,
        currency,
        speed: "instant",
        provider: rail.provider,
        status: screeningResult.decision === "review" ? "review" : "submitted",
        risk_score: screeningResult.risk_score || 0,
        compliance_decision: screeningResult.decision,
        submitted_at: new Date().toISOString(),
      });

    if (ptcError) {
      console.error("Failed to create push-to-card audit record:", ptcError);
    }

    // --- Reserve float ---
    await supabaseAdmin
      .from("treasury_float")
      .update({
        available_balance: floatData.available_balance - amount,
        reserved_balance: (floatData as any).reserved_balance
          ? (floatData as any).reserved_balance + amount
          : amount,
      })
      .eq("rail_id", rail.id)
      .eq("currency", currency);

    // --- Simulate provider submission ---
    // In production, this would call Visa Direct / Mastercard Send API
    // For now, mark as submitted and rely on webhook/polling for completion
    const providerSimulation = {
      provider: rail.provider,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      note: `${rail.rail_name} integration pending. Transaction queued for processing.`,
    };

    await supabaseAdmin
      .from("gateway_payouts")
      .update({
        status: "submitted",
        provider_raw: providerSimulation,
      })
      .eq("id", payout.id);

    // --- Build response ---
    const responseBody = {
      id: payout.id,
      tx_ref: txRef,
      status: "submitted",
      speed: "instant",
      rail: {
        code: rail.rail_code,
        name: rail.rail_name,
        provider: rail.provider,
      },
      amount,
      fee: fee,
      total_debit: totalDebit,
      currency,
      card: {
        last4: card_last4,
        network: card_network,
      },
      estimated_arrival_at: estimatedArrival,
      compliance: {
        decision: screeningResult.decision,
        risk_score: screeningResult.risk_score,
      },
      created_at: payout.created_at,
    };

    // Cache idempotency
    await supabaseAdmin.from("idempotency_keys").insert({
      idempotency_key: idempotencyKey,
      endpoint: "gateway-push-to-card",
      request_hash: await hashPayload(JSON.stringify(body)),
      response_body: responseBody,
      response_status: 201,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return new Response(JSON.stringify(responseBody), {
      status: 201,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
    });
  } catch (err) {
    console.error("Push-to-card error:", err);
    return errorResponse(500, "Internal server error during push-to-card payout.", "PISP_099");
  }
});

// --- Helpers ---

function errorResponse(status: number, detail: string, code: string, extras?: Record<string, any>) {
  return new Response(
    JSON.stringify({
      type: `https://kangopenbanking.com/errors/${code.toLowerCase().replace(/_/g, "-")}`,
      title: status === 400 ? "Bad Request" : status === 401 ? "Unauthorized" : status === 422 ? "Unprocessable Entity" : status === 503 ? "Service Unavailable" : "Internal Server Error",
      status,
      detail,
      error_code: code,
      error_id: `err_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      ...(extras ? { details: extras } : {}),
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } }
  );
}

async function runComplianceScreen(supabase: any, userId: string, amount: number, currency: string) {
  try {
    // Check KYC risk score
    const { data: riskScore } = await supabase.rpc("calculate_kyc_risk_score", { _user_id: userId });

    // Check sanctions
    const { data: sanctions } = await supabase
      .from("sanctions_screening")
      .select("screening_status")
      .eq("user_id", userId)
      .in("screening_status", ["potential_match", "confirmed_match"])
      .limit(1);

    // Check 24h velocity
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("push_to_card_transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);

    const risk_flags: string[] = [];
    let score = riskScore || 0;

    if (sanctions && sanctions.length > 0) {
      risk_flags.push("sanctions_match");
      score += 50;
    }
    if ((recentCount || 0) >= 5) {
      risk_flags.push("high_velocity");
      score += 20;
    }
    if (amount >= 2000000) {
      risk_flags.push("high_value");
      score += 15;
    }

    let decision: "approve" | "review" | "deny" = "approve";
    if (score >= 70) decision = "deny";
    else if (score >= 40) decision = "review";

    return { decision, risk_score: Math.min(score, 100), risk_flags };
  } catch {
    // Fail-open with review flag if compliance check errors
    return { decision: "review" as const, risk_score: 50, risk_flags: ["compliance_error"] };
  }
}

async function hashPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
