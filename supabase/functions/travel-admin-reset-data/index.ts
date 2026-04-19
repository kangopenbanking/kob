// Admin / merchant scoped travel data reset.
// Scope = "all" → admin only; deletes every travel row across the platform.
// Scope = "merchant" + merchant_id → admin OR the merchant owner can run.
// FK-safe order: tickets → bookings → trips → timetables → seating_plans → routes → services.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return j({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return j({ error: "Unauthorized" }, 401);

    const { scope = "merchant", merchant_id } = await req.json().catch(() => ({}));

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" as any });

    let serviceIds: string[] | null = null; // null = ALL services

    if (scope === "all") {
      if (!isAdmin) return j({ error: "Admin role required for full reset" }, 403);
    } else {
      if (!merchant_id) return j({ error: "merchant_id required" }, 400);
      // Verify ownership unless admin
      if (!isAdmin) {
        const { data: m } = await admin
          .from("gateway_merchants").select("user_id").eq("id", merchant_id).maybeSingle();
        if (!m || m.user_id !== user.id) return j({ error: "Forbidden" }, 403);
      }
      const { data: svcs } = await admin
        .from("travel_services").select("id").eq("merchant_id", merchant_id);
      serviceIds = (svcs || []).map((s: any) => s.id);
      if (serviceIds.length === 0) {
        return j({ success: true, scope: "merchant", deleted: { services: 0 }, note: "No services to delete" });
      }
    }

    const counts: Record<string, number> = {};

    // Resolve nested IDs to scope deletes
    const routeQ = admin.from("travel_routes").select("id");
    if (serviceIds) routeQ.in("service_id", serviceIds);
    const { data: routes } = await routeQ;
    const routeIds = (routes || []).map((r: any) => r.id);

    const tripQ = admin.from("travel_trips").select("id");
    if (routeIds.length) tripQ.in("route_id", routeIds);
    else if (serviceIds) tripQ.in("route_id", ["00000000-0000-0000-0000-000000000000"]);
    const { data: trips } = await tripQ;
    const tripIds = (trips || []).map((t: any) => t.id);

    const bookingQ = admin.from("travel_bookings").select("id");
    if (tripIds.length) bookingQ.in("trip_id", tripIds);
    else if (serviceIds) bookingQ.in("trip_id", ["00000000-0000-0000-0000-000000000000"]);
    const { data: bookings } = await bookingQ;
    const bookingIds = (bookings || []).map((b: any) => b.id);

    // Delete in FK-safe order
    const safeDelete = async (table: string, ids: string[] | null, key = "id") => {
      const q = admin.from(table).delete({ count: "exact" });
      if (ids === null) {
        // delete-all guard: only when scope === 'all'
        const { count } = await q.neq("id", "00000000-0000-0000-0000-000000000000");
        return count || 0;
      }
      if (ids.length === 0) return 0;
      const { count } = await q.in(key, ids);
      return count || 0;
    };

    if (scope === "all") {
      counts.tickets   = await safeDelete("travel_tickets", null);
      counts.bookings  = await safeDelete("travel_bookings", null);
      counts.trips     = await safeDelete("travel_trips", null);
      counts.timetables = await safeDelete("travel_timetables", null);
      counts.seating_plans = await safeDelete("travel_seating_plans", null);
      counts.routes    = await safeDelete("travel_routes", null);
      counts.services  = await safeDelete("travel_services", null);
    } else {
      counts.tickets       = await safeDelete("travel_tickets", bookingIds, "booking_id");
      counts.bookings      = await safeDelete("travel_bookings", bookingIds);
      counts.trips         = await safeDelete("travel_trips", tripIds);
      counts.timetables    = await safeDelete("travel_timetables", routeIds, "route_id");
      counts.seating_plans = await safeDelete("travel_seating_plans", serviceIds!, "service_id");
      counts.routes        = await safeDelete("travel_routes", routeIds);
      counts.services      = await safeDelete("travel_services", serviceIds!);
    }

    return j({ success: true, scope, merchant_id: merchant_id || null, deleted: counts });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] travel-admin-reset-data error:`, err);
    return j({ error: "Internal error", error_id: errorId, message: err?.message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
