// Daily cron: sends a `trip_reminder` notification 24h before departure
// to all customers with confirmed bookings on trips departing tomorrow.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const start = new Date(Date.now() + 22 * 3600_000).toISOString();
  const end = new Date(Date.now() + 26 * 3600_000).toISOString();

  const { data: trips } = await admin
    .from("travel_trips")
    .select("id")
    .gte("departure_at", start)
    .lte("departure_at", end)
    .in("status", ["scheduled", "boarding"]);

  if (!trips?.length) {
    return new Response(JSON.stringify({ ok: true, reminders_sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tripIds = trips.map((t: any) => t.id);
  const { data: bookings } = await admin
    .from("travel_bookings")
    .select("id")
    .in("trip_id", tripIds)
    .eq("booking_status", "confirmed");

  let sent = 0;
  for (const b of bookings || []) {
    try {
      await admin.functions.invoke("travel-booking-notification", {
        body: { booking_id: (b as any).id, event_type: "trip_reminder" },
      });
      sent++;
    } catch (e) {
      console.error("reminder error:", (b as any).id, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, reminders_sent: sent, trips: tripIds.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
