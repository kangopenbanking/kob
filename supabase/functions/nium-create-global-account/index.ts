// POST /functions/v1/nium-create-global-account
// Auth: required. Body: { currency: "USD"|"EUR"|"GBP", pop_code?: NiumPopCode }
// Returns the persisted Nium global virtual account (IBAN/USD/GBP details).
//
// COMPLIANCE CHECK (Strict KYC name matching): beneficiary_name is ALWAYS
// pulled from the verified KYC profile. Free-text overrides are FORBIDDEN.
// COMPLIANCE CHECK (BEAC PoP): pop_code is locked to ALLOWED_NIUM_POP_CODES.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createGlobalAccount, NIUM_MODE, assertNiumCurrency, type NiumCurrency } from "../_shared/nium-client.ts";
import { DEFAULT_NIUM_POP_CODE, isAllowedNiumPopCode } from "../_shared/nium-compliance.ts";
import {
  reserveIdempotency,
  storeIdempotency,
  idempotencyResponse,
  sha256,
} from "../_shared/integration-layer/idempotency.ts";
import { canonicalStringify } from "../_shared/integration-layer/canonical.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESOURCE = "POST /v1/gateway/global-accounts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claims, error: claimsErr } = await anon.auth.getClaims(auth.replace("Bearer ", ""));
  if (claimsErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  let body: { currency?: string; pop_code?: string; beneficiary_name?: string; account_kind?: "virtual" | "global"; bvn?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  // Deprecation warning: `bvn` is a legacy NGN-rail field, ignored on Nium
  // provisioning. Accepted for backward compatibility but stripped from
  // downstream calls and surfaced back to the caller.
  const warnings: Array<{ field: string; code: string; message: string }> = [];
  if (typeof body.bvn === "string" && body.bvn.trim() !== "") {
    warnings.push({
      field: "bvn",
      code: "deprecated_field_ignored",
      message: "`bvn` is deprecated. It is ignored on Nium provisioning; remove it from your requests. See https://kangopenbanking.com/developer/changelog#4.52.1",
    });
    delete body.bvn;
  }

  // COMPLIANCE CHECK: reject ANY free-text beneficiary override.
  if (body.beneficiary_name !== undefined) {
    return json({
      error: "beneficiary_name_override_forbidden",
      message: "beneficiary_name is sourced from the verified KYC profile and cannot be overridden.",
    }, 400);
  }

  let currency: NiumCurrency;
  try { currency = assertNiumCurrency(body.currency); }
  catch (e) { return json({ error: "invalid_currency", message: String(e instanceof Error ? e.message : e) }, 400); }

  const accountKind: "virtual" | "global" = body.account_kind === "global" ? "global" : "virtual";

  // COMPLIANCE CHECK: BEAC Purpose-of-Payment whitelist.
  const popCode = body.pop_code ?? DEFAULT_NIUM_POP_CODE;
  if (!isAllowedNiumPopCode(popCode)) {
    return json({
      error: "pop_code_forbidden",
      message: 'pop_code must be "Software/Digital Services" or "Royalties".',
    }, 400);
  }

  const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // --- Optional Idempotency-Key (Phase 1B-R1I-b.1 + b.1V) ---
  // Header omitted → preserve legacy behaviour.
  // Header supplied → validate, reserve atomically, replay/conflict/in-flight
  // semantics, AND reconcile prior provider-result-unknown responses before
  // replaying them (b.1V: never blindly retry provider after ambiguity).
  const idemKey = req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  let requestHash: string | null = null;
  if (idemKey) {
    // Trusted scope: authenticated userId + canonical route (never client-supplied).
    const canonical = canonicalStringify({
      scope: { user_id: userId, method: "POST", route: RESOURCE },
      body: { currency, pop_code: popCode, account_kind: accountKind },
    });
    requestHash = await sha256(canonical);
    const reservation = await reserveIdempotency({
      key: idemKey,
      merchantId: userId, // per-user scope (no merchant identity on consumer route)
      resource: RESOURCE,
      requestHash,
    });

    // b.1V reconciliation-on-replay: a prior attempt stored an ambiguous
    // provider-result-unknown completion. Before replaying that 502, check
    // whether the provider account has since surfaced locally (e.g. via a
    // Nium webhook or a natural per-(user,currency) row). If it has, promote
    // the cached response to a completed success and replay THAT — never
    // re-invoke the provider from this ambiguity path.
    if (
      reservation.kind === "replay" &&
      reservation.status === 502 &&
      typeof reservation.body === "object" &&
      reservation.body !== null &&
      (reservation.body as { code?: string }).code === "PROVIDER_RESULT_UNKNOWN"
    ) {
      const { data: recovered } = await svc.from("nium_global_accounts").select("*")
        .eq("user_id", userId).eq("currency", currency).eq("status", "active").maybeSingle();
      if (recovered) {
        const upgraded = { account: recovered, reused: true, meta: { warnings, reconciled: true } };
        await storeIdempotency({ key: idemKey, merchantId: userId, resource: RESOURCE, requestHash, status: 200, body: upgraded });
        return json(upgraded, 200);
      }
      // Still no local evidence — replay the ambiguity response unchanged.
      // Do NOT fall through to the provider path.
    }

    const early = idempotencyResponse(reservation, corsHeaders);
    if (early) return early;
  }

  // Resolve beneficiary name from the verified KYC profile ONLY.
  const { data: profile } = await svc.from("profiles")
    .select("full_name, kyc_status")
    .eq("id", userId).maybeSingle();
  const beneficiary = (profile?.full_name ?? "").trim();
  if (!beneficiary) {
    return json({
      error: "kyc_name_required",
      message: "Complete identity verification before generating a global account.",
    }, 409);
  }

  // Existing per-(user,currency) natural idempotency: return the existing active account.
  const { data: existing } = await svc.from("nium_global_accounts").select("*")
    .eq("user_id", userId).eq("currency", currency).eq("status", "active").maybeSingle();
  if (existing) {
    const respBody = { account: existing, reused: true, meta: { warnings } };
    if (idemKey && requestHash) {
      await storeIdempotency({ key: idemKey, merchantId: userId, resource: RESOURCE, requestHash, status: 200, body: respBody });
    }
    return json(respBody, 200);
  }

  let nium;
  try {
    nium = await createGlobalAccount({ user_id: userId, beneficiary_name: beneficiary, currency });
  } catch (e) {
    console.error("nium createGlobalAccount failed", e);
    // Provider ambiguity (b.1V). We CANNOT distinguish a pre-send failure from
    // a post-send failure where the provider account may already exist. Store
    // an "unknown_provider_result" completion under the idempotency key so an
    // identical retry replays deterministically (and enters the
    // reconciliation-on-replay path above) — never blindly re-invoking the
    // provider. Clients wishing to force a new attempt must use a fresh key,
    // at which point the natural per-(user,currency) idempotency check on
    // nium_global_accounts still protects against duplicate provider accounts.
    const ambiguity = {
      error: "nium_provider_result_unknown",
      code: "PROVIDER_RESULT_UNKNOWN",
      message: "The provider request completed with an unknown outcome. Retries with the same Idempotency-Key will auto-reconcile once the provider result is confirmed.",
      detail: String(e instanceof Error ? e.message : e),
    };
    if (idemKey && requestHash) {
      await storeIdempotency({ key: idemKey, merchantId: userId, resource: RESOURCE, requestHash, status: 502, body: ambiguity });
    }
    return json(ambiguity, 502);
  }

  const { data: inserted, error: insErr } = await svc.from("nium_global_accounts").insert({
    user_id: userId,
    nium_customer_hash_id: nium.nium_customer_hash_id,
    nium_account_id: nium.nium_account_id,
    currency: nium.currency,
    iban: nium.iban,
    account_number: nium.account_number,
    routing_code: nium.routing_code,
    bic: nium.bic,
    bank_name: nium.bank_name,
    bank_address: nium.bank_address,
    beneficiary_name: nium.beneficiary_name,
    pop_code: popCode,
    mode: NIUM_MODE,
    account_kind: accountKind,
    status: "active",
  }).select().single();

  if (insErr) return json({ error: "persist_failed", message: insErr.message }, 500);
  const respBody = { account: inserted, reused: false, meta: { warnings } };
  if (idemKey && requestHash) {
    await storeIdempotency({ key: idemKey, merchantId: userId, resource: RESOURCE, requestHash, status: 201, body: respBody });
  }
  return json(respBody, 201);
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
