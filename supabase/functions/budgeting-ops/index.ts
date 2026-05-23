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

const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type Lang = "en" | "fr" | "pid";

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

async function buildSummary(sb: any, budget: any) {
  const { data: cats } = await sb
    .from("budget_categories")
    .select("*")
    .eq("budget_id", budget.id)
    .order("category_limit", { ascending: false });

  const categories = (cats ?? []).map((c: any) => {
    const limit = Number(c.category_limit) || 0;
    const spent = Number(c.spent) || 0;
    const remaining = Math.max(0, limit - spent);
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    return {
      id: c.category_key,
      name: c.name,
      icon: c.icon,
      colour: c.colour,
      limit,
      spent,
      remaining,
      percentage_used: pct,
      transaction_count: 0,
      top_merchant: null,
    };
  });

  const total_limit = Number(budget.total_limit) || categories.reduce((s: number, c: any) => s + c.limit, 0);
  const total_spent = categories.reduce((s: number, c: any) => s + c.spent, 0);
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

async function getCurrentBudget(sb: any, userId: string) {
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

async function aiInsight(opts: { lang: Lang; summary: any; question?: string }) {
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
        .select()
        .single();
      if (error) throw error;
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
        alerts: (data ?? []).map((a: any) => ({
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
        round_up_total_this_month: 0,
      });
    }

    // --- Njangi
    if (method === "GET" && path === "/njangi/schedule") {
      return json({ schedules: [] });
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
      // persist
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

    // --- Analytics
    if (method === "GET" && path === "/analytics/merchants") {
      return json({ merchants: [] });
    }
    if (method === "GET" && path === "/analytics/monthly") {
      return json({ months: [] });
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

    async function logEvent(eventType: string, payload: any, txId?: string | null) {
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
        patch.default_goal_id = body.default_goal_id;
      }
      if (body.paused_until === null || typeof body.paused_until === "string") {
        patch.paused_until = body.paused_until;
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

    if (method === "POST" && path === "/roundup/process") {
      const body = await req.json().catch(() => ({}));
      const sourceTxId = String(body.source_tx_id ?? "");
      const idempotencyKey = String(body.idempotency_key ?? crypto.randomUUID());
      const amount = Number(body.amount) || 0;
      const walletBalance = Number(body.wallet_balance ?? 0);
      if (!sourceTxId || amount <= 0) return json({ error: "invalid_request" }, 400);

      // Idempotency: check for existing row on (consumer_id, source_tx_id)
      const { data: existing } = await sb
        .from("roundup_transactions")
        .select("*")
        .eq("consumer_id", user.id)
        .eq("source_tx_id", sourceTxId)
        .maybeSingle();
      if (existing) return json({ transaction: existing, replayed: true });

      const settings = await getOrCreateSettings();
      await logEvent("TRANSACTION_DETECTED", { source_tx_id: sourceTxId, amount });

      const roundup = calculateRoundUp({
        amount,
        threshold: settings.threshold,
        minSave: settings.min_save,
        maxSave: settings.max_save,
      });
      const rounded = amount + roundup;

      // Today's saved total (for daily cap)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data: todays } = await sb
        .from("roundup_transactions")
        .select("roundup_amount")
        .eq("consumer_id", user.id)
        .eq("state", "successful")
        .gte("created_at", startOfDay.toISOString());
      const todaysTotal = (todays ?? []).reduce((s: number, r: any) => s + Number(r.roundup_amount), 0);

      const skipReason = classifySkip({
        enabled: settings.enabled,
        pausedUntil: settings.paused_until,
        roundUpAmount: roundup,
        minSave: settings.min_save,
        walletBalance,
        minBalanceFloor: settings.min_balance_floor,
        todaysSavedTotal: todaysTotal,
        dailyCap: settings.daily_cap,
      });

      const insertRow: any = {
        consumer_id: user.id,
        source_tx_id: sourceTxId,
        goal_id: settings.default_goal_id,
        original_amount: amount,
        rounded_amount: rounded,
        roundup_amount: Math.max(roundup, 0),
        threshold_used: settings.threshold,
        idempotency_key: idempotencyKey,
        state: skipReason ? "skipped" : "pending",
        skip_reason: skipReason,
      };
      const { data: tx, error: insErr } = await sb
        .from("roundup_transactions")
        .insert(insertRow)
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
        return json({ transaction: tx, skipped: true, reason: skipReason });
      }

      await logEvent("SAVE_PENDING", { roundup }, tx.id);

      // Atomic credit: move to successful + credit goal current_amount.
      // Wallet debit is delegated to wallet-ops in production; here we
      // mark the savings as confirmed once the parent tx is confirmed.
      const { data: updated } = await sb
        .from("roundup_transactions")
        .update({ state: "successful" })
        .eq("id", tx.id)
        .select()
        .single();

      if (settings.default_goal_id) {
        const { data: g } = await sb
          .from("savings_goals")
          .select("current_amount")
          .eq("id", settings.default_goal_id)
          .eq("consumer_id", user.id)
          .maybeSingle();
        if (g) {
          await sb
            .from("savings_goals")
            .update({ current_amount: Number(g.current_amount) + roundup })
            .eq("id", settings.default_goal_id)
            .eq("consumer_id", user.id);
        }
      }

      await sb
        .from("roundup_settings")
        .update({ consecutive_failures: 0 })
        .eq("consumer_id", user.id);

      await logEvent("SAVE_SUCCESS", { roundup }, tx.id);
      return json({ transaction: updated, success: true });
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
        (s: number, r: any) => s + Number(r.roundup_amount),
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



    return json({ error: "not_found", path, method }, 404);
  } catch (e: any) {
    const msg = e?.message ?? "internal_error";
    const status = msg === "unauthorized" ? 401 : 500;
    console.error("budgeting-ops error", msg);
    return json({ error: msg }, status);
  }
});
