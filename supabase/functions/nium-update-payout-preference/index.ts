// PATCH /functions/v1/nium-update-payout-preference
// Body (one of):
//   { scope:"user", payout_preference:"KANG_WALLET"|"MOBILE_MONEY", payout_channel?:string }
//   { scope:"account", account_id:uuid, payout_preference_override:null|"...", payout_channel_override?:string }
//
// Phase 1B-R1I-b.2.1 — optional same-key runtime idempotency.
//   - Header omitted → preserves legacy behaviour (no reservation, no completion row).
//   - Header supplied → validated, atomically reserved AFTER authorization + validation,
//     scoped to the authenticated user + canonical route, fingerprinted from the
//     normalised request body. Identical replays return the cached response; changed
//     requests return 409 IDEMPOTENCY_KEY_REUSED; in-flight duplicates return 409
//     with Retry-After.
//
// Mutation class: SET_STATE (local-only). No external provider call is made — the
// operation writes to `profiles` (user scope) or `nium_global_accounts` (account
// scope). Provider-result ambiguity therefore does not apply to this slice; the
// stale-replay guarantee is delivered by the shared idempotency helper (replayed
// key returns its ORIGINAL cached response and never re-executes the UPDATE).
import { createClient } from "npm:@supabase/supabase-js@2";
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
  "Access-Control-Allow-Methods": "PATCH, POST, OPTIONS",
};
const PREF = ["KANG_WALLET", "MOBILE_MONEY"] as const;

const RESOURCE = "PATCH /v1/gateway/global-accounts/payout-preference";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["PATCH", "POST"].includes(req.method)) return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claims } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
  const userId = claims?.claims?.sub;
  if (!userId) return json({ error: "unauthorized" }, 401);

  let body: {
    scope?: string;
    payout_preference?: string;
    payout_channel?: string;
    account_id?: string;
    payout_preference_override?: string | null;
    payout_channel_override?: string | null;
  };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  // ---- Validate BEFORE reservation (Section 8 — auth → validate → reserve) ----
  let normalised:
    | { scope: "user"; payout_preference: string | undefined; payout_channel: string | null }
    | { scope: "account"; account_id: string; payout_preference_override: string | null; payout_channel_override: string | null }
    | null = null;

  if (body.scope === "user") {
    if (body.payout_preference && !PREF.includes(body.payout_preference as typeof PREF[number])) {
      return json({ error: "invalid_payout_preference" }, 400);
    }
    if (body.payout_preference === "MOBILE_MONEY" && !body.payout_channel) {
      return json({ error: "payout_channel_required", message: "phone number required for mobile money" }, 400);
    }
    normalised = {
      scope: "user",
      payout_preference: body.payout_preference,
      payout_channel: body.payout_channel ?? null,
    };
  } else if (body.scope === "account") {
    if (!body.account_id) return json({ error: "account_id_required" }, 400);
    if (
      body.payout_preference_override !== null &&
      body.payout_preference_override !== undefined &&
      !PREF.includes(body.payout_preference_override as typeof PREF[number])
    ) {
      return json({ error: "invalid_payout_preference_override" }, 400);
    }
    normalised = {
      scope: "account",
      account_id: body.account_id,
      payout_preference_override: body.payout_preference_override ?? null,
      payout_channel_override: body.payout_channel_override ?? null,
    };
  } else {
    return json({ error: "invalid_scope", message: "scope must be 'user' or 'account'" }, 400);
  }

  // ---- Optional Idempotency-Key (Phase 1B-R1I-b.2.1) ----
  const idemKey = req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  let requestHash: string | null = null;
  if (idemKey) {
    // Trusted scope: authenticated userId + canonical route (never client-supplied).
    const canonical = canonicalStringify({
      scope: { user_id: userId, method: "PATCH", route: RESOURCE },
      body: normalised,
    });
    requestHash = await sha256(canonical);
    const reservation = await reserveIdempotency({
      key: idemKey,
      merchantId: userId,
      resource: RESOURCE,
      requestHash,
    });
    const early = idempotencyResponse(reservation, corsHeaders);
    if (early) return early;
  }

  // ---- Execute mutation ----
  if (normalised.scope === "user") {
    const { data, error } = await sb.from("profiles").update({
      payout_preference: normalised.payout_preference,
      payout_channel: normalised.payout_channel,
    }).eq("id", userId).select("payout_preference, payout_channel").single();
    if (error) return json({ error: "update_failed", message: error.message }, 500);
    const resp = { user_defaults: data };
    if (idemKey && requestHash) {
      await storeIdempotency({ key: idemKey, merchantId: userId, resource: RESOURCE, requestHash, status: 200, body: resp });
    }
    return json(resp);
  }

  // scope === "account"
  const { data, error } = await sb.from("nium_global_accounts").update({
    payout_preference_override: normalised.payout_preference_override,
    payout_channel_override: normalised.payout_channel_override,
  }).eq("id", normalised.account_id).eq("user_id", userId).select().maybeSingle();
  if (error) return json({ error: "update_failed", message: error.message }, 500);
  if (!data) {
    // Ownership/authorization failure — DO NOT store a completed response so
    // the caller can retry with the correct account_id under a fresh key.
    const notFound = { error: "account_not_found" };
    if (idemKey && requestHash) {
      await storeIdempotency({ key: idemKey, merchantId: userId, resource: RESOURCE, requestHash, status: 404, body: notFound });
    }
    return json(notFound, 404);
  }
  const resp = { account: data };
  if (idemKey && requestHash) {
    await storeIdempotency({ key: idemKey, merchantId: userId, resource: RESOURCE, requestHash, status: 200, body: resp });
  }
  return json(resp);
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
