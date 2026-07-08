// Kang Agent — Notify cron
// Inserts 'due_soon' notifications for active subscriptions renewing within the next 3 days.
// Skips users who already received a due_soon notification for the same current_period_end.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: due, error } = await admin
    .from("kang_subscriptions")
    .select("user_id, current_period_end")
    .eq("status", "active")
    .gte("current_period_end", now.toISOString())
    .lte("current_period_end", in3d.toISOString());

  if (error) return json(500, { error: "fetch_failed", detail: error.message });

  let inserted = 0;
  for (const row of due ?? []) {
    const periodEnd = row.current_period_end as string;
    // Dedupe: skip if we already posted a due_soon notice for this period end
    const { data: existing } = await admin
      .from("kang_notifications")
      .select("id")
      .eq("user_id", row.user_id)
      .eq("type", "due_soon")
      .contains("metadata", { current_period_end: periodEnd })
      .maybeSingle();
    if (existing) continue;

    const days = Math.max(
      1,
      Math.ceil((new Date(periodEnd).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    );

    await admin.from("kang_notifications").insert({
      user_id: row.user_id,
      type: "due_soon",
      title: "Subscription renewal coming up",
      message: `Your Kang Agent Premium renews in ${days} day${days === 1 ? "" : "s"}. Make sure your wallet has enough funds.`,
      metadata: { current_period_end: periodEnd, days_until_renewal: days },
    });
    inserted++;
  }

  return json(200, { processed: (due ?? []).length, inserted, ran_at: now.toISOString() });
});
