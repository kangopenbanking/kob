import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * GET /v1/payout-rails — List available payout rails
 *
 * Query params:
 *   destination_type: 'card' | 'bank' | 'momo' | 'paypal' (optional filter)
 *   speed: 'instant' | 'standard' (optional filter)
 *   currency: ISO 4217 code (optional filter)
 *   country: ISO 3166-1 alpha-2 (optional filter)
 *   amount: numeric (optional — filters by min/max)
 *
 * Returns: { data: Rail[], pagination: { total } }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({
        type: "https://kangopenbanking.com/errors/method-not-allowed",
        title: "Method Not Allowed",
        status: 405,
        detail: "Only GET is supported on this endpoint.",
        error_id: `err_${crypto.randomUUID().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
      }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } }
    );
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const destinationType = url.searchParams.get("destination_type");
    const speed = url.searchParams.get("speed");
    const currency = url.searchParams.get("currency");
    const country = url.searchParams.get("country");
    const amount = url.searchParams.get("amount");

    let query = supabaseAdmin
      .from("payout_rails")
      .select("*")
      .eq("is_active", true)
      .order("speed", { ascending: true })
      .order("estimated_time_seconds", { ascending: true });

    if (destinationType) query = query.eq("destination_type", destinationType);
    if (speed) query = query.eq("speed", speed);
    if (currency) query = query.contains("supported_currencies", [currency]);
    if (country) query = query.contains("supported_countries", [country]);

    const { data: rails, error } = await query;

    if (error) throw error;

    // Post-filter by amount if provided
    let filtered = rails || [];
    if (amount) {
      const amt = parseFloat(amount);
      filtered = filtered.filter(
        (r: any) => amt >= r.min_amount && amt <= r.max_amount
      );
    }

    // Enrich with availability status
    const now = new Date();
    const enriched = filtered.map((rail: any) => {
      const hours = rail.operating_hours || {};
      let available_now = true;

      if (!hours["24x7"]) {
        // Simple hour-based check (assumes Africa/Douala = UTC+1)
        const utcHour = now.getUTCHours();
        const localHour = utcHour + 1; // WAT = UTC+1
        const startHour = parseInt((hours.start || "08:00").split(":")[0]);
        const endHour = parseInt((hours.end || "17:00").split(":")[0]);
        available_now = localHour >= startHour && localHour < endHour;
      }

      // Calculate fee for given amount
      let estimated_fee = rail.fee_fixed;
      if (amount) {
        estimated_fee += parseFloat(amount) * (rail.fee_percentage / 100);
      }

      return {
        rail_code: rail.rail_code,
        rail_name: rail.rail_name,
        provider: rail.provider,
        channel: rail.channel,
        destination_type: rail.destination_type,
        speed: rail.speed,
        estimated_time_seconds: rail.estimated_time_seconds,
        estimated_time_human: formatTime(rail.estimated_time_seconds),
        available_now,
        supported_currencies: rail.supported_currencies,
        supported_countries: rail.supported_countries,
        min_amount: rail.min_amount,
        max_amount: rail.max_amount,
        fee: {
          fixed: rail.fee_fixed,
          percentage: rail.fee_percentage,
          currency: rail.fee_currency,
          estimated_total: Math.round(estimated_fee),
        },
        operating_hours: rail.operating_hours,
        requires_prefunding: rail.requires_prefunding,
        risk_tier: rail.risk_tier,
      };
    });

    return new Response(
      JSON.stringify({
        data: enriched,
        pagination: { total: enriched.length },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        type: "https://kangopenbanking.com/errors/internal",
        title: "Internal Server Error",
        status: 500,
        detail: "Failed to retrieve payout rails.",
        error_id: `err_${crypto.randomUUID().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } }
    );
  }
});

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  return `${Math.round(seconds / 86400)} days`;
}
