// KOB Integration Layer — Stripe-style unified router.
// Path pattern: POST /functions/v1/integration-layer/{resource}.{action}
// Additive only — does NOT modify any existing /v1/* endpoint or schema.
//
// PERMANENT PUBLIC SDK SURFACE — DO NOT REMOVE OR REDIRECT
// Standing Order 7: Five Roles enforced (Guardian/Architect/Surgeon/Auditor/Scorekeeper).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  envelope, errorEnvelope, normalizePayment, normalizeAccount,
  normalizeTransfer, normalizePayout, normalizeRefund, normalizeCustomer,
} from "../_shared/integration-layer/normalize.ts";
import { routePayment, routeTransfer } from "../_shared/integration-layer/router.ts";
import { simulate, listMagicValues } from "../_shared/integration-layer/sandbox.ts";
import { lookupIdempotency, storeIdempotency, sha256 } from "../_shared/integration-layer/idempotency.ts";
import { replayWebhookEvent } from "../_shared/integration-layer/webhooks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key, x-integration-env",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function reqId(): string {
  return "req_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

async function callUpstream(fn: string, payload: unknown, authHeader: string | null): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `${SUPABASE_URL}/functions/v1/${fn}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": authHeader ?? `Bearer ${SERVICE_KEY}`,
  };
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep text */ }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 502, body: { message: e instanceof Error ? e.message : "upstream error" } };
  }
}

function parseRoute(pathname: string): { resource: string; action: string } | null {
  // Match .../integration-layer/{resource}.{action}
  const m = pathname.match(/integration-layer\/([a-z_]+)\.([a-z_]+)\/?$/i);
  if (!m) return null;
  return { resource: m[1].toLowerCase(), action: m[2].toLowerCase() };
}

async function getMerchantId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return null;
    const { data: m } = await sb.from("gateway_merchants").select("id").eq("user_id", u.user.id).maybeSingle();
    return m?.id ?? null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const request_id = reqId();
  const url = new URL(req.url);
  const env = req.headers.get("x-integration-env") ?? "sandbox";
  const includeRaw = url.searchParams.get("include") === "raw";

  // Public discovery endpoints
  if (req.method === "GET" && url.pathname.endsWith("/integration-layer")) {
    return jsonResponse({
      object: "integration_layer",
      version: "4.17.0",
      resources: ["customers", "accounts", "payments", "transfers", "payouts", "refunds", "webhooks", "sandbox"],
      docs_url: "https://kangopenbanking.com/developer/integration-layer",
      sandbox_magic_values: listMagicValues(),
    });
  }

  const route = parseRoute(url.pathname);
  if (!route) {
    return jsonResponse(errorEnvelope({
      type: "invalid_request_error", code: "unknown_route", request_id,
      message: "Use POST /integration-layer/{resource}.{action} (e.g. payments.create)",
    }), 404);
  }

  if (req.method !== "POST") {
    return jsonResponse(errorEnvelope({
      type: "invalid_request_error", code: "method_not_allowed", request_id,
      message: `Use POST for ${route.resource}.${route.action}`,
    }), 405);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }

  const authHeader = req.headers.get("authorization");
  const idemKey = req.headers.get("idempotency-key") ?? "";
  const merchantId = await getMerchantId(authHeader);

  // Idempotency lookup (only for create-style actions)
  const isCreate = ["create", "initiate", "register", "replay"].includes(route.action);
  if (isCreate && idemKey) {
    const requestHash = await sha256(JSON.stringify({ resource: route.resource, action: route.action, body }));
    const hit = await lookupIdempotency(idemKey, merchantId, requestHash);
    if (hit && "conflict" in hit) {
      return jsonResponse(errorEnvelope({
        type: "idempotency_error", code: "idempotency_key_reused", request_id,
        message: "Idempotency-Key was already used with a different request body.",
      }), 409, { "Idempotency-Replayed": "false" });
    }
    if (hit) {
      return jsonResponse(hit.body, hit.status, { "Idempotency-Replayed": "true" });
    }
    // Continue and store after dispatch
    (req as unknown as { __idem: { key: string; merchantId: string | null; requestHash: string; resource: string } }).__idem =
      { key: idemKey, merchantId, requestHash, resource: route.resource };
  }

  let response: Response;
  try {
    response = await dispatch(route, body, { authHeader, env, includeRaw, request_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    response = jsonResponse(errorEnvelope({
      type: "api_error", code: "internal_error", request_id, message: msg,
    }), 500);
  }

  // Store idempotency result
  const idem = (req as unknown as { __idem?: { key: string; merchantId: string | null; requestHash: string; resource: string } }).__idem;
  if (idem) {
    try {
      const cloned = response.clone();
      const respBody = await cloned.json();
      await storeIdempotency({
        key: idem.key, merchantId: idem.merchantId, resource: idem.resource,
        requestHash: idem.requestHash, status: response.status, body: respBody,
      });
    } catch { /* best effort */ }
  }

  return response;
});

async function dispatch(
  route: { resource: string; action: string },
  body: Record<string, unknown>,
  ctx: { authHeader: string | null; env: string; includeRaw: boolean; request_id: string },
): Promise<Response> {
  const { resource, action } = route;

  // ---- payments ----
  if (resource === "payments" && action === "create") {
    const amount = Number(body.amount ?? 0);
    const sim = simulate(amount, ctx.env);
    if (sim) {
      if (sim.kind === "declined") {
        return jsonResponse(errorEnvelope({
          type: "connector_error", code: sim.code, request_id: ctx.request_id, message: sim.message,
        }), 402);
      }
      if (sim.kind === "challenge") {
        return jsonResponse(envelope({
          id: "pi_sandbox_" + crypto.randomUUID().slice(0, 8),
          object: "payment", status: "requires_action",
          amount, currency: String(body.currency ?? "XAF"),
          data: { next_action: { type: "redirect", url: sim.challenge_url } },
        }));
      }
      // success or delayed_success
      if (sim.kind === "delayed_success") {
        return jsonResponse(envelope({
          id: "pi_sandbox_" + crypto.randomUUID().slice(0, 8),
          object: "payment", status: "processing",
          amount, currency: String(body.currency ?? "XAF"),
          data: { eta_seconds: Math.round(sim.delayMs / 1000) },
        }));
      }
      return jsonResponse(envelope({
        id: "pi_sandbox_" + crypto.randomUUID().slice(0, 8),
        object: "payment", status: "succeeded",
        amount, currency: String(body.currency ?? "XAF"), data: { simulated: true },
      }));
    }

    const decision = routePayment({
      method: (body.method ?? "card") as never,
      country: body.country as string | undefined,
      currency: body.currency as string | undefined,
      msisdn: body.msisdn as string | undefined,
      amount,
      preferred_connector: body.preferred_connector as string | undefined,
    });
    const upstream = await callUpstream(decision.primary, body, ctx.authHeader);
    if (!upstream.ok && decision.fallback) {
      for (const fb of decision.fallback) {
        const retry = await callUpstream(fb, body, ctx.authHeader);
        if (retry.ok) {
          return jsonResponse(normalizePayment(retry.body as Record<string, unknown>, ctx.includeRaw));
        }
      }
    }
    if (!upstream.ok) {
      return jsonResponse(errorEnvelope({
        type: "connector_error", code: "upstream_failed", request_id: ctx.request_id,
        message: `Routing decision: ${decision.reason}. Upstream returned ${upstream.status}.`,
        upstream: upstream.body,
      }), 502);
    }
    return jsonResponse(normalizePayment(upstream.body as Record<string, unknown>, ctx.includeRaw));
  }

  if (resource === "payments" && action === "retrieve") {
    const upstream = await callUpstream("gateway-query", { type: "charge", id: body.id }, ctx.authHeader);
    return jsonResponse(normalizePayment(upstream.body as Record<string, unknown>, ctx.includeRaw), upstream.status);
  }

  // ---- accounts ----
  if (resource === "accounts" && action === "list") {
    const upstream = await callUpstream("aisp-accounts", body, ctx.authHeader);
    const arr = (upstream.body as { accounts?: unknown[] })?.accounts ?? (Array.isArray(upstream.body) ? upstream.body : []);
    return jsonResponse({
      object: "list",
      data: (arr as Record<string, unknown>[]).map(a => normalizeAccount(a, ctx.includeRaw)),
      has_more: false,
    }, upstream.status);
  }

  if (resource === "accounts" && action === "balances") {
    const upstream = await callUpstream("aisp-balances", body, ctx.authHeader);
    return jsonResponse(upstream.body, upstream.status);
  }

  // ---- transfers ----
  if (resource === "transfers" && (action === "create" || action === "initiate")) {
    const decision = routeTransfer({ rail: body.rail as never });
    const upstream = await callUpstream(decision.primary, body, ctx.authHeader);
    if (!upstream.ok) {
      return jsonResponse(errorEnvelope({
        type: "connector_error", code: "transfer_failed", request_id: ctx.request_id,
        message: `Transfer routing: ${decision.reason}.`, upstream: upstream.body,
      }), 502);
    }
    return jsonResponse(normalizeTransfer(upstream.body as Record<string, unknown>, ctx.includeRaw));
  }

  // ---- payouts ----
  if (resource === "payouts" && action === "create") {
    const upstream = await callUpstream("gateway-create-payout", body, ctx.authHeader);
    return jsonResponse(normalizePayout(upstream.body as Record<string, unknown>, ctx.includeRaw), upstream.status);
  }
  if (resource === "payouts" && action === "cancel") {
    const upstream = await callUpstream("gateway-cancel-payout", body, ctx.authHeader);
    return jsonResponse(normalizePayout(upstream.body as Record<string, unknown>, ctx.includeRaw), upstream.status);
  }

  // ---- refunds ----
  if (resource === "refunds" && action === "create") {
    const upstream = await callUpstream("gateway-create-refund", body, ctx.authHeader);
    return jsonResponse(normalizeRefund(upstream.body as Record<string, unknown>, ctx.includeRaw), upstream.status);
  }

  // ---- customers ----
  if (resource === "customers" && action === "create") {
    const upstream = await callUpstream("identity-register", body, ctx.authHeader);
    return jsonResponse(normalizeCustomer(upstream.body as Record<string, unknown>, ctx.includeRaw), upstream.status);
  }
  if (resource === "customers" && action === "retrieve") {
    const upstream = await callUpstream("userinfo", body, ctx.authHeader);
    return jsonResponse(normalizeCustomer(upstream.body as Record<string, unknown>, ctx.includeRaw), upstream.status);
  }

  // ---- webhooks ----
  if (resource === "webhooks" && action === "register") {
    const upstream = await callUpstream("gateway-webhook-endpoints", body, ctx.authHeader);
    return jsonResponse(upstream.body, upstream.status);
  }
  if (resource === "webhooks" && action === "replay") {
    const merchantId = await getMerchantId(ctx.authHeader);
    const result = await replayWebhookEvent({
      eventId: String(body.event_id ?? ""),
      merchantId,
      replayedBy: null,
    });
    return jsonResponse(result, result.status === "failed" ? 502 : 200);
  }
  if (resource === "webhooks" && action === "ping") {
    return jsonResponse({ pong: true, request_id: ctx.request_id });
  }

  // ---- sandbox ----
  if (resource === "sandbox" && action === "magic_values") {
    return jsonResponse({ object: "list", data: listMagicValues() });
  }
  if (resource === "sandbox" && action === "trigger") {
    const upstream = await callUpstream("sandbox-trigger-webhook", body, ctx.authHeader);
    return jsonResponse(upstream.body, upstream.status);
  }

  return jsonResponse(errorEnvelope({
    type: "invalid_request_error", code: "unknown_resource_action",
    request_id: ctx.request_id,
    message: `${resource}.${action} is not a valid integration-layer route.`,
  }), 404);
}
