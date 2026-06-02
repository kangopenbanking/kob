// DDN — Cron job. Flags accepted assignments where the driver has not picked
// up the order within the admin-configured window, and dispatches push
// notifications. Idempotent via the trigger's idempotency_key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { notifyUserPush, isDriverPushEnabled, getDriverUserId } from "../_shared/ddn-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export async function handleMissedPickupCron(req: Request, sb: any): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1) flag in-app via SECURITY DEFINER function (returns # of inserted rows)
  const { data: flagged, error } = await sb.rpc("ddn_flag_missed_pickups");
  if (error) return json(500, { ok: false, error: error.message });

  // 2) optionally push for each driver currently in the missed window.
  let pushed = 0;
  try {
    const pushEnabled = await isDriverPushEnabled(sb, "missed_pickup");
    if (pushEnabled) {
      const { data: stuck } = await sb
        .from("ddn_assignments")
        .select("id, driver_id, assigned_at")
        .eq("status", "accepted")
        .is("picked_up_at", null)
        .not("driver_id", "is", null);
      for (const a of (stuck ?? []) as any[]) {
        const userId = await getDriverUserId(sb, a.driver_id);
        if (!userId) continue;
        await notifyUserPush({
          user_id: userId,
          title: "Pickup window missed",
          message: "Please head to the pickup location now or the order may be reassigned.",
          url: `/app/driver/active/${a.id}`,
          data: { assignment_id: a.id, kind: "ddn.pickup.missed" },
        });
        pushed += 1;
      }
    }
  } catch (e) { console.error("missed push fanout", e); }

  return json(200, { ok: true, flagged_count: flagged ?? 0, pushed });
}

Deno.serve((req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return handleMissedPickupCron(req, sb);
});
