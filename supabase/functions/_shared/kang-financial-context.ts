// Shared helper to build a concise, privacy-safe financial snapshot for the
// Kang Agent. All aggregation happens server-side; the resulting text is the
// only thing that ever leaves this module.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

type Admin = ReturnType<typeof createClient>;

const fmt = (n: number, currency = "XAF") => {
  const rounded = Math.round(n);
  const withSep = rounded.toLocaleString("en-US");
  return `${withSep} ${currency}`;
};

const relDay = (iso: string) => {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const categoryOf = (t: any): string => {
  const meta = (t.metadata ?? {}) as Record<string, any>;
  const merchant = (t.merchant_details ?? {}) as Record<string, any>;
  return (
    meta.category ||
    meta.spending_category ||
    merchant.category ||
    merchant.merchant_category ||
    t.transaction_type ||
    "Other"
  ).toString();
};

const merchantOf = (t: any): string => {
  const merchant = (t.merchant_details ?? {}) as Record<string, any>;
  return (
    merchant.name ||
    merchant.merchant_name ||
    t.transaction_information ||
    t.transaction_type ||
    "Transaction"
  ).toString().slice(0, 40);
};

export async function buildFinancialContext(
  admin: Admin,
  userId: string,
): Promise<string> {
  try {
    // ---- Balance & currency (latest per user across their accounts) --------
    let balance = 0;
    let currency = "XAF";
    const { data: accounts } = await admin
      .from("accounts")
      .select("id, currency")
      .eq("user_id", userId)
      .eq("is_active", true);

    const accountIds = (accounts ?? []).map((a: any) => a.id);
    if (accountIds.length > 0) {
      currency = (accounts as any[])[0].currency ?? "XAF";
      const { data: balances } = await admin
        .from("account_balances")
        .select("amount, currency, credit_debit_indicator, balance_type, balance_datetime, account_id")
        .in("account_id", accountIds)
        .order("balance_datetime", { ascending: false })
        .limit(50);

      const seen = new Set<string>();
      for (const b of (balances ?? []) as any[]) {
        if (seen.has(b.account_id)) continue;
        seen.add(b.account_id);
        const signed =
          b.credit_debit_indicator === "Debit" ? -Number(b.amount) : Number(b.amount);
        balance += signed;
      }
    }

    // ---- Credit score ------------------------------------------------------
    const { data: score } = await admin
      .from("credit_scores")
      .select("score")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ---- Month-to-date income / expense & categories -----------------------
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data: monthTxs } = await admin
      .from("transactions")
      .select(
        "amount, currency, credit_debit_indicator, transaction_type, transaction_information, merchant_details, metadata, created_at, booking_datetime",
      )
      .eq("user_id", userId)
      .gte("created_at", monthStart.toISOString())
      .limit(500);

    let income = 0;
    let expenses = 0;
    const catTotals = new Map<string, number>();

    for (const t of (monthTxs ?? []) as any[]) {
      const amt = Number(t.amount ?? 0);
      if (!isFinite(amt) || amt === 0) continue;
      const isCredit = t.credit_debit_indicator === "Credit";
      if (isCredit) {
        income += amt;
      } else {
        expenses += amt;
        const cat = categoryOf(t);
        catTotals.set(cat, (catTotals.get(cat) ?? 0) + amt);
      }
    }

    const topCats = [...catTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // ---- Recent 3 transactions --------------------------------------------
    const { data: recent } = await admin
      .from("transactions")
      .select(
        "amount, currency, credit_debit_indicator, transaction_type, transaction_information, merchant_details, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);

    // ---- Assemble text -----------------------------------------------------
    const lines: string[] = ["USER FINANCIAL SNAPSHOT:"];
    const scoreTxt = score?.score ? `Credit Score: ${score.score}` : "Credit Score: not yet available";
    lines.push(`- Wallet Balance: ${fmt(balance, currency)} | ${scoreTxt}`);
    lines.push(`- This Month: Income ${fmt(income, currency)} | Expenses ${fmt(expenses, currency)}`);

    if (topCats.length > 0) {
      lines.push(
        `- Top Spending: ${topCats
          .map(([c, v]) => `${c} (${fmt(v, currency)})`)
          .join(", ")}`,
      );
    } else {
      lines.push("- Top Spending: no categorised spend this month");
    }

    if ((recent ?? []).length > 0) {
      const parts = (recent as any[]).map((t) => {
        const sign = t.credit_debit_indicator === "Credit" ? "+" : "-";
        return `${sign}${fmt(Number(t.amount ?? 0), t.currency ?? currency)} at ${merchantOf(t)} (${relDay(
          t.created_at,
        )})`;
      });
      lines.push(`- Recent Activity: ${parts.join("; ")}`);
    } else {
      lines.push("- Recent Activity: none yet");
    }

    return lines.join("\n");
  } catch (e) {
    console.warn("buildFinancialContext failed", (e as Error).message);
    return "";
  }
}
