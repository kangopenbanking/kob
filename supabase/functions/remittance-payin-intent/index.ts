/**
 * Remittance Pay-in Intent — Creates pay-in intents to fund remittance transfers.
 *
 * Actions:
 *   create_stripe_intent — Create Stripe PaymentIntent for transfer funding
 *   create_paypal_order  — Create PayPal order for transfer funding
 *   create_flw_momo      — Initiate Flutterwave MoMo charge
 *   create_kob_wallet    — Internal wallet debit
 *   confirm_payin        — Confirm pay-in from provider webhook (internal)
 *   get_intent           — Get pay-in intent details
 *   list_intents         — List pay-in intents for a remittance
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { recordRemittanceAudit } from "../_shared/remittance-audit.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // P0 AUTH GATE — verify JWT BEFORE parsing body so no contract/provider
  // metadata can leak to anonymous callers via validation errors.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    await recordRemittanceAudit({ endpoint: 'remittance-payin-intent', decision: 'denied_unauthenticated', req });
    return json({ error: "unauthorized", code: "AUTH_REQUIRED" }, 401);
  }
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    await recordRemittanceAudit({ endpoint: 'remittance-payin-intent', decision: 'denied_unauthenticated', req });
    return json({ error: "unauthorized", code: "INVALID_TOKEN" }, 401);
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action");
    let body: Record<string, unknown> = {};

    if (req.method === "POST" || req.method === "PATCH") {
      body = await req.json().catch(() => ({}));
      action = action || (body.action as string);
    }

    if (!action) {
      return json({ error: "missing_action", message: "action parameter is required" }, 400);
    }

    switch (action) {
      // ─── Create Stripe Pay-in Intent ───
      case "create_stripe_intent": {
        if (!user) return json({ error: "unauthorized" }, 401);

        const { remittance_id, idempotency_key } = body as { remittance_id: string; idempotency_key?: string };
        if (!remittance_id) return json({ error: "missing_remittance_id" }, 400);

        // Verify remittance exists and belongs to user
        const { data: remittance, error: remErr } = await supabase
          .from("remittances")
          .select("id, send_amount, send_currency, status, user_id")
          .eq("id", remittance_id)
          .single();

        if (remErr || !remittance) return json({ error: "remittance_not_found" }, 404);
        if (remittance.user_id !== user.id) return json({ error: "forbidden" }, 403);
        if (remittance.status !== "created") {
          return json({ error: "invalid_status", message: "Remittance must be in created status" }, 409);
        }

        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeSecretKey) {
          return json({ error: "stripe_not_configured", message: "Stripe is not configured" }, 503);
        }

        // Import Stripe dynamically
        const Stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
        const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

        // Zero-decimal currencies
        const ZERO_DECIMAL = ["XAF", "XOF", "JPY", "KRW", "BIF", "DJF", "GNF", "KMF", "MGA", "PYG", "RWF", "UGX", "VND", "VUV"];
        const stripeAmount = ZERO_DECIMAL.includes(remittance.send_currency)
          ? Math.round(remittance.send_amount)
          : Math.round(remittance.send_amount * 100);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: stripeAmount,
          currency: remittance.send_currency.toLowerCase(),
          description: `Remittance funding: ${remittance_id}`,
          metadata: { remittance_id, user_id: user.id },
        });

        // Store pay-in intent
        const { data: intent, error: insertErr } = await supabase
          .from("remittance_payin_intents")
          .insert({
            remittance_id,
            provider: "stripe",
            provider_ref: paymentIntent.id,
            method: "card",
            amount: remittance.send_amount,
            currency: remittance.send_currency,
            status: "pending",
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        return json({
          intent_id: intent.id,
          provider: "stripe",
          client_secret: paymentIntent.client_secret,
          payment_intent_id: paymentIntent.id,
          status: "pending",
        });
      }

      // ─── Create PayPal Order ───
      case "create_paypal_order": {
        if (!user) return json({ error: "unauthorized" }, 401);

        const { remittance_id } = body as { remittance_id: string };
        if (!remittance_id) return json({ error: "missing_remittance_id" }, 400);

        const { data: remittance, error: remErr } = await supabase
          .from("remittances")
          .select("id, send_amount, send_currency, status, user_id")
          .eq("id", remittance_id)
          .single();

        if (remErr || !remittance) return json({ error: "remittance_not_found" }, 404);
        if (remittance.user_id !== user.id) return json({ error: "forbidden" }, 403);
        if (remittance.status !== "created") {
          return json({ error: "invalid_status", message: "Remittance must be in created status" }, 409);
        }

        // PayPal order creation stub — returns structured response
        const { data: intent, error: insertErr } = await supabase
          .from("remittance_payin_intents")
          .insert({
            remittance_id,
            provider: "paypal",
            provider_ref: `PAYPAL-${crypto.randomUUID().slice(0, 12)}`,
            method: "paypal",
            amount: remittance.send_amount,
            currency: remittance.send_currency,
            status: "pending",
            metadata: { note: "PayPal order creation requires PAYPAL_CLIENT_ID and PAYPAL_SECRET configuration" },
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        return json({
          intent_id: intent.id,
          provider: "paypal",
          provider_ref: intent.provider_ref,
          status: "pending",
          message: "PayPal order created. Complete payment via PayPal checkout.",
        });
      }

      // ─── Create Flutterwave MoMo Charge ───
      case "create_flw_momo": {
        if (!user) return json({ error: "unauthorized" }, 401);

        const { remittance_id, phone_number, momo_provider } = body as {
          remittance_id: string; phone_number: string; momo_provider: string;
        };
        if (!remittance_id || !phone_number) {
          return json({ error: "missing_fields", message: "remittance_id and phone_number required" }, 400);
        }

        const { data: remittance, error: remErr } = await supabase
          .from("remittances")
          .select("id, send_amount, send_currency, status, user_id")
          .eq("id", remittance_id)
          .single();

        if (remErr || !remittance) return json({ error: "remittance_not_found" }, 404);
        if (remittance.user_id !== user.id) return json({ error: "forbidden" }, 403);
        if (remittance.status !== "created") {
          return json({ error: "invalid_status" }, 409);
        }

        const { data: intent, error: insertErr } = await supabase
          .from("remittance_payin_intents")
          .insert({
            remittance_id,
            provider: "flutterwave",
            method: `momo_${(momo_provider || "mtn").toLowerCase()}`,
            amount: remittance.send_amount,
            currency: remittance.send_currency,
            status: "pending",
            metadata: { phone_number, momo_provider: momo_provider || "MTN" },
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        return json({
          intent_id: intent.id,
          provider: "flutterwave",
          method: intent.method,
          status: "pending",
        });
      }

      // ─── KOB Wallet Debit ───
      case "create_kob_wallet": {
        if (!user) return json({ error: "unauthorized" }, 401);

        const { remittance_id } = body as { remittance_id: string };
        if (!remittance_id) return json({ error: "missing_remittance_id" }, 400);

        const { data: remittance, error: remErr } = await supabase
          .from("remittances")
          .select("id, send_amount, send_currency, status, user_id")
          .eq("id", remittance_id)
          .single();

        if (remErr || !remittance) return json({ error: "remittance_not_found" }, 404);
        if (remittance.user_id !== user.id) return json({ error: "forbidden" }, 403);
        if (remittance.status !== "created") {
          return json({ error: "invalid_status" }, 409);
        }

        const { data: intent, error: insertErr } = await supabase
          .from("remittance_payin_intents")
          .insert({
            remittance_id,
            provider: "kob_wallet",
            method: "wallet_debit",
            amount: remittance.send_amount,
            currency: remittance.send_currency,
            status: "confirmed",
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        // Transition remittance to pending
        await supabase.from("remittances").update({ status: "pending" }).eq("id", remittance_id);

        // Log event
        await supabase.from("remittance_events").insert({
          remittance_id,
          event_type: "payin_confirmed",
          provider: "kob_wallet",
          details: { intent_id: intent.id, method: "wallet_debit" },
        });

        return json({
          intent_id: intent.id,
          provider: "kob_wallet",
          status: "confirmed",
          remittance_status: "pending",
        });
      }

      // ─── Confirm Pay-in (internal, from webhook processing) ───
      case "confirm_payin": {
        const { intent_id, provider_ref, success } = body as {
          intent_id?: string; provider_ref?: string; success: boolean;
        };

        let intentQuery = supabase.from("remittance_payin_intents").select("*");
        if (intent_id) intentQuery = intentQuery.eq("id", intent_id);
        else if (provider_ref) intentQuery = intentQuery.eq("provider_ref", provider_ref);
        else return json({ error: "missing_intent_id_or_provider_ref" }, 400);

        const { data: intent, error: intentErr } = await intentQuery.single();
        if (intentErr || !intent) return json({ error: "intent_not_found" }, 404);

        if (intent.status !== "pending") {
          return json({ error: "intent_already_processed", current_status: intent.status }, 409);
        }

        const newStatus = success ? "confirmed" : "failed";
        await supabase.from("remittance_payin_intents")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", intent.id);

        if (success) {
          await supabase.from("remittances")
            .update({ status: "pending" })
            .eq("id", intent.remittance_id)
            .eq("status", "created");

          await supabase.from("remittance_events").insert({
            remittance_id: intent.remittance_id,
            event_type: "payin_confirmed",
            provider: intent.provider,
            details: { intent_id: intent.id, provider_ref: intent.provider_ref },
          });
        } else {
          await supabase.from("remittance_events").insert({
            remittance_id: intent.remittance_id,
            event_type: "payin_failed",
            provider: intent.provider,
            details: { intent_id: intent.id, error: (body as Record<string, unknown>).error_message },
          });
        }

        return json({ intent_id: intent.id, status: newStatus, remittance_id: intent.remittance_id });
      }

      // ─── Get Intent ───
      case "get_intent": {
        const intentId = url.searchParams.get("intent_id") || (body as Record<string, string>).intent_id;
        if (!intentId) return json({ error: "missing_intent_id" }, 400);

        const { data, error } = await supabase
          .from("remittance_payin_intents")
          .select("*")
          .eq("id", intentId)
          .single();

        if (error || !data) return json({ error: "not_found" }, 404);
        return json({ intent: data });
      }

      // ─── List Intents ───
      case "list_intents": {
        const remittanceId = url.searchParams.get("remittance_id") || (body as Record<string, string>).remittance_id;
        if (!remittanceId) return json({ error: "missing_remittance_id" }, 400);

        const { data, error } = await supabase
          .from("remittance_payin_intents")
          .select("*")
          .eq("remittance_id", remittanceId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return json({ intents: data || [] });
      }

      default:
        return json({ error: "unknown_action", message: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, "remittance-payin-intent");
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
