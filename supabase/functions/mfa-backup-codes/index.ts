// MFA Backup Codes: generate, list (status), and verify single-use codes.
// Codes are 10 chars (base32-ish), shown once on generation, stored as SHA-256.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const CODE_LEN = 10;
const CODE_COUNT = 10;

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

function normalize(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

async function logEvent(admin: ReturnType<typeof createClient>, status: string, user_id: string, error?: string) {
  await admin.rpc("log_notification_event", {
    _channel: "sms",
    _status: status,
    _provider: "mfa_backup",
    _template_name: "mfa_backup_code",
    _user_id: user_id,
    _error_message: error ?? null,
  }).then(() => {}, () => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "status");

    if (action === "generate") {
      // Invalidate prior unused codes
      await admin.from("mfa_backup_codes")
        .update({ used_at: new Date().toISOString(), used_ip: "rotated" })
        .eq("user_id", user.id).is("used_at", null);

      const plaintext: string[] = [];
      const rows: Array<{ user_id: string; code_hash: string }> = [];
      for (let i = 0; i < CODE_COUNT; i++) {
        const c = generateCode();
        plaintext.push(c);
        rows.push({ user_id: user.id, code_hash: await sha256(normalize(c)) });
      }
      const { error: insErr } = await admin.from("mfa_backup_codes").insert(rows);
      if (insErr) throw insErr;
      await logEvent(admin, "sent", user.id);
      return new Response(JSON.stringify({ ok: true, codes: plaintext, count: CODE_COUNT }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data, error } = await admin.from("mfa_backup_codes")
        .select("id, used_at, created_at, expires_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const remaining = (data ?? []).filter(r => !r.used_at && new Date(r.expires_at) > new Date()).length;
      return new Response(JSON.stringify({ ok: true, remaining, total: data?.length ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const code = normalize(String(body.code ?? ""));
      if (code.length !== CODE_LEN) {
        return new Response(JSON.stringify({ ok: false, error: "invalid_format" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const hash = await sha256(code);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

      // Atomic redemption: only succeeds if unused and not expired
      const { data: redeemed, error: rErr } = await admin
        .from("mfa_backup_codes")
        .update({ used_at: new Date().toISOString(), used_ip: ip })
        .eq("user_id", user.id)
        .eq("code_hash", hash)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();

      if (rErr) throw rErr;
      if (!redeemed) {
        await logEvent(admin, "failed", user.id, "invalid_or_used");
        return new Response(JSON.stringify({ ok: false, error: "invalid_or_used" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await logEvent(admin, "delivered", user.id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mfa-backup-codes error", e);
    return new Response(JSON.stringify({ error: "internal_error", detail: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
