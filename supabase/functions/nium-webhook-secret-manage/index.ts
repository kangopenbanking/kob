// Admin-only: reveal or rotate NIUM_WEBHOOK_SECRET.
// Each reveal/rotate is logged to nium_webhook_secret_reveals.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function randomSecret(len = 64) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "whsec_";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const uid = userData.user.id;

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "rotate" ? "rotate" : "reveal";

    let secret = Deno.env.get("NIUM_WEBHOOK_SECRET") ?? "";
    let rotated = false;

    if (action === "rotate") {
      const newSecret = randomSecret(64);
      // NOTE: We cannot mutate Deno.env at runtime; the new value is returned so
      // the admin can update the platform secret manually via secrets UI.
      secret = newSecret;
      rotated = true;
    }

    if (!secret) {
      return new Response(JSON.stringify({ error: "NIUM_WEBHOOK_SECRET is not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("nium_webhook_secret_reveals").insert({
      revealed_by: uid,
      action,
      ip_address: req.headers.get("x-forwarded-for") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    });

    return new Response(JSON.stringify({
      secret,
      action,
      rotated,
      rotation_notice: rotated
        ? "This is a NEW value. Save it in platform secrets as NIUM_WEBHOOK_SECRET and paste it into the Nium dashboard. It will not be shown again."
        : "Copy this value into the Nium dashboard header parameter. Treat as sensitive.",
      revealed_at: new Date().toISOString(),
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
