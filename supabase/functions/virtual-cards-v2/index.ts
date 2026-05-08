// =====================================================================
// virtual-cards-v2 — Kora-backed Virtual Card Issuing
// Permitted issuers: Bank staff (institution_id scope), Developers (api key
// scope), Admins. Consumer self-service issuance is intentionally NOT
// supported here (handled by the legacy `virtual-cards` function for
// existing data only).
// =====================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { Kora, KoraApiError } from "../_shared/kora-client.ts";

type TenantType = "bank" | "developer" | "platform";

interface AuthCtx {
  userId: string;
  isAdmin: boolean;
  tenantType: TenantType;
  tenantId: string | null;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (code: string, message: string, status = 400, details?: unknown) =>
  json({ type: `https://api.kangopenbanking.com/errors/${code}`, title: code, status, detail: message, details }, status);

function uuid() { return crypto.randomUUID(); }

async function resolveAuth(supabase: ReturnType<typeof createClient>, req: Request): Promise<AuthCtx> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("missing_auth");
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("invalid_token");

  const userId = user.id;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  const isAdmin = roleSet.has("admin");

  // Bank staff scope
  const { data: staff } = await supabase
    .from("staff_assignments")
    .select("institution_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (staff?.institution_id) {
    return { userId, isAdmin, tenantType: "bank", tenantId: staff.institution_id };
  }

  // Developer scope (any owned api key tenant)
  const { data: dev } = await supabase
    .from("kob_api_keys")
    .select("id")
    .eq("owner_user_id", userId)
    .limit(1)
    .maybeSingle();
  if (dev?.id) {
    return { userId, isAdmin, tenantType: "developer", tenantId: userId };
  }

  if (isAdmin) return { userId, isAdmin, tenantType: "platform", tenantId: null };

  throw new Error("forbidden_no_tenant");
}

async function audit(
  supabase: ReturnType<typeof createClient>,
  ctx: AuthCtx,
  cardId: string | null,
  action: string,
  before: unknown,
  after: unknown,
  idem: string | null,
  req: Request,
) {
  await supabase.from("virtual_card_audit_log").insert({
    card_id: cardId,
    tenant_type: ctx.tenantType,
    tenant_id: ctx.tenantId,
    actor_user_id: ctx.userId,
    actor_role: ctx.isAdmin ? "admin" : ctx.tenantType,
    action,
    before_state: before ?? null,
    after_state: after ?? null,
    ip_address: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent"),
    idempotency_key: idem,
  });
}

// ---------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------
async function createCardholder(supabase: any, ctx: AuthCtx, p: any) {
  if (!ctx.tenantId) return err("forbidden", "no tenant context", 403);
  const required = ["first_name", "last_name", "email", "customer_external_id"];
  for (const k of required) if (!p[k]) return err("card_validation_failed", `${k} required`, 422);

  const idem = p.idempotency_key || uuid();

  const koraPayload = {
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.phone,
    date_of_birth: p.date_of_birth,
    address: p.address,
    kyc: p.kyc,
  };

  let koraId: string | null = null;
  try {
    const res = await Kora.createCardholder(koraPayload, idem);
    koraId = (res.data as any)?.customer_id ?? (res.data as any)?.id ?? null;
  } catch (e) {
    if (e instanceof KoraApiError) return err(e.code, e.message, e.httpStatus || 502);
    throw e;
  }

  const { data, error } = await supabase
    .from("kora_cardholders")
    .insert({
      tenant_type: ctx.tenantType,
      tenant_id: ctx.tenantId,
      customer_external_id: p.customer_external_id,
      kora_cardholder_id: koraId,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone ?? null,
      date_of_birth: p.date_of_birth ?? null,
      address_line1: p.address?.line1 ?? null,
      address_city: p.address?.city ?? null,
      address_state: p.address?.state ?? null,
      address_country: p.address?.country ?? null,
      address_postal_code: p.address?.postal_code ?? null,
      kyc_level: p.kyc_level ?? "tier1",
      kyc_status: koraId ? "approved" : "pending",
      kyc_documents: p.kyc?.documents ?? [],
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (error) return err("card_validation_failed", error.message, 422);
  return json({ cardholder: data }, 201);
}

async function issueCard(supabase: any, ctx: AuthCtx, p: any) {
  if (!ctx.tenantId) return err("forbidden", "no tenant context", 403);
  if (!p.cardholder_id || !p.program_id) return err("card_validation_failed", "cardholder_id and program_id required", 422);

  const idem = p.idempotency_key || uuid();

  // Verify cardholder belongs to tenant
  const { data: ch } = await supabase
    .from("kora_cardholders")
    .select("*")
    .eq("id", p.cardholder_id)
    .single();
  if (!ch || ch.tenant_id !== ctx.tenantId) return err("card_not_found", "cardholder not found", 404);
  if (!ch.kora_cardholder_id) return err("card_kyc_required", "cardholder has no Kora customer id", 422);

  // Program lookup
  const { data: prog } = await supabase
    .from("virtual_card_programs")
    .select("*")
    .eq("id", p.program_id)
    .single();
  if (!prog) return err("card_validation_failed", "program not found", 422);

  let koraCard: any;
  try {
    const res = await Kora.issueCard({
      customer_id: ch.kora_cardholder_id,
      currency: prog.currency || "USD",
      amount: p.initial_funding ?? 0,
      name_on_card: `${ch.first_name} ${ch.last_name}`,
    }, idem);
    koraCard = res.data;
  } catch (e) {
    if (e instanceof KoraApiError) return err(e.code, e.message, e.httpStatus || 502);
    throw e;
  }

  const { data, error } = await supabase
    .from("virtual_cards")
    .insert({
      user_id: ctx.userId,
      cardholder_id: ch.id,
      program_id: prog.id,
      provider: "kora",
      kora_card_id: koraCard?.card_id ?? koraCard?.id,
      kora_cardholder_id: ch.kora_cardholder_id,
      tenant_type: ctx.tenantType,
      tenant_id: ctx.tenantId,
      customer_external_id: ch.customer_external_id,
      issued_by_user_id: ctx.userId,
      currency: prog.currency || "USD",
      card_name: p.card_name || `${ch.first_name} ${ch.last_name}`,
      last4: koraCard?.last4 ?? "0000",
      exp_month: koraCard?.exp_month ?? 12,
      exp_year: koraCard?.exp_year ?? new Date().getFullYear() + 3,
      brand: koraCard?.brand ?? "Visa",
      stripe_card_id: `kora_${koraCard?.card_id ?? crypto.randomUUID()}`,
      balance_usd: p.initial_funding ?? 0,
      spending_controls: {
        daily_limit: p.daily_limit ?? prog.default_daily_limit,
        monthly_limit: p.monthly_limit ?? prog.default_monthly_limit,
      },
      metadata: { kora: koraCard, idempotency_key: idem },
    })
    .select()
    .single();

  if (error) return err("card_validation_failed", error.message, 422);
  await audit(supabase, ctx, data.id, "card.issued", null, data, idem, new Request("http://x"));
  return json({ card: data }, 201);
}

async function listCards(supabase: any, ctx: AuthCtx, p: any) {
  let q = supabase.from("virtual_cards").select("*").order("created_at", { ascending: false });
  if (!ctx.isAdmin) {
    q = q.eq("tenant_type", ctx.tenantType).eq("tenant_id", ctx.tenantId);
  }
  if (p?.status) q = q.eq("status", p.status);
  const { data, error } = await q.limit(p?.limit ?? 100);
  if (error) return err("internal", error.message, 500);
  return json({ cards: data });
}

async function lifecycleAction(
  supabase: any, ctx: AuthCtx, p: any, action: "freeze" | "unfreeze" | "terminate",
) {
  if (!p.card_id) return err("card_validation_failed", "card_id required", 422);
  const idem = p.idempotency_key || uuid();

  const { data: card } = await supabase.from("virtual_cards").select("*").eq("id", p.card_id).single();
  if (!card) return err("card_not_found", "card not found", 404);
  if (!ctx.isAdmin && (card.tenant_type !== ctx.tenantType || card.tenant_id !== ctx.tenantId)) {
    return err("forbidden", "not your tenant", 403);
  }
  if (!card.kora_card_id) return err("card_validation_failed", "card has no Kora id", 422);

  try {
    if (action === "freeze") await Kora.freezeCard(card.kora_card_id, idem);
    if (action === "unfreeze") await Kora.unfreezeCard(card.kora_card_id, idem);
    if (action === "terminate") await Kora.terminateCard(card.kora_card_id, idem);
  } catch (e) {
    if (e instanceof KoraApiError) return err(e.code, e.message, e.httpStatus || 502);
    throw e;
  }

  const update: any = { updated_at: new Date().toISOString() };
  if (action === "freeze") { update.status = "frozen"; update.frozen_at = new Date().toISOString(); }
  if (action === "unfreeze") { update.status = "active"; update.frozen_at = null; }
  if (action === "terminate") { update.status = "terminated"; update.terminated_at = new Date().toISOString(); }

  const { data: after, error } = await supabase
    .from("virtual_cards").update(update).eq("id", card.id).select().single();
  if (error) return err("internal", error.message, 500);

  await audit(supabase, ctx, card.id, `card.${action}`, card, after, idem, new Request("http://x"));
  return json({ card: after });
}

async function fundOrWithdraw(supabase: any, ctx: AuthCtx, p: any, action: "fund" | "withdraw") {
  if (!p.card_id || !p.amount || p.amount <= 0) return err("card_validation_failed", "card_id and positive amount required", 422);
  const idem = p.idempotency_key || uuid();

  const { data: card } = await supabase.from("virtual_cards").select("*").eq("id", p.card_id).single();
  if (!card) return err("card_not_found", "card not found", 404);
  if (!ctx.isAdmin && (card.tenant_type !== ctx.tenantType || card.tenant_id !== ctx.tenantId)) {
    return err("forbidden", "not your tenant", 403);
  }
  if (card.status === "terminated") return err("card_terminated", "card is terminated", 409);

  try {
    if (action === "fund") {
      await Kora.fundCard(card.kora_card_id, p.amount, card.currency, idem);
    } else {
      if (Number(card.balance_usd) < p.amount) return err("card_insufficient_funds", "insufficient card balance", 409);
      await Kora.withdrawFromCard(card.kora_card_id, p.amount, card.currency, idem);
    }
  } catch (e) {
    if (e instanceof KoraApiError) return err(e.code, e.message, e.httpStatus || 502);
    throw e;
  }

  const newBal = action === "fund"
    ? Number(card.balance_usd) + Number(p.amount)
    : Number(card.balance_usd) - Number(p.amount);

  const { data: after, error } = await supabase
    .from("virtual_cards")
    .update({ balance_usd: newBal })
    .eq("id", card.id).select().single();
  if (error) return err("internal", error.message, 500);

  await supabase.from("card_funding_transactions").insert({
    virtual_card_id: card.id,
    amount: p.amount,
    currency: card.currency,
    transaction_type: action === "fund" ? "topup" : "withdraw",
    status: "completed",
    metadata: { idempotency_key: idem, provider: "kora" },
  });

  await audit(supabase, ctx, card.id, `card.${action}`, card, after, idem, new Request("http://x"));
  return json({ card: after, amount: p.amount });
}

async function getCardTxns(supabase: any, ctx: AuthCtx, p: any) {
  if (!p.card_id) return err("card_validation_failed", "card_id required", 422);
  const { data: card } = await supabase.from("virtual_cards").select("*").eq("id", p.card_id).single();
  if (!card) return err("card_not_found", "card not found", 404);
  if (!ctx.isAdmin && (card.tenant_type !== ctx.tenantType || card.tenant_id !== ctx.tenantId)) {
    return err("forbidden", "not your tenant", 403);
  }
  try {
    const r = await Kora.listTransactions(card.kora_card_id, p.page ?? 1, p.limit ?? 50);
    return json({ transactions: r.data ?? [] });
  } catch (e) {
    if (e instanceof KoraApiError) return err(e.code, e.message, e.httpStatus || 502);
    throw e;
  }
}

async function getCard(supabase: any, ctx: AuthCtx, p: any) {
  if (!p.card_id) return err("card_validation_failed", "card_id required", 422);
  const { data: card } = await supabase.from("virtual_cards").select("*").eq("id", p.card_id).single();
  if (!card) return err("card_not_found", "card not found", 404);
  if (!ctx.isAdmin && (card.tenant_type !== ctx.tenantType || card.tenant_id !== ctx.tenantId)) {
    return err("forbidden", "not your tenant", 403);
  }
  return json({
    card: {
      id: card.id,
      status: card.status,
      brand: card.brand,
      last4: card.last4,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      currency: card.currency,
      balance: String(card.balance_usd ?? 0),
      tenant_type: card.tenant_type,
      kora_card_id: card.kora_card_id,
      created_at: card.created_at,
      frozen_at: card.frozen_at,
      terminated_at: card.terminated_at,
    },
  });
}

async function revealCard(supabase: any, ctx: AuthCtx, p: any, req: Request) {
  if (!p.card_id) return err("card_validation_failed", "card_id required", 422);
  const mfaToken = p.mfa_token || req.headers.get("x-mfa-token");
  if (!mfaToken) return err("mfa_required", "step-up MFA token required to reveal card", 401);

  const { data: card } = await supabase.from("virtual_cards").select("*").eq("id", p.card_id).single();
  if (!card) return err("card_not_found", "card not found", 404);
  if (!ctx.isAdmin && (card.tenant_type !== ctx.tenantType || card.tenant_id !== ctx.tenantId)) {
    return err("forbidden", "not your tenant", 403);
  }
  if (card.status === "terminated") return err("card_terminated", "card is terminated", 409);

  try {
    const r = await Kora.revealCard(card.kora_card_id);
    await audit(supabase, ctx, card.id, "card.revealed", null, { at: new Date().toISOString() }, null, req);
    return new Response(JSON.stringify({
      reveal: r.data,
      expires_in_seconds: 60,
      pci_warning: "Sensitive data — do not log or persist.",
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
      },
    });
  } catch (e) {
    if (e instanceof KoraApiError) return err(e.code, e.message, e.httpStatus || 502);
    throw e;
  }
}

// ---------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let ctx: AuthCtx;
  try {
    ctx = await resolveAuth(supabase, req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "auth_error";
    return err(msg === "missing_auth" ? "unauthorized" : msg, msg, msg === "forbidden_no_tenant" ? 403 : 401);
  }

  let body: any = {};
  try { body = req.method !== "GET" ? await req.json() : {}; } catch { /* ignore */ }
  const action = body.action || new URL(req.url).searchParams.get("action");
  if (!action) return err("card_validation_failed", "missing action", 422);

  try {
    switch (action) {
      case "create-cardholder": return await createCardholder(supabase, ctx, body);
      case "issue-card":        return await issueCard(supabase, ctx, body);
      case "list-cards":        return await listCards(supabase, ctx, body);
      case "freeze":            return await lifecycleAction(supabase, ctx, body, "freeze");
      case "unfreeze":          return await lifecycleAction(supabase, ctx, body, "unfreeze");
      case "terminate":         return await lifecycleAction(supabase, ctx, body, "terminate");
      case "fund":              return await fundOrWithdraw(supabase, ctx, body, "fund");
      case "withdraw":          return await fundOrWithdraw(supabase, ctx, body, "withdraw");
      case "transactions":      return await getCardTxns(supabase, ctx, body);
      default:                  return err("card_validation_failed", `unknown action: ${action}`, 422);
    }
  } catch (e) {
    console.error("[virtual-cards-v2] unhandled", e);
    return err("internal", e instanceof Error ? e.message : "unknown error", 500);
  }
});
