import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { ChartDonut, Sparkle, ArrowsClockwise, Plus, PencilSimple } from "@phosphor-icons/react";
import { DonutRing } from "@/components/budget/DonutRing";
import { AnimatedAmount } from "@/components/budget/AnimatedAmount";
import { LanguageSelector } from "@/components/budget/LanguageSelector";
import { BudgetSetupSheet } from "@/components/budget/BudgetSetupSheet";
import { CategoryEditSheet } from "@/components/budget/CategoryEditSheet";
import { GoalCreateSheet } from "@/components/budget/GoalCreateSheet";
import { SpendingChart } from "@/components/budget/SpendingChart";
import { NjangiWidget } from "@/components/budget/NjangiWidget";
import { useBudget, useInsight, useGoals, useBudgetAlerts, useDismissAlert } from "@/hooks/budget/useBudgetApi";
import { getCategory, localiseCategoryName } from "@/lib/budget/budgetCategories";
import { formatXAF } from "@/lib/budget/formatXAF";
import type { BudgetLang } from "@/types/budget";

const LANG_KEY = "kob_adviser_lang";

export default function CustomerBudget() {
  const [lang, setLang] = useState<BudgetLang>(
    (typeof window !== "undefined" && (localStorage.getItem(LANG_KEY) as BudgetLang)) || "en"
  );
  const setLangPersist = (l: BudgetLang) => {
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* noop */ }
  };

  const { data: budget, isLoading, refetch: refetchBudget } = useBudget();
  const { data: goalsData } = useGoals();
  const { data: alertsData } = useBudgetAlerts();
  const { data: insight, refetch: refetchInsight, isFetching: insightLoading } = useInsight(lang);
  const dismissAlert = useDismissAlert();

  const [setupOpen, setSetupOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editCat, setEditCat] = useState<{ id: string; name: string; limit: number; colour: string } | null>(null);

  const summary = budget?.summary;
  const goals = goalsData?.goals ?? [];
  const alerts = (alertsData?.alerts ?? []).filter((a) => !a.dismissed);

  const empty = !isLoading && !summary;

  return (
    <>
      <Helmet>
        <title>Budget · Kang Open Banking</title>
        <meta name="description" content="Smart budgeting, savings goals, and trilingual AI financial advice for XAF spending." />
      </Helmet>

      <div className="min-h-screen bg-[#0A0F1E] px-4 pb-24 pt-6 text-[#E2EAF4]" style={{ fontFamily: "DM Sans, sans-serif" }}>
        {empty ? (
          <EmptyState />
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <header className="flex items-center justify-between">
              <div>
                <h1 className="font-[Sora,sans-serif] text-2xl font-semibold tracking-tight">Budget</h1>
                <p className="text-xs text-slate-400">
                  {summary ? `${summary.days_remaining} days remaining this period` : "Loading…"}
                </p>
              </div>
              <ChartDonut size={28} weight="regular" className="text-sky-400" />
            </header>

            {/* Alerts */}
            {alerts.map((a) => (
              <div key={a.id} className="flex items-start justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex-1 text-sm">{a.message}</div>
                <button
                  className="ml-3 text-[11px] text-slate-400 hover:text-slate-200"
                  onClick={() => dismissAlert.mutate(a.id)}
                >
                  Dismiss ×
                </button>
              </div>
            ))}

            {/* Hero summary */}
            <section
              className="rounded-[20px] border border-white/10 p-6"
              style={{ background: "linear-gradient(135deg,#111827 0%,#1A2235 100%)" }}
            >
              <div className="flex flex-col items-center">
                <DonutRing
                  size={200}
                  segments={
                    summary
                      ? summary.categories.map((c) => ({ value: c.spent, colour: getCategory(c.id).colour }))
                      : [{ value: 1, colour: "#1f2937" }]
                  }
                  centerLabel={summary ? `${Math.round(summary.percentage_used)}%` : "—"}
                  centerSub="used"
                />
                <div className="mt-5 grid w-full grid-cols-2 gap-3">
                  <Chip label="Spent" tone="green" value={summary?.total_spent ?? 0} />
                  <Chip label="Left" tone="blue" value={summary?.total_remaining ?? 0} />
                </div>
              </div>
            </section>

            {/* AI Adviser */}
            <section
              className="rounded-[20px] border p-5"
              style={{
                borderColor: "rgba(14,165,233,0.25)",
                background: "linear-gradient(135deg,rgba(14,165,233,0.10) 0%,rgba(167,139,250,0.08) 50%,rgba(16,217,160,0.06) 100%)",
                boxShadow: "0 0 0 1px rgba(14,165,233,0.1), 0 8px 32px rgba(14,165,233,0.08)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkle size={16} weight="fill" className="text-sky-400 animate-pulse" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-sky-300">KOB AI Adviser</span>
                </div>
                <LanguageSelector value={lang} onChange={setLangPersist} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 min-h-[3rem]">
                {insightLoading ? "Thinking…" : insight?.answer ?? defaultMessage(lang)}
              </p>
              <div className="mt-3 flex items-center justify-end">
                <button
                  onClick={() => refetchInsight()}
                  className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                  aria-label="Refresh insight"
                >
                  <ArrowsClockwise size={14} weight="regular" />
                  Refresh
                </button>
              </div>
            </section>

            {/* Categories */}
            <section>
              <h2 className="mb-3 font-[Sora,sans-serif] text-base font-semibold">Spending</h2>
              <div className="space-y-2">
                {(summary?.categories ?? []).slice(0, 5).map((c) => {
                  const meta = getCategory(c.id);
                  const pct = Math.min(100, Math.round(c.percentage_used ?? 0));
                  const tone =
                    pct >= 100 ? "#FB7185" : pct >= 80 ? "#F59E0B" : pct >= 60 ? "#0EA5E9" : "#10D9A0";
                  return (
                    <div key={c.id} className="rounded-2xl border border-white/5 bg-[#111827] p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-10 w-10 items-center justify-center rounded-full text-sm"
                            style={{ background: `${meta.colour}26`, color: meta.colour }}
                          >
                            {meta.icon.slice(0, 1)}
                          </span>
                          <div>
                            <div className="font-[Sora,sans-serif] text-sm">{localiseCategoryName(c.id, lang)}</div>
                            <div className="text-[11px] text-slate-500">
                              {formatXAF(c.spent, true)} / {formatXAF(c.limit, true)}
                            </div>
                          </div>
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{ background: `${tone}1f`, color: tone }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-3 h-[5px] w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{ width: `${pct}%`, background: tone }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Goals */}
            <section>
              <h2 className="mb-3 font-[Sora,sans-serif] text-base font-semibold">Goals</h2>
              {goals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                  Set your first savings goal
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {goals.map((g) => {
                    const pct = Math.round((g.current_amount / Math.max(1, g.target_amount)) * 100);
                    return (
                      <div
                        key={g.id}
                        className="flex h-[180px] w-[160px] shrink-0 flex-col justify-between rounded-2xl border border-white/5 bg-[#111827] p-4"
                      >
                        <div className="text-xs text-slate-400">{g.name}</div>
                        <div className="font-[Sora,sans-serif] text-2xl">{pct}%</div>
                        <div className="text-[11px] text-slate-500">
                          {formatXAF(g.current_amount, true)} / {formatXAF(g.target_amount, true)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

const Chip: React.FC<{ label: string; tone: "green" | "blue"; value: number }> = ({ label, tone, value }) => (
  <div className="rounded-2xl border border-white/5 bg-white/5 p-3 text-center backdrop-blur">
    <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
    <div
      className="mt-1 font-[Sora,sans-serif] text-lg"
      style={{ color: tone === "green" ? "#10D9A0" : "#0EA5E9" }}
    >
      <AnimatedAmount value={value} compact />
    </div>
  </div>
);

const EmptyState: React.FC = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
    <ChartDonut size={72} weight="regular" className="mb-4 text-sky-500/60" />
    <h2 className="font-[Sora,sans-serif] text-2xl">Start budgeting smarter</h2>
    <p className="mt-2 max-w-xs text-sm text-slate-400">
      Set a budget in 2 minutes. Track every XAF automatically across all your accounts.
    </p>
    <button className="mt-6 rounded-2xl bg-sky-500 px-6 py-3 text-sm font-medium text-white hover:bg-sky-600">
      Set up my budget
    </button>
  </div>
);

const defaultMessage = (lang: BudgetLang) => {
  if (lang === "fr") return "Connectez votre compte pour recevoir des conseils personnalisés.";
  if (lang === "pid") return "Connect your account first, then I go give you advice for your money.";
  return "Connect your account to receive personalised budgeting advice.";
};
