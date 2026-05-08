// virtual-cards-health — preflight for Kora connectivity & config.
// Public diagnostics-safe (no secrets returned).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const checks = {
    secret_key_present: !!Deno.env.get("KORA_SECRET_KEY"),
    public_key_present: !!Deno.env.get("KORA_PUBLIC_KEY"),
    encryption_key_present: !!Deno.env.get("KORA_ENCRYPTION_KEY"),
    webhook_secret_present: !!Deno.env.get("KORA_WEBHOOK_SECRET"),
    base_url: Deno.env.get("KORA_BASE_URL") || "https://api.korapay.com/merchant/api/v1",
    reachable: false,
    latency_ms: null as number | null,
  };

  if (checks.secret_key_present) {
    const t0 = performance.now();
    try {
      const r = await fetch(`${checks.base_url.replace(/\/+$/, "")}/`, {
        method: "GET",
        headers: { Authorization: `Bearer ${Deno.env.get("KORA_SECRET_KEY")}` },
      });
      checks.reachable = r.status < 500;
      checks.latency_ms = Math.round(performance.now() - t0);
    } catch {
      checks.reachable = false;
    }
  }

  const healthy = checks.secret_key_present && checks.webhook_secret_present && checks.reachable;
  return new Response(JSON.stringify({ healthy, checks, timestamp: new Date().toISOString() }), {
    status: healthy ? 200 : 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
