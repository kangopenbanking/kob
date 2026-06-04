// Public-safe KYC config for mobile/PWA apps.
// Returns informational flags only — the backend always makes the routing decision.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const json = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await supabase.from("kyc_feature_flags").select("flag_key, is_enabled, rollout_percentage, country_codes");
  const flags: Record<string, unknown> = {};
  for (const row of data ?? []) flags[row.flag_key] = {
    enabled: row.is_enabled,
    rollout: row.rollout_percentage,
    countries: row.country_codes,
  };
  return json({
    provider_default: flags["youverify.global"] && (flags["youverify.global"] as { enabled: boolean }).enabled ? "youverify" : "self_hosted",
    flags,
    client_recommendations: {
      timeout_ms: 45_000,
      show_provider_in_ui: false,
      retry_on_timeout: true,
    },
    server_authoritative: true,
  });
});
