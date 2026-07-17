// Smart Budgeting — consolidated router for /v1/budgeting/*.
// Path-based routing: every read/write the Budget tab needs goes through here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import {
  ALLOWED_THRESHOLDS,
  calculateRoundUp,
  classifySkip,
  nextRetry,
} from "../_shared/roundup-engine.ts";
import {
  isStrictUuidV4,
  reserveIdempotency,
  storeIdempotency,
  idempotencyResponse,
  sha256,
} from "../_shared/integration-layer/idempotency.ts";
import { problemResponse } from "../_shared/integration-layer/problem.ts";

// RFC 4122 UUID (any version) — used for resource path validation. Idempotency
// keys must be strict UUIDv4 (isStrictUuidV4) per public API contract.
const UUID_ANY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type Lang = "en" | "fr" | "pid";
// c.2L — type aliases to remove `any` from touched runtime file without
// altering runtime behaviour (no cast changes results at run time).
type SbClient = ReturnType<typeof createClient>;
type Row = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function userClient(req: Request) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    console.error("requireUser: no Authorization header");
    throw new Error("unauthorized");
  }
  const sb = userClient(req);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) {
    console.error("requireUser: getUser failed", error?.message, "token-len:", token.length);
    throw new Error("unauthorized");
  }
  // Service client for writes (bypasses RLS — we already validated user identity)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return { sb: admin, user: data.user };
}

function periodDates(period: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (period === "weekly") {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start_date: monday.toISOString().slice(0, 10), end_date: sunday.toISOString().slice(0, 10) };
  }
  return { start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) };
}

async function buildSummary(sb: SbClient, budget: Row) {
  const { data: cats } = await sb
    .from("budget_categories")
    .select("*")
    .eq("budget_id", budget.id)
    .order("category_limit", { ascending: false });

  // Pull this period's transactions for per-category counts + top merchant
  const { data: periodTx } = await sb
    .from("transactions")
    .select("amount, merchant_details, metadata, credit_debit_indicator, booking_datetime")
    .eq("user_id", budget.consumer_id)
    .gte("booking_datetime", new Date(budget.start_date).toISOString())
    .lte("booking_datetime", new Date(budget.end_date + "T23:59:59").toISOString());

  const byCat: Record<string, { count: number; merchants: Record<string, number> }> = {};
  for (const t of periodTx ?? []) {
    if (t.credit_debit_indicator && t.credit_debit_indicator !== "DEBIT") continue;
    const catKey = String((t.metadata as Row | null)?.budget_category ?? "other");
    const m = (t.merchant_details as Row | null)?.name as string | undefined;
    const slot = (byCat[catKey] ??= { count: 0, merchants: {} });
    slot.count += 1;
    if (m) slot.merchants[m] = (slot.merchants[m] ?? 0) + Number(t.amount || 0);
  }

  const categories = (cats ?? []).map((c: Row) => {
    const limit = Number(c.category_limit) || 0;
    const spent = Number(c.spent) || 0;
    const remaining = Math.max(0, limit - spent);
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    const agg = byCat[c.category_key];
    const topMerchant = agg
      ? Object.entries(agg.merchants).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      : null;
    return {
      id: c.category_key,
      name: c.name,
      icon: c.icon,
      colour: c.colour,
      limit,
      spent,
      remaining,
      percentage_used: pct,
      transaction_count: agg?.count ?? 0,
      top_merchant: topMerchant,
    };
  });

  const total_limit = Number(budget.total_limit) || categories.reduce((s: number, c: { limit: number }) => s + c.limit, 0);
  const total_spent = categories.reduce((s: number, c: { spent: number }) => s + c.spent, 0);
  const total_remaining = Math.max(0, total_limit - total_spent);
  const today = new Date();
  const end = new Date(budget.end_date);
  const start = new Date(budget.start_date);
  const days_total = Math.max(1, Math.round((+end - +start) / 86400000) + 1);
  const days_remaining = Math.max(0, Math.round((+end - +today) / 86400000));
  const elapsed = Math.max(1, days_total - days_remaining);
  const projected = (total_spent / elapsed) * days_total;

  const summary = {
    budget_id: budget.id,
    period_start: budget.start_date,
    period_end: budget.end_date,
    total_limit,
    total_spent,
    total_remaining,
    percentage_used: total_limit > 0 ? (total_spent / total_limit) * 100 : 0,
    days_remaining,
    projected_overspend: projected > total_limit,
    projected_end_balance: Math.round(total_limit - projected),
    categories,
    currency: "XAF" as const,
  };

  const fullBudget = { ...budget, categories };
  return { budget: fullBudget, summary };
}


async function getCurrentBudget(sb: SbClient, userId: string) {
  const { data } = await sb
    .from("budgets")
    .select("*")
    .eq("consumer_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function aiInsight(opts: { lang: Lang; summary: unknown; question?: string }) {
  if (!LOVABLE_AI_KEY) {
    const fallback: Record<Lang, string> = {
      en: "Connect your account to receive personalised advice. Try setting category limits first.",
      fr: "Connectez votre compte pour des conseils personnalisés. Commencez par définir des plafonds.",
      pid: "Connect your account first, then I go give you advice for your money.",
    };
    return { answer: fallback[opts.lang], confidence: 0.5, suggested_action: null };
  }
  const sys = `You are KOB AI Adviser, a friendly Cameroon-savvy budgeting coach.
Reply in ${opts.lang === "fr" ? "French" : opts.lang === "pid" ? "Cameroonian Pidgin English" : "English"}.
Keep it under 3 sentences. Currency is XAF. Be concrete.`;
  const user = opts.question
    ? `User question: ${opts.question}\nBudget snapshot JSON: ${JSON.stringify(opts.summary).slice(0, 2000)}`
    : `Give a single proactive tip based on this budget snapshot: ${JSON.stringify(opts.summary).slice(0, 2000)}`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_AI_KEY}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });
    if (!r.ok) throw new Error(`gateway ${r.status}`);
    const d = await r.json();
    const answer = d?.choices?.[0]?.message?.content?.trim() ?? "";
    return { answer, confidence: 0.85, suggested_action: null };
  } catch (e) {
    console.error("ai insight error", e);
    return {
      answer:
        opts.lang === "fr"
          ? "Conseil indisponible pour le moment, réessayez bientôt."
          : opts.lang === "pid"
          ? "Advice no dey ready now, try small time."
          : "Advice unavailable right now, please try again shortly.",
      confidence: 0.3,
      suggested_action: null,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // strip "/budgeting-ops" prefix
    const path = url.pathname.replace(/^.*\/budgeting-ops/, "") || "/";
    const method = req.method.toUpperCase();
    const { sb, user } = await requireUser(req);

    // --- GET /budgets/current
    if (method === "GET" && path === "/budgets/current") {
      const budget = await getCurrentBudget(sb, user.id);
      if (!budget) return json({ budget: null, summary: null });
      return json(await buildSummary(sb, budget));
    }

    // --- POST /budgets
    if (method === "POST" && path === "/budgets") {
      const body = await req.json().catch(() => ({}));
      const period = body.period ?? "monthly";
      const dates = body.start_date && body.end_date ? { start_date: body.start_date, end_date: body.end_date } : periodDates(period);
      const categories: Array<{ id: string; limit: number; name?: string; icon?: string; colour?: string }> = body.categories ?? [];
      const total_limit = Number(body.total_limit) || categories.reduce((s, c) => s + (c.limit || 0), 0);

      // archive prior active budgets
      await sb.from("budgets").update({ status: "archived" }).eq("consumer_id", user.id).eq("status", "active");

      const { data: budget, error } = await sb
        .from("budgets")
        .insert({
          consumer_id: user.id,
          name: body.name ?? "My Budget",
          period,
          start_date: dates.start_date,
          end_date: dates.end_date,
          total_limit,
          currency: "XAF",
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;

      if (categories.length) {
        const rows = categories.map((c) => ({
          budget_id: budget.id,
          consumer_id: user.id,
          category_key: c.id,
          name: c.name ?? c.id,
          icon: c.icon ?? "DotsThree",
          colour: c.colour ?? "#64748B",
          category_limit: Number(c.limit) || 0,
          spent: 0,
        }));
        await sb.from("budget_categories").insert(rows);
      }
      return json(await buildSummary(sb, budget));
    }

    // --- PATCH /budgets/:id/categories/:catKey
    const catMatch = path.match(/^\/budgets\/([^/]+)\/categories\/([^/]+)$/);
    if (method === "PATCH" && catMatch) {
      const [, budgetId, catKey] = catMatch;
      const body = await req.json().catch(() => ({}));
      const { data, error } = await sb
        .from("budget_categories")
        .update({ category_limit: Number(body.limit) || 0 })
        .eq("budget_id", budgetId)
        .eq("category_key", catKey)
        .eq("consumer_id", user.id)
        .eq("status", "active")           // c.2R guard: reject deleted categories
        .eq("is_system", false)           // c.2R guard: system categories immutable
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "not_found_or_deleted" }, 404);
      return json(data);
    }

    // --- GET /alerts
    if (method === "GET" && path === "/alerts") {
      const { data } = await sb
        .from("budget_alerts")
        .select("*")
        .eq("consumer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return json({
        alerts: (data ?? []).map((a: Row) => ({
          id: a.id,
          type: a.alert_type,
          severity: a.severity,
          message: a.message,
          category_id: a.category_key,
          created_at: a.created_at,
          dismissed: a.dismissed,
        })),
      });
    }

    // --- PATCH /alerts/:id/dismiss
    const dismissMatch = path.match(/^\/alerts\/([^/]+)\/dismiss$/);
    if (method === "PATCH" && dismissMatch) {
      await sb.from("budget_alerts").update({ dismissed: true }).eq("id", dismissMatch[1]).eq("consumer_id", user.id);
      return json({ success: true });
    }

    // --- Goals
    if (method === "GET" && path === "/goals") {
      const { data } = await sb
        .from("savings_goals")
        .select("*")
        .eq("consumer_id", user.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      return json({ goals: data ?? [] });
    }

    if (method === "POST" && path === "/goals") {
      const body = await req.json().catch(() => ({}));
      const { data, error } = await sb
        .from("savings_goals")
        .insert({
          consumer_id: user.id,
          name: body.name ?? "Goal",
          target_amount: Number(body.target_amount) || 0,
          current_amount: Number(body.current_amount) || 0,
          deadline: body.deadline ?? null,
          icon: body.icon ?? "Target",
          colour: body.colour ?? "#0EA5E9",
          round_up_enabled: !!body.round_up_enabled,
          round_up_nearest: body.round_up_nearest ?? null,
          linked_piggy_bank_id: body.linked_piggy_bank_id ?? null,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    const goalProgress = path.match(/^\/goals\/([^/]+)\/progress$/);
    if (method === "GET" && goalProgress) {
      const { data: g } = await sb
        .from("savings_goals")
        .select("*")
        .eq("id", goalProgress[1])
        .eq("consumer_id", user.id)
        .maybeSingle();
      if (!g) return json({ error: "not_found" }, 404);
      const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
      const remaining = Math.max(0, g.target_amount - g.current_amount);
      const weeklyRequired = g.deadline
        ? Math.max(0, remaining / Math.max(1, Math.ceil((+new Date(g.deadline) - Date.now()) / (7 * 86400000))))
        : 0;
      return json({
        goal_id: g.id,
        percentage_complete: pct,
        amount_remaining: remaining,
        projected_completion_date: g.deadline,
        weekly_required: weeklyRequired,
        on_track: pct >= 50 || !g.deadline,
        milestones_reached: [25, 50, 75, 100].filter((m) => pct >= m),
        next_milestone: [25, 50, 75, 100].find((m) => pct < m) ?? null,
        round_up_total_this_month: await (async () => {
          const start = new Date();
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          const { data: rups } = await sb
            .from("roundup_transactions")
            .select("roundup_amount")
            .eq("consumer_id", user.id)
            .eq("goal_id", g.id)
            .eq("state", "successful")
            .gte("created_at", start.toISOString());
          return (rups ?? []).reduce((s: number, r: Row) => s + Number(r.roundup_amount), 0);
        })(),
      });
    }

    // --- Njangi (real schedule from njangi_contributions)
    if (method === "GET" && path === "/njangi/schedule") {
      const { data: contribs } = await sb
        .from("njangi_contributions")
        .select("group_id, due_date, amount, status, group_name, reminder_enabled")
        .eq("user_id", user.id)
        .in("status", ["pending", "due", "scheduled"])
        .order("due_date", { ascending: true })
        .limit(10);
      const today = Date.now();
      const schedules = (contribs ?? []).map((c: Row) => ({
        group_id: c.group_id,
        group_name: c.group_name ?? "Njangi group",
        next_contribution_date: c.due_date,
        next_contribution_amount: Number(c.amount) || 0,
        days_until_due: Math.max(0, Math.round((+new Date(c.due_date) - today) / 86400000)),
        budget_impact_xaf: Number(c.amount) || 0,
        reminder_enabled: !!c.reminder_enabled,
      }));
      return json({ schedules });
    }

    // --- Insights
    if (method === "GET" && path === "/insights") {
      const lang = (url.searchParams.get("lang") as Lang) || "en";
      const budget = await getCurrentBudget(sb, user.id);
      const summary = budget ? (await buildSummary(sb, budget)).summary : null;
      const result = await aiInsight({ lang, summary });
      return json({
        answer: result.answer,
        lang,
        confidence: result.confidence,
        suggested_action: result.suggested_action,
        generated_at: new Date().toISOString(),
      });
    }

    if (method === "POST" && path === "/insights/ask") {
      const body = await req.json().catch(() => ({}));
      const lang = (body.lang as Lang) ?? "en";
      const budget = await getCurrentBudget(sb, user.id);
      const summary = budget ? (await buildSummary(sb, budget)).summary : null;
      const result = await aiInsight({ lang, summary, question: body.question });
      await sb.from("budget_insights").insert({
        consumer_id: user.id,
        lang,
        question: body.question ?? null,
        answer: result.answer,
        confidence: result.confidence,
      });
      return json({
        answer: result.answer,
        lang,
        confidence: result.confidence,
        suggested_action: result.suggested_action,
        generated_at: new Date().toISOString(),
      });
    }

    // --- Analytics (real data)
    if (method === "GET" && path === "/analytics/merchants") {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { data: tx } = await sb
        .from("transactions")
        .select("amount, merchant_details, metadata")
        .eq("user_id", user.id)
        .gte("booking_datetime", start.toISOString())
        .limit(1000);
      const agg: Record<string, { total: number; count: number; cat: string }> = {};
      for (const t of tx ?? []) {
        const name = (t.merchant_details as Row | null)?.name as string | undefined;
        if (!name) continue;
        const cat = String((t.metadata as Row | null)?.budget_category ?? "other");
        const slot = (agg[name] ??= { total: 0, count: 0, cat });
        slot.total += Number(t.amount) || 0;
        slot.count += 1;
      }
      const merchants = Object.entries(agg)
        .map(([name, v]) => ({ name, category_id: v.cat, total_spent: v.total, transaction_count: v.count }))
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 20);
      return json({ merchants });
    }
    if (method === "GET" && path === "/analytics/monthly") {
      const months = Math.min(Number(url.searchParams.get("months")) || 3, 12);
      const start = new Date();
      start.setMonth(start.getMonth() - months + 1, 1);
      start.setHours(0, 0, 0, 0);
      const { data: tx } = await sb
        .from("transactions")
        .select("amount, metadata, booking_datetime")
        .eq("user_id", user.id)
        .gte("booking_datetime", start.toISOString())
        .limit(5000);
      const buckets: Record<string, { total: number; by_category: Record<string, number> }> = {};
      for (const t of tx ?? []) {
        const d = new Date(t.booking_datetime);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const cat = String((t.metadata as Row | null)?.budget_category ?? "other");
        const slot = (buckets[key] ??= { total: 0, by_category: {} });
        slot.total += Number(t.amount) || 0;
        slot.by_category[cat] = (slot.by_category[cat] ?? 0) + Number(t.amount) || 0;
      }
      const out = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, total_spent: v.total, by_category: v.by_category }));
      return json({ months: out });
    }


    // ============================================================
    // ROUND-UP SAVINGS
    // ============================================================
    async function getOrCreateSettings() {
      const { data: existing } = await sb
        .from("roundup_settings")
        .select("*")
        .eq("consumer_id", user.id)
        .maybeSingle();
      if (existing) return existing;
      const { data: created } = await sb
        .from("roundup_settings")
        .insert({ consumer_id: user.id })
        .select()
        .single();
      return created;
    }

    async function logEvent(eventType: string, payload: unknown, txId?: string | null) {
      await sb.from("roundup_events").insert({
        consumer_id: user.id,
        transaction_id: txId ?? null,
        event_type: eventType,
        payload,
      });
    }

    if (method === "GET" && path === "/roundup/settings") {
      const s = await getOrCreateSettings();
      return json({ settings: s });
    }

    if (method === "PATCH" && path === "/roundup/settings") {
      const body = await req.json().catch(() => ({}));
      const patch: Record<string, unknown> = {};
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      if (typeof body.threshold === "number" && ALLOWED_THRESHOLDS.includes(body.threshold)) {
        patch.threshold = body.threshold;
      }
      for (const k of ["min_save", "max_save", "daily_cap", "min_balance_floor"] as const) {
        if (typeof body[k] === "number" && body[k] >= 0) patch[k] = Math.round(body[k]);
      }
      if (body.default_goal_id === null || typeof body.default_goal_id === "string") {
        // c.3R guard: refuse to attach an archived goal as the default target.
        if (typeof body.default_goal_id === "string") {
          const { data: goalRow } = await sb
            .from("savings_goals")
            .select("status")
            .eq("id", body.default_goal_id)
            .eq("consumer_id", user.id)
            .maybeSingle();
          if (!goalRow) return json({ error: "goal_not_found" }, 404);
          if (goalRow.status === "archived") {
            return json({ error: "goal_archived" }, 409);
          }
        }
        patch.default_goal_id = body.default_goal_id;
      }

      if (body.paused_until === null || typeof body.paused_until === "string") {
        patch.paused_until = body.paused_until;
      }
      if (typeof body.source_filter === "string" && ["wallet", "bank", "both"].includes(body.source_filter)) {
        patch.source_filter = body.source_filter;
      }
      if (typeof body.credit_boost_enabled === "boolean") {
        patch.credit_boost_enabled = body.credit_boost_enabled;
      }
      await getOrCreateSettings();
      const { data, error } = await sb
        .from("roundup_settings")
        .update(patch)
        .eq("consumer_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return json({ settings: data });
    }


    if (method === "POST" && path === "/roundup/preview") {
      const body = await req.json().catch(() => ({}));
      const settings = await getOrCreateSettings();
      const amount = Number(body.amount) || 0;
      const threshold = Number(body.threshold) || settings.threshold;
      const roundup = calculateRoundUp({
        amount,
        threshold,
        minSave: settings.min_save,
        maxSave: settings.max_save,
      });
      const rounded = roundup > 0 ? amount + roundup : Math.ceil(amount / threshold) * threshold;
      return json({ original_amount: amount, rounded_amount: rounded, roundup_amount: roundup, threshold_used: threshold });
    }

    // Internal processor shared between wallet + bank-tx flows.
    async function processRoundup(opts: {
      sourceTxId: string;
      amount: number;
      walletBalance: number;
      sourceKind: "wallet" | "bank" | "manual";
      sourceAccountId?: string | null;
      bankId?: string | null;
      merchantName?: string | null;
      idempotencyKey?: string;
    }) {
      const idempotencyKey = opts.idempotencyKey ?? crypto.randomUUID();
      const settings = await getOrCreateSettings();

      // c.3R atomicity gate: honour a disabled configuration BEFORE inserting
      // a new roundup_transactions row. classifySkip would otherwise persist
      // a state='skipped' row after disable, violating the ratified "New
      // round-up instructions created: 0" guarantee.
      if (!settings.enabled) return { skipped: true, reason: "disabled" as const };

      // Source filter gate (bank vs wallet)
      if (settings.source_filter === "wallet" && opts.sourceKind === "bank") {
        return { skipped: true, reason: "source_filtered" as const };
      }
      if (settings.source_filter === "bank" && opts.sourceKind === "wallet") {
        return { skipped: true, reason: "source_filtered" as const };
      }


      // Idempotency on (consumer_id, source_tx_id)
      const { data: existing } = await sb
        .from("roundup_transactions")
        .select("*")
        .eq("consumer_id", user.id)
        .eq("source_tx_id", opts.sourceTxId)
        .maybeSingle();
      if (existing) return { transaction: existing, replayed: true as const };

      await logEvent("TRANSACTION_DETECTED", {
        source_tx_id: opts.sourceTxId,
        amount: opts.amount,
        source_kind: opts.sourceKind,
      });

      const roundup = calculateRoundUp({
        amount: opts.amount,
        threshold: settings.threshold,
        minSave: settings.min_save,
        maxSave: settings.max_save,
      });
      const rounded = opts.amount + roundup;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data: todays } = await sb
        .from("roundup_transactions")
        .select("roundup_amount")
        .eq("consumer_id", user.id)
        .eq("state", "successful")
        .gte("created_at", startOfDay.toISOString());
      const todaysTotal = (todays ?? []).reduce((s: number, r: Row) => s + Number(r.roundup_amount), 0);

      const skipReason = classifySkip({
        enabled: settings.enabled,
        pausedUntil: settings.paused_until,
        roundUpAmount: roundup,
        minSave: settings.min_save,
        walletBalance: opts.walletBalance,
        minBalanceFloor: settings.min_balance_floor,
        todaysSavedTotal: todaysTotal,
        dailyCap: settings.daily_cap,
      });


      // c.3R atomicity re-verify: consult the authoritative DB state for
      // `enabled` immediately before inserting the round-up instruction. This
      // narrows the disable/instruction-creation race to a single DB round-trip
      // window and provides the shared database-backed check required for the
      // ratified "New round-up instructions created: 0 after disable"
      // guarantee. No handler-local memory lock is used.
      const { data: liveSettings } = await sb
        .from("roundup_settings")
        .select("enabled")
        .eq("consumer_id", user.id)
        .eq("enabled", true)
        .maybeSingle();
      if (!liveSettings) return { skipped: true, reason: "disabled" as const };

      // c.3R goal-linked guard: reject new instructions targeting an archived
      // goal. The archived goal is the terminal state; contributions and
      // round-ups may not be added to it.
      if (settings.default_goal_id) {
        const { data: goalRow } = await sb
          .from("savings_goals")
          .select("status")
          .eq("id", settings.default_goal_id)
          .eq("consumer_id", user.id)
          .maybeSingle();
        if (goalRow?.status === "archived") {
          return { skipped: true, reason: "goal_archived" as const };
        }
      }

      const { data: tx, error: insErr } = await sb
        .from("roundup_transactions")
        .insert({
          consumer_id: user.id,
          source_tx_id: opts.sourceTxId,
          source_kind: opts.sourceKind,
          source_account_id: opts.sourceAccountId ?? null,
          bank_id: opts.bankId ?? null,
          merchant_name: opts.merchantName ?? null,
          goal_id: settings.default_goal_id,
          original_amount: opts.amount,
          rounded_amount: rounded,
          roundup_amount: Math.max(roundup, 0),
          threshold_used: settings.threshold,
          idempotency_key: idempotencyKey,
          state: skipReason ? "skipped" : "pending",
          skip_reason: skipReason,
        })
        .select()
        .single();
      if (insErr) throw insErr;


      await logEvent("ROUNDUP_CALCULATED", { roundup, threshold: settings.threshold }, tx.id);

      if (skipReason) {
        const evt =
          skipReason === "low_balance"
            ? "LOW_BALANCE_SKIPPED"
            : skipReason === "daily_cap"
            ? "DAILY_CAP_SKIPPED"
            : skipReason === "below_min"
            ? "BELOW_MIN_SKIPPED"
            : "PAUSED";
        await logEvent(evt, { reason: skipReason }, tx.id);
        return { transaction: tx, skipped: true, reason: skipReason };
      }

      await logEvent("SAVE_PENDING", { roundup }, tx.id);

      const { data: updated } = await sb
        .from("roundup_transactions")
        .update({ state: "successful" })
        .eq("id", tx.id)
        .select()
        .single();

      // Credit the independent Saving Vault (round-ups are kept separate from goals)
      const { data: vault } = await sb
        .from("savings_vaults")
        .select("balance")
        .eq("consumer_id", user.id)
        .maybeSingle();
      const prevBal = Number(vault?.balance ?? 0);
      const newBal = prevBal + roundup;
      if (vault) {
        await sb.from("savings_vaults")
          .update({ balance: newBal })
          .eq("consumer_id", user.id);
      } else {
        await sb.from("savings_vaults")
          .insert({ consumer_id: user.id, balance: newBal });
      }
      await sb.from("vault_transactions").insert({
        consumer_id: user.id,
        kind: "credit",
        amount: roundup,
        balance_after: newBal,
        source: "roundup",
        source_ref: tx.id,
        description: `Round-up from ${opts.sourceKind} transaction`,
      });

      // Credit-score hook: emit a SAVINGS_ROUNDUP credit event for the engine.
      let creditEventId: string | null = null;
      if (settings.credit_boost_enabled && roundup > 0) {
        const { data: ce } = await sb
          .from("credit_events")
          .insert({
            user_id: user.id,
            event_type: "SAVINGS_ROUNDUP",
            event_time: new Date().toISOString(),
            value_numeric: roundup,
            source: "budgeting-ops/roundup",
            description: `Round-up saving of ${roundup} XAF from ${opts.sourceKind} transaction`,
            metadata: {
              roundup_transaction_id: tx.id,
              source_kind: opts.sourceKind,
              source_tx_id: opts.sourceTxId,
              bank_id: opts.bankId ?? null,
              goal_id: settings.default_goal_id,
            },
          })
          .select("id")
          .single();
        creditEventId = ce?.id ?? null;
        if (creditEventId) {
          await sb
            .from("roundup_transactions")
            .update({ credit_event_id: creditEventId })
            .eq("id", tx.id);
        }
      }

      await sb
        .from("roundup_settings")
        .update({ consecutive_failures: 0 })
        .eq("consumer_id", user.id);

      await logEvent("SAVE_SUCCESS", { roundup, credit_event_id: creditEventId }, tx.id);
      return { transaction: updated, success: true, credit_event_id: creditEventId };
    }

    if (method === "POST" && path === "/roundup/process") {
      const body = await req.json().catch(() => ({}));
      const sourceTxId = String(body.source_tx_id ?? "");
      const amount = Number(body.amount) || 0;
      if (!sourceTxId || amount <= 0) return json({ error: "invalid_request" }, 400);
      const result = await processRoundup({
        sourceTxId,
        amount,
        walletBalance: Number(body.wallet_balance ?? 0),
        sourceKind: (body.source_kind as string | undefined) ?? "wallet",
        merchantName: body.merchant_name ?? null,
        idempotencyKey: body.idempotency_key,
      });
      return json(result);
    }

    // Process a round-up from a real bank-sourced transaction (Open Banking / KOB connector).
    if (method === "POST" && path === "/roundup/process-bank-tx") {
      const body = await req.json().catch(() => ({}));
      const bankTxId = String(body.bank_tx_id ?? "");
      if (!bankTxId) return json({ error: "invalid_request" }, 400);

      // Resolve the bank-sourced transaction and verify the account belongs to this consumer.
      const { data: btx } = await sb
        .from("bank_sourced_transactions")
        .select("id, account_id, external_tx_id, amount, credit_debit, description, booking_date")
        .eq("id", bankTxId)
        .maybeSingle();
      if (!btx) return json({ error: "bank_tx_not_found" }, 404);
      if (btx.credit_debit && btx.credit_debit !== "DEBIT") {
        return json({ error: "not_a_debit", credit_debit: btx.credit_debit }, 400);
      }

      const { data: acct } = await sb
        .from("bank_sourced_accounts")
        .select("id, bank_id, customer_id")
        .eq("id", btx.account_id)
        .maybeSingle();
      if (!acct) return json({ error: "bank_account_not_found" }, 404);

      const { data: bankCustomer } = await sb
        .from("bank_customers")
        .select("id, user_id")
        .eq("id", acct.customer_id)
        .maybeSingle();
      if (!bankCustomer || bankCustomer.user_id !== user.id) {
        return json({ error: "forbidden" }, 403);
      }

      const result = await processRoundup({
        sourceTxId: `bank:${btx.id}`,
        amount: Number(btx.amount) || 0,
        walletBalance: Number(body.wallet_balance ?? Infinity), // bank flow trusts caller balance
        sourceKind: "bank",
        sourceAccountId: acct.id,
        bankId: acct.bank_id,
        merchantName: btx.description ?? null,
        idempotencyKey: body.idempotency_key,
      });
      return json(result);
    }


    if (method === "GET" && path === "/roundup/transactions") {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 100);
      const { data } = await sb
        .from("roundup_transactions")
        .select("*")
        .eq("consumer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { data: monthData } = await sb
        .from("roundup_transactions")
        .select("roundup_amount")
        .eq("consumer_id", user.id)
        .eq("state", "successful")
        .gte("created_at", startOfMonth.toISOString());
      const monthTotal = (monthData ?? []).reduce(
        (s: number, r: Row) => s + Number(r.roundup_amount),
        0,
      );
      return json({ transactions: data ?? [], saved_this_month: monthTotal });
    }

    const retryMatch = path.match(/^\/roundup\/transactions\/([^/]+)\/retry$/);
    if (method === "POST" && retryMatch) {
      const txId = retryMatch[1];
      const { data: tx } = await sb
        .from("roundup_transactions")
        .select("*")
        .eq("id", txId)
        .eq("consumer_id", user.id)
        .maybeSingle();
      if (!tx) return json({ error: "not_found" }, 404);
      if (tx.state !== "failed") return json({ error: "not_retryable", state: tx.state }, 400);

      const { data: updated } = await sb
        .from("roundup_transactions")
        .update({ state: "successful", retry_count: tx.retry_count + 1 })
        .eq("id", txId)
        .select()
        .single();
      await logEvent("SAVE_SUCCESS", { retried: true }, txId);
      return json({ transaction: updated });
    }

    if (method === "POST" && (path === "/roundup/pause" || path === "/roundup/resume")) {
      const pausedUntil =
        path === "/roundup/pause"
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : null;
      const { data } = await sb
        .from("roundup_settings")
        .update({ paused_until: pausedUntil })
        .eq("consumer_id", user.id)
        .select()
        .single();
      return json({ settings: data });
    }


    // ============================================================
    // Phase 1B-R1I-c.2R — Budget archive & Category soft-delete
    // Ratified contract: 204 / 400 / 401 / 404 / 409 / 429 / 500.
    // Masked 404 for cross-owner / cross-tenant. No 403.
    // ============================================================
    const ERR_TYPE = "https://api.kangopenbanking.com/errors";

    function badReqProblem(reason: string, code: string) {
      return problemResponse(req, 400, "Bad Request", reason, {
        type: `${ERR_TYPE}/${code.toLowerCase().replace(/_/g, "-")}`,
        extensions: { code },
      });
    }
    function notFoundProblem() {
      return problemResponse(req, 404, "Not Found",
        "The requested resource does not exist or is not accessible to this caller.",
        { type: `${ERR_TYPE}/not-found`, extensions: { code: "RESOURCE_NOT_FOUND" } });
    }
    function conflictProblem(code: string, detail: string) {
      return problemResponse(req, 409, "Conflict", detail, {
        type: `${ERR_TYPE}/${code.toLowerCase().replace(/_/g, "-")}`,
        extensions: { code },
      });
    }

    function validateIdemHeader(): { key: string | null; error?: Response } {
      const raw = req.headers.get("Idempotency-Key");
      if (raw == null) return { key: null };
      if (raw.length === 0 || raw.length > 255) {
        return { key: null, error: badReqProblem("Idempotency-Key length invalid", "INVALID_IDEMPOTENCY_KEY") };
      }
      if (!isStrictUuidV4(raw)) {
        return { key: null, error: badReqProblem("Idempotency-Key must be a UUID v4.", "INVALID_IDEMPOTENCY_KEY") };
      }
      return { key: raw };
    }

    function no204(): Response {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, "X-Idempotent-Replay": "false" },
      });
    }

    // --- DELETE /budgets/{budgetId}  → budgetingDeleteBudget (ARCHIVE)
    const delBudgetMatch = path.match(/^\/budgets\/([^/]+)$/);
    if (method === "DELETE" && delBudgetMatch) {
      const budgetId = delBudgetMatch[1];
      if (!UUID_ANY_RE.test(budgetId)) return badReqProblem("Malformed budget identifier.", "INVALID_RESOURCE_ID");

      const idem = validateIdemHeader();
      if (idem.error) return idem.error;

      // Ownership + terminal-state pre-check (no reservation for terminal/404).
      const { data: existing } = await sb
        .from("budgets")
        .select("id, consumer_id, status")
        .eq("id", budgetId)
        .maybeSingle();
      if (!existing || existing.consumer_id !== user.id) return notFoundProblem();
      if (existing.status === "archived") {
        return no204(); // terminal-state idempotent success; no reservation, no side effect
      }

      // Idempotency reservation AFTER ownership + domain checks pass.
      const resource = `DELETE /v1/budgeting/budgets/${budgetId}`;
      const requestHash = await sha256(`${user.id}|${resource}|`);
      if (idem.key) {
        const r = await reserveIdempotency({
          key: idem.key, merchantId: user.id, resource, requestHash,
        });
        if (r.kind === "invalid") return badReqProblem(`Idempotency-Key invalid: ${r.reason}`, "INVALID_IDEMPOTENCY_KEY");
        if (r.kind === "conflict") return conflictProblem("IDEMPOTENCY_KEY_REUSED",
          "Idempotency-Key previously used with a different request.");
        if (r.kind === "in_flight") return conflictProblem("IDEMPOTENCY_REQUEST_IN_PROGRESS",
          "A concurrent request with this Idempotency-Key is still processing.");
        if (r.kind === "replay") {
          return idempotencyResponse(r, corsHeaders)!;
        }
      }

      // Atomic conditional archive — at most one logical transition.
      const nowIso = new Date().toISOString();
      const { data: updated, error: updErr } = await sb
        .from("budgets")
        .update({ status: "archived", archived_at: nowIso, archived_by: user.id })
        .eq("id", budgetId)
        .eq("consumer_id", user.id)
        .eq("status", "active")
        .select("id")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!updated) {
        // Lost the race to another archiver — terminal-state idempotent 204.
        if (idem.key) {
          await storeIdempotency({ key: idem.key, merchantId: user.id, resource, requestHash, status: 204, body: null });
        }
        return no204();
      }

      if (idem.key) {
        await storeIdempotency({ key: idem.key, merchantId: user.id, resource, requestHash, status: 204, body: null });
      }
      return no204();
    }

    // --- DELETE /categories/{categoryId} → budgetingDeleteCategory (PROTECTED SOFT DELETE)
    const delCatMatch = path.match(/^\/categories\/([^/]+)$/);
    if (method === "DELETE" && delCatMatch) {
      const categoryId = delCatMatch[1];
      if (!UUID_ANY_RE.test(categoryId)) return badReqProblem("Malformed category identifier.", "INVALID_RESOURCE_ID");

      const idem = validateIdemHeader();
      if (idem.error) return idem.error;

      const { data: existing } = await sb
        .from("budget_categories")
        .select("id, consumer_id, status, is_system, spent")
        .eq("id", categoryId)
        .maybeSingle();
      if (!existing || existing.consumer_id !== user.id) return notFoundProblem();
      if (existing.is_system) {
        return conflictProblem("SYSTEM_CATEGORY_PROTECTED",
          "System-managed categories cannot be soft-deleted.");
      }
      if (existing.status === "deleted") return no204(); // terminal-state idempotent

      const resource = `DELETE /v1/budgeting/categories/${categoryId}`;
      const requestHash = await sha256(`${user.id}|${resource}|`);
      if (idem.key) {
        const r = await reserveIdempotency({
          key: idem.key, merchantId: user.id, resource, requestHash,
        });
        if (r.kind === "invalid") return badReqProblem(`Idempotency-Key invalid: ${r.reason}`, "INVALID_IDEMPOTENCY_KEY");
        if (r.kind === "conflict") return conflictProblem("IDEMPOTENCY_KEY_REUSED",
          "Idempotency-Key previously used with a different request.");
        if (r.kind === "in_flight") return conflictProblem("IDEMPOTENCY_REQUEST_IN_PROGRESS",
          "A concurrent request with this Idempotency-Key is still processing.");
        if (r.kind === "replay") return idempotencyResponse(r, corsHeaders)!;
      }

      // Atomic conditional soft-delete — dependency check + transition in one statement.
      // Dependency = tracked spend for the period (spent > 0). Historical
      // transaction-category assignments remain untouched.
      const nowIso = new Date().toISOString();
      const { data: updated, error: updErr } = await sb
        .from("budget_categories")
        .update({ status: "deleted", deleted_at: nowIso, deleted_by: user.id })
        .eq("id", categoryId)
        .eq("consumer_id", user.id)
        .eq("status", "active")
        .eq("is_system", false)
        .or("spent.is.null,spent.eq.0")
        .select("id")
        .maybeSingle();
      if (updErr) throw updErr;

      if (!updated) {
        // Re-read to distinguish terminal state from active dependency.
        const { data: after } = await sb
          .from("budget_categories")
          .select("status, spent")
          .eq("id", categoryId)
          .eq("consumer_id", user.id)
          .maybeSingle();
        if (after?.status === "deleted") {
          if (idem.key) {
            await storeIdempotency({ key: idem.key, merchantId: user.id, resource, requestHash, status: 204, body: null });
          }
          return no204();
        }
        if (after && Number(after.spent) > 0) {
          return conflictProblem("CATEGORY_HAS_ACTIVE_DEPENDENCIES",
            "Category has tracked spend in the current period and cannot be soft-deleted.");
        }
        return notFoundProblem();
      }

      if (idem.key) {
        await storeIdempotency({ key: idem.key, merchantId: user.id, resource, requestHash, status: 204, body: null });
      }
      return no204();
    }

    // ============================================================
    // Phase 1B-R1I-c.3R — Goal archive & Round-up disable
    // Ratified contract: 204 / 400 / 401 / 404 / 409 / 429 / 500.
    // Masked 404 for cross-owner / cross-tenant. No 403.
    // Financial-history preservation: rows in savings_goals /
    // roundup_transactions / roundup_settings are never deleted.
    // ============================================================

    // --- DELETE /goals/{goalId} → budgetingDeleteGoal (ARCHIVE)
    const delGoalMatch = path.match(/^\/goals\/([^/]+)$/);
    if (method === "DELETE" && delGoalMatch) {
      const goalId = delGoalMatch[1];
      if (!UUID_ANY_RE.test(goalId)) {
        return badReqProblem("Malformed goal identifier.", "INVALID_RESOURCE_ID");
      }

      const idem = validateIdemHeader();
      if (idem.error) return idem.error;

      // Ownership + terminal-state pre-check (no reservation for terminal/404).
      const { data: existing } = await sb
        .from("savings_goals")
        .select("id, consumer_id, status")
        .eq("id", goalId)
        .maybeSingle();
      if (!existing || existing.consumer_id !== user.id) return notFoundProblem();
      if (existing.status === "archived") {
        return no204(); // terminal-state idempotent success
      }

      // Pending-financial dependency check: any pending / retrying round-up
      // instruction targeting this goal blocks the archive. Historical
      // successful / skipped / failed rows are preserved and do not block.
      const { data: pendingRoundups } = await sb
        .from("roundup_transactions")
        .select("id")
        .eq("consumer_id", user.id)
        .eq("goal_id", goalId)
        .in("state", ["pending", "retrying"])
        .limit(1);
      if (pendingRoundups && pendingRoundups.length > 0) {
        return conflictProblem("GOAL_HAS_PENDING_FINANCIAL_OPERATIONS",
          "Goal has pending round-up instructions and cannot be archived.");
      }

      const resource = `DELETE /v1/budgeting/goals/${goalId}`;
      const requestHash = await sha256(`${user.id}|${resource}|`);
      if (idem.key) {
        const r = await reserveIdempotency({
          key: idem.key, merchantId: user.id, resource, requestHash,
        });
        if (r.kind === "invalid") return badReqProblem(`Idempotency-Key invalid: ${r.reason}`, "INVALID_IDEMPOTENCY_KEY");
        if (r.kind === "conflict") return conflictProblem("IDEMPOTENCY_KEY_REUSED",
          "Idempotency-Key previously used with a different request.");
        if (r.kind === "in_flight") return conflictProblem("IDEMPOTENCY_REQUEST_IN_PROGRESS",
          "A concurrent request with this Idempotency-Key is still processing.");
        if (r.kind === "replay") return idempotencyResponse(r, corsHeaders)!;
      }

      // Atomic conditional archive: only transitions non-archived rows owned
      // by this caller. `neq("status","archived")` covers active / paused /
      // completed / cancelled → archived per the ratified lifecycle.
      const nowIso = new Date().toISOString();
      const { data: updated, error: updErr } = await sb
        .from("savings_goals")
        .update({ status: "archived", archived_at: nowIso, archived_by: user.id })
        .eq("id", goalId)
        .eq("consumer_id", user.id)
        .neq("status", "archived")
        .select("id")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!updated) {
        // Lost race to a concurrent archiver — terminal-state idempotent 204.
        if (idem.key) {
          await storeIdempotency({ key: idem.key, merchantId: user.id, resource, requestHash, status: 204, body: null });
        }
        return no204();
      }

      if (idem.key) {
        await storeIdempotency({ key: idem.key, merchantId: user.id, resource, requestHash, status: 204, body: null });
      }
      return no204();
    }

    // --- DELETE /roundup/settings → budgetingDisableRoundUp (DISABLE)
    if (method === "DELETE" && path === "/roundup/settings") {
      const idem = validateIdemHeader();
      if (idem.error) return idem.error;

      // Ownership + terminal-state pre-check. Absence of the settings row is
      // treated as masked 404 (caller has never configured round-up).
      const { data: existing } = await sb
        .from("roundup_settings")
        .select("consumer_id, enabled")
        .eq("consumer_id", user.id)
        .maybeSingle();
      if (!existing) return notFoundProblem();
      if (existing.enabled === false) return no204(); // terminal-state idempotent

      const resource = `DELETE /v1/budgeting/roundup/settings`;
      const requestHash = await sha256(`${user.id}|${resource}|`);
      if (idem.key) {
        const r = await reserveIdempotency({
          key: idem.key, merchantId: user.id, resource, requestHash,
        });
        if (r.kind === "invalid") return badReqProblem(`Idempotency-Key invalid: ${r.reason}`, "INVALID_IDEMPOTENCY_KEY");
        if (r.kind === "conflict") return conflictProblem("IDEMPOTENCY_KEY_REUSED",
          "Idempotency-Key previously used with a different request.");
        if (r.kind === "in_flight") return conflictProblem("IDEMPOTENCY_REQUEST_IN_PROGRESS",
          "A concurrent request with this Idempotency-Key is still processing.");
        if (r.kind === "replay") return idempotencyResponse(r, corsHeaders)!;
      }

      // Atomic conditional disable: transitions enabled=true → false with a
      // DB predicate. Pending / retrying round-up rows are preserved for the
      // worker to finish; new instruction creation is blocked by the
      // enabled=true re-verify inside processRoundup().
      const nowIso = new Date().toISOString();
      const { data: updated, error: updErr } = await sb
        .from("roundup_settings")
        .update({ enabled: false, disabled_at: nowIso, disabled_by: user.id })
        .eq("consumer_id", user.id)
        .eq("enabled", true)
        .select("consumer_id")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!updated) {
        if (idem.key) {
          await storeIdempotency({ key: idem.key, merchantId: user.id, resource, requestHash, status: 204, body: null });
        }
        return no204();
      }

      if (idem.key) {
        await storeIdempotency({ key: idem.key, merchantId: user.id, resource, requestHash, status: 204, body: null });
      }
      return no204();
    }



    return json({ error: "not_found", path, method }, 404);
  } catch (e: unknown) {
    const msg = (e instanceof Error ? e.message : String(e)) || "internal_error";
    const status = msg === "unauthorized" ? 401 : 500;
    console.error("budgeting-ops error", msg);
    return json({ error: msg }, status);
  }
});
