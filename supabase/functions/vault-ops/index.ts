// Saving Vault operations: balance, transactions, limits, withdraw, statement.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function startOfTodayISO() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function startOfMonthISO() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function notify(sb: any, user_id: string, type: string, title: string, message: string, metadata: Record<string, unknown> = {}, idem?: string) {
  try {
    await sb.from("app_notifications").insert({
      user_id,
      type,
      title,
      message,
      icon: "vault",
      metadata,
      idempotency_key: idem ?? null,
    });
  } catch (_) { /* notifications are best-effort */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/vault-ops/, "").replace(/\/+$/, "") || "/";
    const method = req.method;

    async function ensureVault() {
      const { data } = await sb.from("savings_vaults")
        .select("*").eq("consumer_id", user.id).maybeSingle();
      if (data) return data;
      const { data: created, error } = await sb.from("savings_vaults")
        .insert({ consumer_id: user.id, balance: 0 })
        .select().single();
      if (error) throw error;
      return created;
    }

    if (method === "GET" && path === "/balance") {
      const v = await ensureVault();
      return json({
        balance: Number(v.balance),
        currency: v.currency,
        daily_withdrawal_limit: Number(v.daily_withdrawal_limit),
        monthly_withdrawal_limit: Number(v.monthly_withdrawal_limit),
      });
    }

    if (method === "GET" && path === "/limits") {
      const v = await ensureVault();
      const [{ data: dayRows }, { data: monthRows }] = await Promise.all([
        sb.from("vault_transactions").select("amount")
          .eq("consumer_id", user.id).eq("kind", "debit")
          .gte("created_at", startOfTodayISO()),
        sb.from("vault_transactions").select("amount")
          .eq("consumer_id", user.id).eq("kind", "debit")
          .gte("created_at", startOfMonthISO()),
      ]);
      const usedToday = (dayRows ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
      const usedMonth = (monthRows ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
      return json({
        daily_withdrawal_limit: Number(v.daily_withdrawal_limit),
        monthly_withdrawal_limit: Number(v.monthly_withdrawal_limit),
        used_today: usedToday,
        used_this_month: usedMonth,
        remaining_today: Math.max(0, Number(v.daily_withdrawal_limit) - usedToday),
        remaining_this_month: Math.max(0, Number(v.monthly_withdrawal_limit) - usedMonth),
        currency: v.currency,
      });
    }

    if (method === "PATCH" && path === "/limits") {
      const body = await req.json().catch(() => ({}));
      const patch: Record<string, number> = {};
      if (body.daily_withdrawal_limit != null) {
        const n = Number(body.daily_withdrawal_limit);
        if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return json({ error: "invalid_daily_limit", message: "Daily limit must be between 0 and 10,000,000." }, 400);
        patch.daily_withdrawal_limit = n;
      }
      if (body.monthly_withdrawal_limit != null) {
        const n = Number(body.monthly_withdrawal_limit);
        if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return json({ error: "invalid_monthly_limit", message: "Monthly limit must be between 0 and 100,000,000." }, 400);
        patch.monthly_withdrawal_limit = n;
      }
      if (patch.daily_withdrawal_limit != null && patch.monthly_withdrawal_limit != null && patch.daily_withdrawal_limit > patch.monthly_withdrawal_limit) {
        return json({ error: "daily_exceeds_monthly", message: "Daily limit cannot exceed monthly limit." }, 400);
      }
      await ensureVault();
      const { data, error } = await sb.from("savings_vaults")
        .update(patch).eq("consumer_id", user.id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({
        daily_withdrawal_limit: Number(data.daily_withdrawal_limit),
        monthly_withdrawal_limit: Number(data.monthly_withdrawal_limit),
        currency: data.currency,
      });
    }

    if (method === "GET" && path === "/transactions") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
      const { data, error } = await sb.from("vault_transactions")
        .select("*").eq("consumer_id", user.id)
        .order("created_at", { ascending: false }).limit(limit);
      if (error) return json({ error: error.message }, 500);
      return json({ transactions: data ?? [] });
    }

    if (method === "GET" && path === "/statement") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      let q = sb.from("vault_transactions")
        .select("*").eq("consumer_id", user.id)
        .order("created_at", { ascending: false }).limit(1000);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      const v = await ensureVault();
      return json({
        generated_at: new Date().toISOString(),
        consumer_id: user.id,
        currency: v.currency,
        balance: Number(v.balance),
        transactions: data ?? [],
      });
    }

    if (method === "POST" && path === "/withdraw") {
      const body = await req.json().catch(() => ({}));
      const amount = Number(body.amount);
      const destinationKind = String(body.destination_kind ?? "");
      const destinationAccountId = body.destination_account_id ? String(body.destination_account_id) : null;
      const idem = String(body.idempotency_key ?? crypto.randomUUID());

      if (!Number.isFinite(amount) || amount <= 0) {
        return json({ error: "invalid_amount", message: "Enter an amount greater than zero." }, 400);
      }
      if (!["wallet", "bank"].includes(destinationKind)) {
        return json({ error: "invalid_destination_kind", message: "Choose a wallet or a linked bank account." }, 400);
      }
      if (!destinationAccountId) {
        return json({ error: "destination_account_required", message: "Select a destination account." }, 400);
      }

      const { data: acct } = await sb.from("accounts")
        .select("id, user_id, currency, nickname, account_holder_name")
        .eq("id", destinationAccountId).maybeSingle();
      if (!acct || acct.user_id !== user.id) {
        return json({ error: "destination_not_owned", message: "That account does not belong to you." }, 403);
      }

      // Idempotency
      const { data: prior } = await sb.from("vault_transactions")
        .select("*").eq("idempotency_key", idem).maybeSingle();
      if (prior) return json({ transaction: prior, replayed: true });

      const vault = await ensureVault();
      const current = Number(vault.balance);
      if (amount > current) {
        return json({
          error: "insufficient_vault_balance",
          message: `You only have ${current.toLocaleString()} ${vault.currency} in your vault.`,
          balance: current,
        }, 400);
      }

      // Enforce limits
      const [{ data: dayRows }, { data: monthRows }] = await Promise.all([
        sb.from("vault_transactions").select("amount")
          .eq("consumer_id", user.id).eq("kind", "debit")
          .gte("created_at", startOfTodayISO()),
        sb.from("vault_transactions").select("amount")
          .eq("consumer_id", user.id).eq("kind", "debit")
          .gte("created_at", startOfMonthISO()),
      ]);
      const usedToday = (dayRows ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
      const usedMonth = (monthRows ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
      const dailyLimit = Number(vault.daily_withdrawal_limit);
      const monthlyLimit = Number(vault.monthly_withdrawal_limit);

      if (usedToday + amount > dailyLimit) {
        const remaining = Math.max(0, dailyLimit - usedToday);
        await notify(sb, user.id, "warning", "Daily limit reached",
          `Your withdrawal of ${amount.toLocaleString()} ${vault.currency} was blocked because it exceeds today's limit of ${dailyLimit.toLocaleString()} ${vault.currency}.`,
          { reason: "daily_limit_exceeded", amount, remaining },
        );
        return json({
          error: "daily_limit_exceeded",
          message: `Daily withdrawal limit of ${dailyLimit.toLocaleString()} ${vault.currency} would be exceeded. You can still withdraw ${remaining.toLocaleString()} ${vault.currency} today.`,
          daily_limit: dailyLimit,
          used_today: usedToday,
          remaining_today: remaining,
        }, 400);
      }
      if (usedMonth + amount > monthlyLimit) {
        const remaining = Math.max(0, monthlyLimit - usedMonth);
        await notify(sb, user.id, "warning", "Monthly limit reached",
          `Your withdrawal of ${amount.toLocaleString()} ${vault.currency} was blocked because it exceeds this month's limit of ${monthlyLimit.toLocaleString()} ${vault.currency}.`,
          { reason: "monthly_limit_exceeded", amount, remaining },
        );
        return json({
          error: "monthly_limit_exceeded",
          message: `Monthly withdrawal limit of ${monthlyLimit.toLocaleString()} ${vault.currency} would be exceeded. You can still withdraw ${remaining.toLocaleString()} ${vault.currency} this month.`,
          monthly_limit: monthlyLimit,
          used_this_month: usedMonth,
          remaining_this_month: remaining,
        }, 400);
      }

      // Initiation notification
      await notify(sb, user.id, "info", "Withdrawal initiated",
        `Processing ${amount.toLocaleString()} ${vault.currency} from your Saving Vault to ${acct.nickname || acct.account_holder_name || destinationKind}.`,
        { stage: "initiated", amount, destination_kind: destinationKind, destination_account_id: destinationAccountId },
        `vault_init_${idem}`,
      );

      const newBal = current - amount;
      const { error: updErr } = await sb.from("savings_vaults")
        .update({ balance: newBal }).eq("consumer_id", user.id);
      if (updErr) {
        await notify(sb, user.id, "error", "Withdrawal failed",
          `We could not complete your withdrawal of ${amount.toLocaleString()} ${vault.currency}. No funds were moved. Please try again.`,
          { stage: "failed", reason: updErr.message },
          `vault_fail_${idem}`,
        );
        return json({ error: "vault_debit_failed", message: "We could not deduct from your vault. Please try again." }, 500);
      }

      // Credit destination
      const { data: bal } = await sb.from("account_balances")
        .select("amount").eq("account_id", destinationAccountId)
        .eq("balance_type", "InterimAvailable").maybeSingle();
      const newDestBal = Number(bal?.amount ?? 0) + amount;
      await sb.from("account_balances").upsert({
        account_id: destinationAccountId,
        balance_type: "InterimAvailable",
        credit_debit_indicator: "Credit",
        amount: newDestBal,
        currency: acct.currency || vault.currency || "XAF",
        balance_datetime: new Date().toISOString(),
      }, { onConflict: "account_id,balance_type" });

      const { data: tx, error: txErr } = await sb.from("vault_transactions").insert({
        consumer_id: user.id,
        kind: "debit",
        amount,
        balance_after: newBal,
        source: "withdrawal",
        destination_kind: destinationKind,
        destination_account_id: destinationAccountId,
        description: `Withdrawal to ${acct.nickname || acct.account_holder_name || destinationKind}`,
        idempotency_key: idem,
      }).select().single();
      if (txErr) return json({ error: "ledger_failed", message: txErr.message }, 500);

      await notify(sb, user.id, "success", "Withdrawal successful",
        `${amount.toLocaleString()} ${vault.currency} was sent to ${acct.nickname || acct.account_holder_name || destinationKind}. Reference ${tx.reference_code}.`,
        { stage: "completed", reference_code: tx.reference_code, amount, destination_kind: destinationKind, destination_account_id: destinationAccountId, transaction_id: tx.id },
        `vault_done_${idem}`,
      );

      return json({
        transaction: tx,
        new_balance: newBal,
        reference_code: tx.reference_code,
        destination: {
          kind: destinationKind,
          account_id: destinationAccountId,
          label: acct.nickname || acct.account_holder_name || destinationKind,
        },
      });
    }

    return json({ error: "not_found", path }, 404);
  } catch (e) {
    return json({ error: "server_error", message: String((e as Error).message ?? e) }, 500);
  }
});
