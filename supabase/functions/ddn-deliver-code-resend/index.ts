// DDN — Driver requests a new delivery verification code after a failed match.
// Rate-limited per (driver, assignment) and per driver-hour. All requests are
// logged in ddn_code_resend_log for audit purposes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Body = z.object({
  assignment_id: z.string().regex(UUID),
  reason: z.string().min(3).max(200).optional(),
});
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Rate limits
const MAX_PER_ASSIGNMENT = 3;
const MAX_PER_HOUR = 8;

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
  const { assignment_id, reason } = parsed.data;

  const { data: a } = await sb
    .from("ddn_assignments")
    .select("id, status, order_id, driver_id, ddn_drivers!ddn_assignments_driver_id_fkey(user_id), daily_needs_orders!inner(delivery_code, status)")
    .eq("id", assignment_id).maybeSingle();
  if (!a) return json(404, { error: "assignment_not_found" });
  if ((a as any).ddn_drivers?.user_id !== user.id) return json(403, { error: "not_assigned_driver" });
  if (!["picked_up", "on_the_way", "arriving"].includes(a.status)) {
    return json(409, { error: "invalid_status", current: a.status });
  }

  // Rate limit checks
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: assignCount }, { count: hourCount }] = await Promise.all([
    sb.from("ddn_code_resend_log").select("id", { count: "exact", head: true }).eq("assignment_id", assignment_id),
    sb.from("ddn_code_resend_log").select("id", { count: "exact", head: true }).eq("driver_id", a.driver_id!).gte("created_at", since),
  ]);
  if ((assignCount ?? 0) >= MAX_PER_ASSIGNMENT) {
    return json(429, { error: "rate_limited", scope: "assignment", limit: MAX_PER_ASSIGNMENT });
  }
  if ((hourCount ?? 0) >= MAX_PER_HOUR) {
    return json(429, { error: "rate_limited", scope: "hourly", limit: MAX_PER_HOUR });
  }

  // Generate new 4-digit code
  const newCode = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const previousCode = String((a as any).daily_needs_orders?.delivery_code ?? "");
  const [prevHash, newHash] = await Promise.all([sha256(previousCode), sha256(newCode)]);

  const { error: uErr } = await sb.from("daily_needs_orders")
    .update({ delivery_code: newCode }).eq("id", a.order_id);
  if (uErr) return json(500, { error: "rotate_failed", details: uErr.message });

  await sb.from("ddn_code_resend_log").insert({
    assignment_id, order_id: a.order_id, driver_id: a.driver_id,
    requested_by: user.id, reason: reason ?? null,
    previous_code_hash: prevHash, new_code_hash: newHash,
    ip_address: req.headers.get("x-forwarded-for") ?? null,
  });

  return json(200, {
    ok: true,
    message: "new_code_issued",
    customer_will_see_new_code: true,
    remaining_attempts: Math.max(0, MAX_PER_ASSIGNMENT - ((assignCount ?? 0) + 1)),
  });
});
