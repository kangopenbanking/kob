// Daily Needs — Store upsert (merchant onboarding / settings)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  id: z.string().uuid().optional(),
  merchant_id: z.string().uuid(),
  vertical: z.enum(["food", "pharmacy"]),
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  logo_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
  contact_phone: z.string().min(7).max(20).optional(),
  address: z.string().max(500).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  delivery_radius_km: z.number().positive().max(50).default(5),
  preparation_time_min: z.number().int().positive().max(240).default(20),
  opening_hours: z.record(z.any()).default({}),
  status: z.enum(["draft", "active", "paused", "suspended"]).default("draft"),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return json(401, { error: "unauthorized" });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_body", details: parsed.error.flatten() });
  const b = parsed.data;

  // Verify merchant ownership
  const { data: merchant } = await supabase
    .from("gateway_merchants")
    .select("id, user_id")
    .eq("id", b.merchant_id)
    .maybeSingle();
  if (!merchant || merchant.user_id !== user.id) {
    return json(403, { error: "not_merchant_owner" });
  }

  const row = { ...b };
  const { data, error } = b.id
    ? await supabase.from("daily_needs_stores").update(row).eq("id", b.id).select().single()
    : await supabase.from("daily_needs_stores").insert(row).select().single();

  if (error) return json(500, { error: "upsert_failed", details: error.message });
  return json(200, { store: data });
});
