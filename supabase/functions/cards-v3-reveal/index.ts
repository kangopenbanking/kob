// =============================================================
// cards-v3-reveal — Short-lived PAN/CVV reveal token.
// Requires step-up MFA (checked via user_security_settings.step_up_verified_at
// within the last 5 minutes). Never persists PAN or CVV.
// =============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { issueRevealToken } from "../_shared/card-issuer.ts";

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const err = (c: string, m: string, s = 400) =>
  json({ type: `https://api.kangopenbanking.com/errors/${c}`, title: c, status: s, detail: m }, s);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const auth = req.headers.get("Authorization");
  if (!auth) return err("unauthorized", "missing auth", 401);
  const { data: { user } } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return err("unauthorized", "invalid token", 401);

  const body = await req.json().catch(() => ({}));
  if (!body.card_id) return err("card_validation_failed", "card_id required", 422);
  if (!body.step_up_token) return err("step_up_required", "step-up MFA verification required", 401);

  // Verify step-up token freshness (5 min TTL) via sca_challenges table
  const { data: sca } = await sb
    .from("sca_challenges")
    .select("id,verified_at,expires_at")
    .eq("id", body.step_up_token)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!sca?.verified_at) return err("step_up_required", "step-up not verified", 401);
  const ageMs = Date.now() - new Date(sca.verified_at).getTime();
  if (ageMs > 5 * 60_000) return err("step_up_expired", "step-up verification expired", 401);

  const { data: card } = await sb.from("virtual_cards").select("*").eq("id", body.card_id).maybeSingle();
  if (!card) return err("card_not_found", "card not found", 404);
  if (card.user_id !== user.id) return err("forbidden", "not your card", 403);

  const providerCardId = card.provider === "nium" ? card.nium_card_id : card.kora_card_id;
  if (!providerCardId) return err("card_provider_id_missing", "no provider card id", 500);

  try {
    const reveal = await issueRevealToken(card.provider, providerCardId);
    // Audit — no PAN/CVV, only the fact of reveal
    await sb.from("virtual_card_audit_log").insert({
      card_id: card.id,
      tenant_type: "platform",
      actor_user_id: user.id,
      actor_role: "customer",
      action: "card.revealed",
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });
    return json(reveal);
  } catch (e: any) {
    return err("card_provider_unavailable", e?.message ?? "reveal_failed", 502);
  }
});
