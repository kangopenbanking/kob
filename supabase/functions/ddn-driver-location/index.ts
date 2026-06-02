// DDN — Driver pushes their live GPS location. Used by customer tracking map.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const Body = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed_kmh: z.number().min(0).max(300).optional(),
  accuracy_m: z.number().min(0).max(10000).optional(),
});
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return json(401, { error: "unauthorized" });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });

  const { data: driver } = await sb.from("ddn_drivers").select("id").eq("user_id", user.id).maybeSingle();
  if (!driver) return json(404, { error: "driver_not_found" });

  const { error } = await sb.from("ddn_driver_locations").upsert({
    driver_id: driver.id,
    lat: parsed.data.lat, lng: parsed.data.lng,
    heading: parsed.data.heading ?? null,
    speed_kmh: parsed.data.speed_kmh ?? null,
    accuracy_m: parsed.data.accuracy_m ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "driver_id" });
  if (error) return json(500, { error: "location_update_failed", details: error.message });
  await sb.from("ddn_drivers").update({ last_seen_at: new Date().toISOString() }).eq("id", driver.id);
  return json(200, { ok: true });
});
