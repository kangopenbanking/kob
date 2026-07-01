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
  loadCard,
  providerHealth,
  type CardFormFactor,
  type IssueCardInput,
} from "../_shared/card-issuer.ts";
import { dispatchCardWebhook } from "../_shared/card-webhook.ts";
import {
  computeFee,
  debitPrimaryWallet,
  recordCardFeeLedger,
  resolveCardFee,
} from "../_shared/card-fees.ts";

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

// Legacy virtual_cards.cardholder_id FKs to stripe_cardholders — keep a shell row so inserts pass.
async function ensureStripeCardholderShell(sb: ReturnType<typeof createClient>, ctx: AuthCtx, ch: any) {
  const { data: existing } = await sb
    .from("stripe_cardholders")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await sb
    .from("stripe_cardholders")
    .insert({
      user_id: ctx.userId,
      stripe_cardholder_id: `shell_${ctx.userId}`,
      name: `${ch.first_name ?? "Kang"} ${ch.last_name ?? "Customer"}`.trim(),
      email: ch.email ?? ctx.email ?? `${ctx.userId}@kang.local`,
      status: "active",
      metadata: { source: "cards-v3-shell" },
    })
    .select("id")
    .single();
  if (error) throw new Error(`stripe_cardholder_shell_failed: ${error.message}`);
  return data.id as string;
}

// Structured log helper — one JSON line per step. Grep with `card_issue_step`.
function logStep(idem: string, userId: string, step: string, meta: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    tag: "card_issue_step",
    ts: new Date().toISOString(),
    idempotency_key: idem,
    user_id: userId,
    step,
    ...meta,
  }));
}

async function actionIssue(sb: ReturnType<typeof createClient>, ctx: AuthCtx, p: any) {
  const form_factor = (p.form_factor ?? "virtual") as CardFormFactor;
  if (!["virtual", "digital", "physical"].includes(form_factor)) {
    return err("card_validation_failed", "Choose Virtual, Digital, or Physical to continue.", 422);
  }
  const idem = p.idempotency_key || crypto.randomUUID();
  const timeline: Array<{ step: string; at: string; note?: string }> = [];
  const track = (step: string, note?: string) => {
    const at = new Date().toISOString();
    timeline.push({ step, at, note });
    logStep(idem, ctx.userId, step, note ? { note } : {});
  };

  track("requested", form_factor);

  // ---------- Idempotency short-circuit ----------
  const { data: existing } = await sb
    .from("virtual_cards")
    .select("*")
    .eq("user_id", ctx.userId)
    .filter("metadata->>idempotency_key", "eq", idem)
    .maybeSingle();
  if (existing) {
    logStep(idem, ctx.userId, "idempotent_replay", { card_id: existing.id });
    return new Response(
      JSON.stringify({ card: existing, provider: existing.provider, idempotent_replay: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Idempotent-Replay": "true" } },
    );
  }

  let ch;
  try {
    ch = await ensureCardholder(sb, ctx, p);
    track("cardholder_ready");
  } catch (e: any) {
    track("cardholder_failed", e?.message);
    return err("cardholder_setup_failed", "We couldn't prepare your cardholder profile. Please try again.", 500);
  }

  // ---------- Card issuance fee (admin-managed, wallet-debited) ----------
  const walletCurrency = "XAF";
  const issuanceFee = await resolveCardFee(sb, "card_issuance_fee");
  const issuanceFeeAmount = computeFee(issuanceFee, 0);
  let feeWalletAccountId: string | null = null;
  if (issuanceFeeAmount > 0) {
    const debit = await debitPrimaryWallet(sb, ctx.userId, issuanceFeeAmount, walletCurrency);
    if (!debit.ok) {
      track("issuance_fee_debit_failed", debit.reason);
      return err(
        "card_wallet_insufficient",
        "Your wallet balance is not enough to cover the card issuance fee. Please top up and try again.",
        402,
      );
    }
    feeWalletAccountId = debit.account_id ?? null;
    track("issuance_fee_charged", `${issuanceFeeAmount} ${walletCurrency}`);
  }

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
    track("provider_issued", issued.fallback_used ? "secondary_route" : "primary_route");
  } catch (e: any) {
    track("provider_failed", e?.message);
    return err(
      "card_provider_unavailable",
      "Our card partner is temporarily unavailable. Please try again in a moment.",
      502,
    );
  }

  const cardName = p.card_name || `${ch.first_name} ${ch.last_name}`.trim();
  const providerColumn = issued.provider === "nium"
    ? { nium_card_id: issued.provider_card_id, nium_customer_hash_id: issued.provider_customer_id }
    : { kora_card_id: issued.provider_card_id, kora_cardholder_id: issued.provider_customer_id };

  const stripeCardholderShellId = await ensureStripeCardholderShell(sb, ctx, ch);

  const { data: card, error: cardErr } = await sb
    .from("virtual_cards")
    .insert({
      user_id: ctx.userId,
      cardholder_id: stripeCardholderShellId,
      tenant_type: "platform",
      tenant_id: ctx.userId,
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
      metadata: { idempotency_key: idem, issued_via: "cards-v3", timeline },
      ...providerColumn,
    })
    .select()
    .single();
  if (cardErr) {
    track("persist_failed", cardErr.message);
    return err("card_persist_failed", "Your card was created but we couldn't save it. Contact support.", 500);
  }
  track("persisted", card.id);

  // Record issuance fee in ledger now that we have a card_id.
  if (issuanceFeeAmount > 0) {
    await recordCardFeeLedger(sb, {
      userId: ctx.userId,
      cardId: card.id,
      feeType: "card_issuance_fee",
      amount: issuanceFeeAmount,
      currency: walletCurrency,
      accountId: feeWalletAccountId,
      idempotencyKey: `${idem}:issuance-fee`,
      note: `Card issuance (${form_factor})`,
    });
  }

  // Physical → create shipment shell
  if (form_factor === "physical") {
    const addr = p.address;
    if (!addr?.line1 || !addr?.city || !addr?.country) {
      return err("card_validation_failed", "A full shipping address is required for physical cards.", 422);
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
    track("shipment_created");
  }

  // Persist final timeline back onto the card metadata.
  await sb.from("virtual_cards").update({
    metadata: { idempotency_key: idem, issued_via: "cards-v3", timeline },
  }).eq("id", card.id);

  // Fan-out card.issue.persisted webhook (available/ready milestone).
  await dispatchCardWebhook(sb, "card.issue.persisted", {
    card_id: card.id,
    user_id: ctx.userId,
    form_factor,
    currency: input.currency,
    status: card.status ?? "active",
    last4: card.last4 ?? null,
    idempotency_key: idem,
    data: { timeline, provider_neutral: true },
  });

  return json({ card: { ...card, metadata: { ...card.metadata, timeline } }, provider: issued.provider, fallback_used: issued.fallback_used, timeline }, 201);
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
  try {
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
      case "issue":           return await actionIssue(sb, ctx, body);
      case "list":            return await actionList(sb, ctx);
      case "freeze":          return await actionLifecycle(sb, ctx, body, "freeze");
      case "unfreeze":        return await actionLifecycle(sb, ctx, body, "unfreeze");
      case "terminate":       return await actionLifecycle(sb, ctx, body, "terminate");
      case "update_limits":   return await actionUpdateLimits(sb, ctx, body);
      case "fund":            return await actionFundOrWithdraw(sb, ctx, body, "load");
      case "withdraw":        return await actionFundOrWithdraw(sb, ctx, body, "unload");
      case "admin_list":      return await actionAdminList(sb, ctx, body);
      case "provider_health": return json(providerHealth());
      default:                return err("invalid_action", `unknown action: ${action}`, 400);
    }
  } catch (e: any) {
    console.error("[cards-v3] unhandled", e?.stack ?? e);
    return err("internal_error", e?.message ?? "unexpected error", 500);
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

// ---------- Fund / Withdraw ----------
// Debits wallet on `load`, credits card.balance_usd; opposite on `unload`.
// Also debits an admin-configurable per-transaction fee.
async function actionFundOrWithdraw(
  sb: ReturnType<typeof createClient>,
  ctx: AuthCtx,
  p: any,
  action: "load" | "unload",
) {
  if (!p.card_id) return err("card_validation_failed", "card_id required", 422);
  const amount = Number(p.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return err("card_validation_failed", "amount must be a positive number", 422);
  }
  const currency = "XAF";
  const idem = p.idempotency_key ?? crypto.randomUUID();

  // Idempotency short-circuit
  const { data: existing } = await sb
    .from("card_fee_events")
    .select("id,card_id,amount")
    .eq("idempotency_key", `${idem}:fund`)
    .maybeSingle();
  if (existing) {
    const { data: card } = await sb.from("virtual_cards").select("*").eq("id", existing.card_id).maybeSingle();
    return json({ card, replayed: true });
  }

  const { data: card } = await sb.from("virtual_cards").select("*").eq("id", p.card_id).maybeSingle();
  if (!card) return err("card_not_found", "card not found", 404);
  if (!ctx.isAdmin && card.user_id !== ctx.userId) return err("forbidden", "not your card", 403);
  if (card.status !== "active") return err("card_not_active", "Card must be active to move funds.", 409);

  const providerCardId = card.provider === "nium" ? card.nium_card_id : card.kora_card_id;
  if (!providerCardId) return err("card_provider_id_missing", "no provider card id", 500);

  // Per-transaction fee (admin-managed)
  const feeCfg = await resolveCardFee(sb, "card_transaction_fee");
  const feeAmount = computeFee(feeCfg, amount);
  const totalDebit = action === "load" ? amount + feeAmount : feeAmount;

  if (totalDebit > 0) {
    const debit = await debitPrimaryWallet(sb, card.user_id, totalDebit, currency);
    if (!debit.ok) return err("card_wallet_insufficient", "Not enough wallet balance to cover this move plus fees.", 402);
    if (feeAmount > 0) {
      await recordCardFeeLedger(sb, {
        userId: card.user_id,
        cardId: card.id,
        feeType: "card_transaction_fee",
        amount: feeAmount,
        currency,
        accountId: debit.account_id ?? null,
        idempotencyKey: `${idem}:fund`,
        note: `${action === "load" ? "Card top-up" : "Card withdrawal"} fee`,
      });
    }
  }

  // Provider call
  try {
    await loadCard(card.provider, providerCardId, amount, currency, action, `${idem}:${action}`);
  } catch (e: any) {
    return err("card_provider_unavailable", e?.message ?? "provider_load_failed", 502);
  }

  // Update card balance snapshot (XAF-cents shown as balance_usd column historically)
  const nextBalance = Number(card.balance_usd ?? 0) + (action === "load" ? amount : -amount);
  const { data: updated } = await sb
    .from("virtual_cards")
    .update({ balance_usd: nextBalance, updated_at: new Date().toISOString() })
    .eq("id", card.id)
    .select()
    .single();

  return json({ card: updated, fee_charged: feeAmount, currency });
}

// ---------- Admin: search + list ALL cards across tenants ----------
async function actionAdminList(
  sb: ReturnType<typeof createClient>,
  ctx: AuthCtx,
  p: any,
) {
  if (!ctx.isAdmin) return err("forbidden", "admin only", 403);
  const q = String(p.search ?? "").trim();
  const status = p.status ? String(p.status) : null;
  const provider = p.provider ? String(p.provider) : null;
  const limit = Math.min(200, Number(p.limit ?? 50));

  let query = sb
    .from("virtual_cards")
    .select("id,user_id,form_factor,brand,status,provider,nium_card_id,kora_card_id,balance_usd,spending_controls,created_at,frozen_at,terminated_at,metadata")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);
  if (provider) query = query.eq("provider", provider);
  if (q) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    const parts: string[] = [
      `nium_card_id.ilike.%${q}%`,
      `kora_card_id.ilike.%${q}%`,
    ];
    if (isUuid) { parts.push(`id.eq.${q}`, `user_id.eq.${q}`); }
    query = query.or(parts.join(","));
  }
  const { data, error } = await query;
  if (error) return err("admin_list_failed", error.message, 500);
  return json({ cards: data ?? [] });
}

