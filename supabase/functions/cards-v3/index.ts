// =============================================================
// cards-v3 — Canonical card issuing endpoint (Nium primary, Kora fallback).
// POST body { action, ...params }
//   action: "issue" | "list" | "get" | "freeze" | "unfreeze" | "terminate"
//         | "order_physical" | "provider_health"
// =============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import {
  issueCard,
  lifecycleAction,
  providerHealth,
  type CardFormFactor,
  type IssueCardInput,
} from "../_shared/card-issuer.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
const err = (code: string, msg: string, status = 400) =>
  json({ type: `https://api.kangopenbanking.com/errors/${code}`, title: code, status, detail: msg }, status);

interface AuthCtx { userId: string; email: string | null; isAdmin: boolean; }

async function resolveAuth(sb: ReturnType<typeof createClient>, req: Request): Promise<AuthCtx> {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new Error("missing_auth");
  const { data: { user }, error } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (error || !user) throw new Error("invalid_token");
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  return { userId: user.id, email: user.email ?? null, isAdmin };
}

async function ensureCardholder(sb: ReturnType<typeof createClient>, ctx: AuthCtx, p: any) {
  // Look up (or auto-create) a shell cardholder row for this user.
  let { data: ch } = await sb
    .from("kora_cardholders")
    .select("*")
    .eq("customer_external_id", ctx.userId)
    .maybeSingle();
  if (ch) return ch;
  const { data: prof } = await sb
    .from("profiles")
    .select("first_name,last_name,phone,country")
    .eq("id", ctx.userId)
    .maybeSingle();
  const insert = {
    tenant_type: "platform" as const,
    tenant_id: ctx.userId,
    customer_external_id: ctx.userId,
    first_name: p.first_name ?? prof?.first_name ?? "Kang",
    last_name: p.last_name ?? prof?.last_name ?? "Customer",
    email: ctx.email ?? p.email ?? `${ctx.userId}@kang.local`,
    phone: p.phone ?? prof?.phone ?? null,
    kyc_level: "tier1",
    kyc_status: "approved",
    created_by: ctx.userId,
  };
  const { data, error } = await sb.from("kora_cardholders").insert(insert).select().single();
  if (error) throw new Error(`cardholder_create_failed: ${error.message}`);
  return data;
}

async function actionIssue(sb: ReturnType<typeof createClient>, ctx: AuthCtx, p: any) {
  const form_factor = (p.form_factor ?? "virtual") as CardFormFactor;
  if (!["virtual", "digital", "physical"].includes(form_factor)) {
    return err("card_validation_failed", "form_factor must be virtual|digital|physical", 422);
  }
  const idem = p.idempotency_key || crypto.randomUUID();
  const ch = await ensureCardholder(sb, ctx, p);

  const input: IssueCardInput = {
    customer_external_id: ch.customer_external_id,
    cardholder: {
      first_name: ch.first_name,
      last_name: ch.last_name,
      email: ch.email,
      phone: ch.phone ?? undefined,
      date_of_birth: ch.date_of_birth ?? undefined,
      address: p.address,
    },
    form_factor,
    currency: p.currency ?? "XAF",
    initial_funding: p.initial_funding ?? 0,
    daily_limit: p.daily_limit,
    monthly_limit: p.monthly_limit,
    idempotency_key: idem,
  };

  let issued;
  try {
    issued = await issueCard(input);
  } catch (e: any) {
    return err("card_provider_unavailable", e?.message ?? "issue_failed", 502);
  }

  const cardName = p.card_name || `${ch.first_name} ${ch.last_name}`.trim();
  const providerColumn = issued.provider === "nium"
    ? { nium_card_id: issued.provider_card_id, nium_customer_hash_id: issued.provider_customer_id }
    : { kora_card_id: issued.provider_card_id, kora_cardholder_id: issued.provider_customer_id };

  const { data: card, error: cardErr } = await sb
    .from("virtual_cards")
    .insert({
      user_id: ctx.userId,
      cardholder_id: ch.id,
      tenant_type: "platform",
      tenant_id: null,
      customer_external_id: ch.customer_external_id,
      issued_by_user_id: ctx.userId,
      provider: issued.provider,
      form_factor: issued.form_factor,
      fallback_reason: issued.fallback_reason ?? null,
      currency: input.currency,
      card_name: cardName,
      last4: issued.last4,
      exp_month: issued.exp_month,
      exp_year: issued.exp_year,
      brand: issued.brand,
      stripe_card_id: `${issued.provider}_${issued.provider_card_id}`,
      balance_usd: input.initial_funding ?? 0,
      spending_controls: {
        daily_limit: input.daily_limit,
        monthly_limit: input.monthly_limit,
      },
      metadata: { idempotency_key: idem, issued_via: "cards-v3" },
      ...providerColumn,
    })
    .select()
    .single();
  if (cardErr) return err("card_persist_failed", cardErr.message, 500);

  // Physical → create shipment shell
  if (form_factor === "physical") {
    const addr = p.address;
    if (!addr?.line1 || !addr?.city || !addr?.country) {
      return err("card_validation_failed", "physical cards require full shipping address", 422);
    }
    await sb.from("card_shipments").insert({
      card_id: card.id,
      user_id: ctx.userId,
      provider: issued.provider,
      recipient_name: cardName,
      address_line1: addr.line1,
      address_line2: addr.line2 ?? null,
      city: addr.city,
      region: addr.region ?? null,
      postal_code: addr.postal_code ?? null,
      country: addr.country,
    });
  }

  return json({ card, provider: issued.provider, fallback_used: issued.fallback_used }, 201);
}

async function actionList(sb: ReturnType<typeof createClient>, ctx: AuthCtx) {
  let q = sb.from("virtual_cards").select("*").order("created_at", { ascending: false });
  if (!ctx.isAdmin) q = q.eq("user_id", ctx.userId);
  const { data, error } = await q.limit(50);
  if (error) return err("list_failed", error.message, 500);
  return json({ cards: data ?? [] });
}

async function actionLifecycle(
  sb: ReturnType<typeof createClient>,
  ctx: AuthCtx,
  p: any,
  action: "freeze" | "unfreeze" | "terminate",
) {
  if (!p.card_id) return err("card_validation_failed", "card_id required", 422);
  const { data: card } = await sb.from("virtual_cards").select("*").eq("id", p.card_id).maybeSingle();
  if (!card) return err("card_not_found", "card not found", 404);
  if (!ctx.isAdmin && card.user_id !== ctx.userId) return err("forbidden", "not your card", 403);

  const providerCardId = card.provider === "nium" ? card.nium_card_id : card.kora_card_id;
  if (!providerCardId) return err("card_provider_id_missing", "no provider card id", 500);

  try {
    await lifecycleAction(card.provider, providerCardId, action);
  } catch (e: any) {
    return err("card_provider_unavailable", e?.message ?? "lifecycle_failed", 502);
  }

  const nextStatus = action === "freeze" ? "inactive" : action === "unfreeze" ? "active" : "cancelled";
  const patch: Record<string, unknown> = { status: nextStatus, updated_at: new Date().toISOString() };
  if (action === "freeze") patch.frozen_at = new Date().toISOString();
  if (action === "terminate") patch.terminated_at = new Date().toISOString();

  const { data: updated } = await sb.from("virtual_cards").update(patch).eq("id", card.id).select().single();
  return json({ card: updated });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let ctx: AuthCtx;
  try { ctx = await resolveAuth(sb, req); }
  catch (e: any) { return err("unauthorized", e?.message ?? "auth_failed", 401); }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty ok */ }
  const action = body.action ?? new URL(req.url).searchParams.get("action");

  switch (action) {
    case "issue":           return actionIssue(sb, ctx, body);
    case "list":            return actionList(sb, ctx);
    case "freeze":          return actionLifecycle(sb, ctx, body, "freeze");
    case "unfreeze":        return actionLifecycle(sb, ctx, body, "unfreeze");
    case "terminate":       return actionLifecycle(sb, ctx, body, "terminate");
    case "update_limits":   return actionUpdateLimits(sb, ctx, body);
    case "provider_health": return json(providerHealth());
    default:                return err("invalid_action", `unknown action: ${action}`, 400);
  }
});

async function actionUpdateLimits(
  sb: ReturnType<typeof createClient>,
  ctx: AuthCtx,
  p: any,
) {
  if (!p.card_id) return err("card_validation_failed", "card_id required", 422);
  const daily = p.daily_limit == null ? null : Number(p.daily_limit);
  const monthly = p.monthly_limit == null ? null : Number(p.monthly_limit);
  if (daily != null && (!Number.isFinite(daily) || daily < 0)) {
    return err("card_validation_failed", "daily_limit must be a positive number", 422);
  }
  if (monthly != null && (!Number.isFinite(monthly) || monthly < 0)) {
    return err("card_validation_failed", "monthly_limit must be a positive number", 422);
  }
  const { data: card } = await sb.from("virtual_cards").select("*").eq("id", p.card_id).maybeSingle();
  if (!card) return err("card_not_found", "card not found", 404);
  if (!ctx.isAdmin && card.user_id !== ctx.userId) return err("forbidden", "not your card", 403);

  const existing = (card.spending_controls as Record<string, unknown> | null) ?? {};
  const spending_controls = {
    ...existing,
    daily_limit: daily,
    monthly_limit: monthly,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await sb
    .from("virtual_cards")
    .update({ spending_controls, updated_at: new Date().toISOString() })
    .eq("id", card.id)
    .select()
    .single();
  if (error) return err("card_update_failed", error.message, 500);
  return json({ card: updated });
}
