// Shared API-key authenticator for the KOB Payment Gateway.
//
// Resolution order:
//   1. Bearer / X-API-Key starts with "sk_test_" / "sk_live_"  → SHA-256 hash → lookup
//      in `gateway_merchant_keys` (preferred) then `sandbox_api_keys` (legacy compat).
//   2. Bearer / X-API-Key starts with "sbx_"  → lookup `sandbox_api_keys.api_key`.
//   3. Bearer JWT (Supabase user token)       → fall back to `auth.getUser()`.
//   4. Otherwise → standardized 401 (RFC 7807).
//
// Returns a unified `ResolvedAuth` containing `user_id`, optional `merchant_id`,
// `environment` ("live" | "sandbox" | "user"), and `key_id` for audit.
//
// This is additive — existing JWT callers keep working unchanged. (Standing Order #4)

import { corsHeaders } from "./cors.ts";

export interface ResolvedAuth {
  user_id: string;
  email?: string;
  merchant_id?: string;
  institution_id?: string;
  scopes?: string[];
  environment: "live" | "sandbox" | "user" | "test";
  key_id?: string;
  key_table?: "gateway_merchant_keys" | "sandbox_api_keys" | "api_credentials";
  auth_method: "api_key" | "jwt";
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unauthorized(detail: string, instance?: string): Response {
  // RFC 7807 problem+json envelope
  const body = {
    type: "https://docs.kob.dev/errors/unauthorized",
    title: "Unauthorized",
    status: 401,
    detail,
    ...(instance ? { instance } : {}),
  };
  return new Response(JSON.stringify(body), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/problem+json" },
  });
}

/**
 * Resolve the request's authentication.
 *
 * @param req      the incoming Request
 * @param supabase service-role Supabase client
 * @returns        { auth } on success, or { response } with a ready-to-return 401.
 */
export async function resolveAuth(
  req: Request,
  supabase: any,
): Promise<{ auth: ResolvedAuth; response?: undefined } | { auth?: undefined; response: Response }> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const xApiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
  const xMerchantId = req.headers.get("X-Merchant-ID") || req.headers.get("x-merchant-id");

  // Extract the token candidate. Authorization: Bearer <token> wins; X-API-Key is alias.
  let token: string | null = null;
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    token = authHeader.replace(/^Bearer\s+/i, "").trim();
  } else if (xApiKey) {
    token = xApiKey.trim();
  }

  if (!token) {
    return { response: unauthorized("Missing Authorization bearer token or X-API-Key header.") };
  }

  // ── Path 1: KOB merchant API key (sk_test_* / sk_live_*) ──
  if (token.startsWith("sk_test_") || token.startsWith("sk_live_")) {
    const environment: "live" | "sandbox" = token.startsWith("sk_live_") ? "live" : "sandbox";
    const hash = await sha256Hex(token);

    // Preferred: gateway_merchant_keys
    const { data: merchantKey } = await supabase
      .from("gateway_merchant_keys")
      .select("id, merchant_id, environment, is_active, revoked_at, gateway_merchants!inner(id, user_id)")
      .eq("secret_key_hash", hash)
      .eq("is_active", true)
      .is("revoked_at", null)
      .maybeSingle();

    if (merchantKey) {
      const requestedMerchant = xMerchantId || undefined;
      if (requestedMerchant && requestedMerchant !== merchantKey.merchant_id) {
        return { response: unauthorized("X-Merchant-ID does not match the merchant bound to this API key.") };
      }
      // Fire-and-forget last-used update
      supabase.from("gateway_merchant_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", merchantKey.id)
        .then(() => {}, () => {});
      return {
        auth: {
          user_id: merchantKey.gateway_merchants.user_id,
          merchant_id: merchantKey.merchant_id,
          environment,
          key_id: merchantKey.id,
          key_table: "gateway_merchant_keys",
          auth_method: "api_key",
        },
      };
    }

    // Fallback: sandbox_api_keys (developer sandbox issued sk_test_* keys)
    const { data: sbxKey } = await supabase
      .from("sandbox_api_keys")
      .select("id, sandbox_account_id, is_active, developer_sandbox_accounts!inner(id, user_id, status, merchant_id)")
      .eq("key_hash", hash)
      .eq("is_active", true)
      .maybeSingle();

    if (sbxKey) {
      if (sbxKey.developer_sandbox_accounts.status !== "active") {
        return { response: unauthorized("Sandbox account is not active.") };
      }
      supabase.from("sandbox_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", sbxKey.id)
        .then(() => {}, () => {});
      return {
        auth: {
          user_id: sbxKey.developer_sandbox_accounts.user_id,
          merchant_id: sbxKey.developer_sandbox_accounts.merchant_id || xMerchantId || undefined,
          environment,
          key_id: sbxKey.id,
          key_table: "sandbox_api_keys",
          auth_method: "api_key",
        },
      };
    }

    return { response: unauthorized("API key is invalid, revoked, or inactive.") };
  }

  // ── Path 2: Legacy sandbox key (sbx_*) ──
  if (token.startsWith("sbx_")) {
    const hash = await sha256Hex(token);
    const { data: sbxKey } = await supabase
      .from("sandbox_api_keys")
      .select("id, sandbox_account_id, is_active, developer_sandbox_accounts!inner(id, user_id, status)")
      .eq("key_hash", hash)
      .eq("is_active", true)
      .maybeSingle();

    if (!sbxKey) {
      return { response: unauthorized("Sandbox API key is invalid or inactive.") };
    }
    if (sbxKey.developer_sandbox_accounts.status !== "active") {
      return { response: unauthorized("Sandbox account is not active.") };
    }
    supabase.from("sandbox_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", sbxKey.id)
      .then(() => {}, () => {});
    return {
      auth: {
        user_id: sbxKey.developer_sandbox_accounts.user_id,
        merchant_id: sbxKey.developer_sandbox_accounts.merchant_id || xMerchantId || undefined,
        environment: "sandbox",
        key_id: sbxKey.id,
        key_table: "sandbox_api_keys",
        auth_method: "api_key",
      },
    };
  }

  // ── Path 2b: KOB tenant institution secret key (kob_sec_test_* / kob_sec_live_*) ──
  if (token.startsWith("kob_sec_")) {
    const environment: "live" | "test" = token.startsWith("kob_sec_live_") ? "live" : "test";
    const hash = await sha256Hex(token);

    const { data: kobKey } = await supabase
      .from("api_credentials")
      .select("id, institution_id, environment, scopes, status, key_type")
      .eq("key_hash", hash)
      .eq("key_type", "secret")
      .eq("status", "active")
      .maybeSingle();

    if (!kobKey) {
      return { response: unauthorized("KOB API key is invalid, revoked, or inactive.") };
    }
    if (kobKey.environment !== environment) {
      return { response: unauthorized("KOB API key environment mismatch.") };
    }

    supabase.from("api_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", kobKey.id)
      .then(() => {}, () => {});

    return {
      auth: {
        user_id: "", // tenant-scoped, no single user
        institution_id: kobKey.institution_id,
        scopes: Array.isArray(kobKey.scopes) ? kobKey.scopes : [],
        environment,
        key_id: kobKey.id,
        key_table: "api_credentials",
        auth_method: "api_key",
      },
    };
  }

  // ── Path 3: Supabase user JWT (dashboard / PAT) ──
  // Heuristic: JWTs are 3 base64 segments separated by dots.
  if (token.split(".").length === 3) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { response: unauthorized("Invalid or expired session token.") };
    }
    return {
      auth: {
        user_id: user.id,
        email: user.email || undefined,
        merchant_id: xMerchantId || undefined,
        environment: "user",
        auth_method: "jwt",
      },
    };
  }

  return { response: unauthorized("Unrecognized credential format. Expected sk_test_* / sk_live_* / sbx_* / JWT.") };
}
