// =====================================================================
// kora-webhook — Inbound Kora virtual card webhooks (authoritative).
// verify_jwt = false. Signature verified in code (HMAC-SHA256).
// Idempotent on (provider, event_id).
// =====================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyKoraSignature } from "../_shared/kora-client.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const raw = await req.text();
  const signature = req.headers.get("x-korapay-signature");
  const verified = await verifyKoraSignature(raw, signature);
  if (!verified) {
    console.warn("[kora-webhook] invalid signature");
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventId: string = payload?.id || payload?.event_id || crypto.randomUUID();
  const eventType: string = payload?.event || payload?.type || "unknown";
  const cardKoraId: string | undefined = payload?.data?.card_id || payload?.data?.virtual_card_id;

  // Find related local card
  let relatedCardId: string | null = null;
  if (cardKoraId) {
    const { data: c } = await supabase
      .from("virtual_cards").select("id").eq("kora_card_id", cardKoraId).maybeSingle();
    relatedCardId = c?.id ?? null;
  }

  // Insert event (UNIQUE on provider+event_id ensures idempotency)
  const { error: insErr } = await supabase
    .from("virtual_card_webhook_events")
    .insert({
      provider: "kora",
      event_id: eventId,
      event_type: eventType,
      payload,
      signature_verified: true,
      related_card_id: relatedCardId,
    });
  if (insErr && !String(insErr.message).includes("duplicate")) {
    console.error("[kora-webhook] insert failed", insErr);
    return new Response(JSON.stringify({ error: "insert_failed" }), { status: 500, headers: corsHeaders });
  }
  if (insErr) {
    // Already processed → idempotent ack
    return new Response(JSON.stringify({ ok: true, idempotent: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Apply side-effects per event type
  try {
    if (relatedCardId) {
      switch (eventType) {
        case "virtualcard.charge":
        case "virtualcard.refund":
          await supabase.from("card_transactions").insert({
            virtual_card_id: relatedCardId,
            amount: payload?.data?.amount ?? 0,
            currency: payload?.data?.currency ?? "USD",
            transaction_type: eventType.split(".")[1],
            status: "completed",
            metadata: payload,
          });
          break;
        case "virtualcard.decline":
          await supabase.from("card_transactions").insert({
            virtual_card_id: relatedCardId,
            amount: payload?.data?.amount ?? 0,
            currency: payload?.data?.currency ?? "USD",
            transaction_type: "decline",
            status: "failed",
            metadata: payload,
          });
          break;
        case "virtualcard.termination":
          await supabase.from("virtual_cards")
            .update({ status: "terminated", terminated_at: new Date().toISOString() })
            .eq("id", relatedCardId);
          break;
      }
    }
    await supabase.from("virtual_card_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "kora").eq("event_id", eventId);
  } catch (e) {
    await supabase.from("virtual_card_webhook_events")
      .update({ processing_error: e instanceof Error ? e.message : String(e) })
      .eq("provider", "kora").eq("event_id", eventId);
    console.error("[kora-webhook] processing failed", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
