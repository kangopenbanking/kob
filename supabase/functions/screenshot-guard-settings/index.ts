/**
 * screenshot-guard-settings — runtime opacity config for the
 * ScreenshotGuard watermark overlay used in the Consumer and Banking
 * PWAs.
 *
 *   GET  → public; returns { light_opacity, dark_opacity, updated_at }.
 *   POST → admin-only; upserts the singleton row.
 *
 * Per the project's Direct Backend Mandate, this is reached at
 * https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/screenshot-guard-settings
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const json = (d: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });

const clamp = (n: unknown, fallback: number) => {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("screenshot_guard_settings")
      .select("light_opacity, dark_opacity, updated_at")
      .eq("id", "global")
      .maybeSingle();
    if (error) return json({ error: "read_failed", detail: error.message }, 500);
    return json(data ?? { light_opacity: 0.05, dark_opacity: 0.03, updated_at: null });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Verify caller is an admin.
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u.user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: u.user.id,
    _role: "admin",
  });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const light = clamp(body.light_opacity, 0.05);
  const dark = clamp(body.dark_opacity, 0.03);

  const { data, error } = await admin
    .from("screenshot_guard_settings")
    .upsert({
      id: "global",
      light_opacity: light,
      dark_opacity: dark,
      updated_at: new Date().toISOString(),
      updated_by: u.user.id,
    })
    .select("light_opacity, dark_opacity, updated_at")
    .single();

  if (error) return json({ error: "write_failed", detail: error.message }, 500);
  return json(data);
});
