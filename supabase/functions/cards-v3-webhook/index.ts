// =============================================================
// cards-v3-webhook — Normalized ingestion for Nium + Kora card events.
// HMAC-SHA256 verified (x-nium-signature or x-korapay-signature).
// Replay-safe: dedupes on event_id (24-hour TTL) via virtual_card_webhook_events.
// =============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ctEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  const niumSig = req.headers.get("x-nium-signature") || req.headers.get("x-nium-signature-key");
  const koraSig = req.headers.get("x-korapay-signature");

  let provider: "nium" | "kora" | null = null;
  let verified = false;

  if (niumSig) {
    provider = "nium";
    const secret = Deno.env.get("NIUM_WEBHOOK_SECRET") ?? "";
    if (secret) {
      const expected = await hmacHex(secret, raw);
      verified = ctEq(niumSig, expected) || ctEq(niumSig, secret);
    }
  } else if (koraSig) {
    provider = "kora";
    const secret = Deno.env.get("KORA_WEBHOOK_SECRET") ?? "";
    if (secret) {
      const expected = await hmacHex(secret, raw);
      verified = ctEq(koraSig, expected);
    }
  }

  if (!provider || !verified) {
    return json({ error: "invalid_signature" }, 401);
  }

  const payload = JSON.parse(raw || "{}");
  const eventId = payload.eventId || payload.id || payload.event_id ||
    payload.data?.reference || payload.data?.card_id || crypto.randomUUID();
  const eventType = payload.event || payload.eventType || payload.type || "card.event";
  const cardRef = payload.data?.card_id || payload.data?.cardHashId || payload.cardHashId;

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Dedupe
  const { data: existing } = await sb
    .from("virtual_card_webhook_events")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();
  if (existing) return json({ received: true, duplicate: true });

  // Resolve related card
  let relatedCardId: string | null = null;
  if (cardRef) {
    const col = provider === "nium" ? "nium_card_id" : "kora_card_id";
    const { data: c } = await sb.from("virtual_cards").select("id").eq(col, cardRef).maybeSingle();
    relatedCardId = c?.id ?? null;
  }

  await sb.from("virtual_card_webhook_events").insert({
    event_id: eventId,
    provider,
    event_type: eventType,
    payload,
    related_card_id: relatedCardId,
    processed_at: new Date().toISOString(),
  });

  return json({ received: true });
});
