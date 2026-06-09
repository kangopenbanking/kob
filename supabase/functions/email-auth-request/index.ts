// Centralized, rate-limited, audited email-auth flows:
//   - signup (email verification)
//   - magic (passwordless magic link)
//   - resend (signup confirmation)
//   - admin_magic (restricted to users with admin role)
//
// Limits (per email): 5 attempts / 10 min, 30 min block.
// Limits (per IP):    20 attempts / 10 min, 60 min block.
// Failure block:      5 failures => 30 min block.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Action = "signup" | "magic" | "resend" | "admin_magic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") ?? "";
  return (xf.split(",")[0] || req.headers.get("cf-connecting-ip") || "0.0.0.0").trim();
}

const PER_EMAIL = { max: 5, window: 600, maxFailures: 5, block: 30 };
const PER_IP = { max: 20, window: 600, maxFailures: 10, block: 60 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let payload: any;
  try { payload = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  const action = String(payload?.action ?? "") as Action;
  const email = String(payload?.email ?? "").trim().toLowerCase();
  const password = typeof payload?.password === "string" ? payload.password : undefined;
  const accountType = payload?.accountType === "institution" ? "institution" : "user";
  const orgName = typeof payload?.organizationName === "string" ? payload.organizationName.trim() : undefined;
  const externalProvider = typeof payload?.externalProvider === "string" ? payload.externalProvider : undefined;
  const externalId = typeof payload?.externalId === "string" ? payload.externalId : undefined;
  const redirectTo = typeof payload?.redirectTo === "string" ? payload.redirectTo : undefined;

  if (!["signup", "magic", "resend", "admin_magic"].includes(action)) {
    return json(400, { error: "invalid_action" });
  }
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return json(400, { error: "invalid_email" });
  }
  if (action === "signup" && (!password || password.length < 8 || password.length > 200)) {
    return json(400, { error: "invalid_password" });
  }

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const logAudit = async (outcome: string, reason?: string, userId?: string | null, extra: Record<string, unknown> = {}) => {
    await admin.from("email_auth_audit").insert({
      email,
      user_id: userId ?? null,
      account_type: accountType,
      action,
      outcome,
      reason: reason ?? null,
      ip_address: ip,
      user_agent: ua,
      metadata: { externalProvider, ...extra },
    });
  };

  // Rate limit
  const emailLimit = await admin.rpc("check_email_auth_limit", {
    _scope: "email", _key: email, _action: action,
    _max_attempts: PER_EMAIL.max, _window_seconds: PER_EMAIL.window,
    _max_failures: PER_EMAIL.maxFailures, _block_minutes: PER_EMAIL.block,
  });
  if (emailLimit.error) return json(500, { error: "rate_check_failed" });
  if (!emailLimit.data?.allowed) {
    await logAudit("denied", emailLimit.data?.reason ?? "rate_limited");
    return json(429, {
      error: emailLimit.data?.reason ?? "rate_limited",
      retry_after_seconds: emailLimit.data?.retry_after_seconds ?? 1800,
      scope: "email",
    });
  }
  const ipLimit = await admin.rpc("check_email_auth_limit", {
    _scope: "ip", _key: ip, _action: action,
    _max_attempts: PER_IP.max, _window_seconds: PER_IP.window,
    _max_failures: PER_IP.maxFailures, _block_minutes: PER_IP.block,
  });
  if (!ipLimit.error && !ipLimit.data?.allowed) {
    await logAudit("denied", ipLimit.data?.reason ?? "ip_rate_limited");
    return json(429, {
      error: ipLimit.data?.reason ?? "rate_limited",
      retry_after_seconds: ipLimit.data?.retry_after_seconds ?? 3600,
      scope: "ip",
    });
  }

  // Admin-magic restriction: only allow if the email belongs to a user with admin role.
  if (action === "admin_magic") {
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = users?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!match) {
      await logAudit("denied", "not_admin");
      await admin.rpc("record_email_auth_failure", {
        _scope: "email", _key: email, _action: action,
        _max_failures: PER_EMAIL.maxFailures, _block_minutes: PER_EMAIL.block,
      });
      // Return success-shape to avoid email enumeration.
      return json(200, { ok: true, sent: false, message: "If eligible, a link has been sent." });
    }
    const { data: hasAdmin } = await admin.rpc("has_role", { _user_id: match.id, _role: "admin" });
    if (!hasAdmin) {
      await logAudit("denied", "not_admin", match.id);
      await admin.rpc("record_email_auth_failure", {
        _scope: "email", _key: email, _action: action,
        _max_failures: PER_EMAIL.maxFailures, _block_minutes: PER_EMAIL.block,
      });
      return json(200, { ok: true, sent: false, message: "If eligible, a link has been sent." });
    }
  }

  // Perform the actual auth call via anon (so auth-email-hook + templates fire).
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const metaData: Record<string, unknown> = { account_type: accountType };
  if (orgName) metaData.organization_name = orgName;
  if (externalProvider) metaData.external_provider = externalProvider;
  if (externalId) metaData.external_id = externalId;

  let userId: string | null = null;
  let result: { data: any; error: any } = { data: null, error: null };

  if (action === "signup") {
    result = await anon.auth.signUp({
      email, password: password!,
      options: { emailRedirectTo: redirectTo, data: metaData },
    });
    userId = result.data?.user?.id ?? null;
  } else if (action === "resend") {
    result = await anon.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectTo } });
  } else {
    // magic & admin_magic both use signInWithOtp
    result = await anon.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: action === "magic", data: metaData },
    });
  }

  if (result.error) {
    await admin.rpc("record_email_auth_failure", {
      _scope: "email", _key: email, _action: action,
      _max_failures: PER_EMAIL.maxFailures, _block_minutes: PER_EMAIL.block,
    });
    await admin.rpc("record_email_auth_failure", {
      _scope: "ip", _key: ip, _action: action,
      _max_failures: PER_IP.maxFailures, _block_minutes: PER_IP.block,
    });
    await logAudit("failed", String(result.error.message ?? "send_failed"), userId);
    return json(400, { error: "send_failed", message: result.error.message });
  }

  // Magic-link expiry: Supabase default OTP expiry (15 min) unless overridden in dashboard.
  const expirySeconds = action === "signup" || action === "resend" ? 24 * 3600 : 15 * 60;
  await logAudit("sent", null, userId, { expirySeconds });

  return json(200, {
    ok: true,
    sent: true,
    action,
    expires_in_seconds: expirySeconds,
    expires_at: new Date(Date.now() + expirySeconds * 1000).toISOString(),
  });
});
