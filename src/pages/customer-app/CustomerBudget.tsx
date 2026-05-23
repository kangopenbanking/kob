import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Plus,
  Settings2,
  TrendingUp,
  ArrowUpRight,
  ShoppingBag,
  Car,
  Smartphone,
  GraduationCap,
  HeartPulse,
  Zap,
  Users,
  Send,
  PiggyBank,
  Music2,
  MoreHorizontal,
  Target,
} from "lucide-react";
import { DonutRing } from "@/components/budget/DonutRing";
import { AnimatedAmount } from "@/components/budget/AnimatedAmount";
import { LanguageSelector } from "@/components/budget/LanguageSelector";
import { BudgetSetupSheet } from "@/components/budget/BudgetSetupSheet";
import { CategoryEditSheet } from "@/components/budget/CategoryEditSheet";
import { GoalCreateSheet } from "@/components/budget/GoalCreateSheet";
import { SpendingChart } from "@/components/budget/SpendingChart";
import { NjangiWidget } from "@/components/budget/NjangiWidget";
import {
  useBudget,
  useInsight,
  useGoals,
  useBudgetAlerts,
  useDismissAlert,
} from "@/hooks/budget/useBudgetApi";
import { getCategory, localiseCategoryName } from "@/lib/budget/budgetCategories";
import { formatXAF } from "@/lib/budget/formatXAF";
import type { BudgetLang } from "@/types/budget";

const LANG_KEY = "kob_adviser_lang";

const ICON_MAP: Record<string, any> = {
  ShoppingCart: ShoppingBag,
  Car,
  DeviceMobile: Smartphone,
  GraduationCap,
  FirstAid: HeartPulse,
  Lightning: Zap,
  UsersThree: Users,
  ArrowsLeftRight: Send,
  PiggyBank,
  MusicNote: Music2,
  DotsThree: MoreHorizontal,
};

function CatIcon({ id, className }: { id: string; className?: string }) {
  const meta = getCategory(id);
  const Icon = ICON_MAP[meta.icon] || MoreHorizontal;
  return <Icon className={className} strokeWidth={1.75} />;
}

export default function CustomerBudget() {
  const [lang, setLang] = useState<BudgetLang>(
    (typeof window !== "undefined" && (localStorage.getItem(LANG_KEY) as BudgetLang)) || "en",
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

  const monthLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, []);

  const pct = summary ? Math.min(100, Math.round(summary.percentage_used)) : 0;
  const ringColour = pct >= 100 ? "#F87171" : pct >= 80 ? "#FBBF24" : "#34D399";

  return (
    <>
      <Helmet>
        <title>Budget · Kang Open Banking</title>
        <meta
          name="description"
          content="Smart budgeting, savings goals, and trilingual AI financial advice for XAF spending."
        />
      </Helmet>

      <div
        className="min-h-screen bg-[#0B0F19] px-5 pb-28 pt-5 text-[#E8ECF3]"
        style={{ fontFamily: "DM Sans, Inter, system-ui, sans-serif" }}
      >
        {isLoading ? (
          <LoadingState />
        ) : empty ? (
          <EmptyState onStart={() => setSetupOpen(true)} />
        ) : (
          <div className="space-y-6">
            {/* Top bar — month nav + settings */}
            <header className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Budget
                </p>
                <h1
                  className="mt-1 text-[28px] font-semibold tracking-tight text-white"
                  style={{ fontFamily: "Sora, Inter, sans-serif", letterSpacing: "-0.02em" }}
                >
                  {monthLabel}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Previous month"
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/8 bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.06] active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  aria-label="Next month"
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/8 bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.06] active:scale-95"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setSetupOpen(true)}
                  aria-label="Budget settings"
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/8 bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.06] active:scale-95"
                >
                  <Settings2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </header>

            {/* Alerts */}
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4"
              >
                <div className="flex-1 text-[13px] leading-relaxed text-amber-100">{a.message}</div>
                <button
                  className="ml-3 text-[11px] uppercase tracking-wider text-amber-200/70 hover:text-amber-100"
                  onClick={() => dismissAlert.mutate(a.id)}
                >
                  Dismiss
                </button>
              </div>
            ))}

            {/* Hero — spending overview */}
            <section className="rounded-[28px] border border-white/[0.06] bg-[#111623] p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
              <div className="flex flex-col items-center text-center">
                <DonutRing
                  size={196}
                  strokeWidth={14}
                  segments={
                    summary && summary.categories.some((c) => c.spent > 0)
                      ? summary.categories.map((c) => ({
                          value: c.spent,
                          colour: getCategory(c.id).colour,
                        }))
                      : [{ value: 1, colour: "#1F2937" }]
                  }
                  centerLabel={
                    <span
                      className="text-[34px] font-semibold tracking-tight text-white"
                      style={{ fontFamily: "Sora, Inter, sans-serif", letterSpacing: "-0.03em" }}
                    >
                      {pct}%
                    </span> as any
                  }
                  centerSub={pct >= 100 ? "Over budget" : "of budget used"}
                />

                <div className="mt-5 space-y-1">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                    Spent this month
                  </div>
                  <div
                    className="text-[40px] font-semibold leading-none tracking-tight text-white"
                    style={{ fontFamily: "Sora, Inter, sans-serif", letterSpacing: "-0.03em" }}
                  >
                    <AnimatedAmount value={summary?.total_spent ?? 0} />
                  </div>
                  <div className="text-[13px] text-slate-400">
                    of {formatXAF(summary?.total_limit ?? 0)} budget
                  </div>
                </div>
              </div>

              {/* Hero stat row */}
              <div className="mt-6 grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl bg-white/[0.02]">
                <HeroStat
                  label="Left"
                  value={formatXAF(summary?.total_remaining ?? 0, true)}
                  tone="#34D399"
                />
                <HeroStat
                  label="Daily"
                  value={formatXAF(
                    summary && summary.days_remaining > 0
                      ? Math.max(0, (summary.total_remaining ?? 0) / summary.days_remaining)
                      : 0,
                    true,
                  )}
                  tone="#60A5FA"
                />
                <HeroStat
                  label="Days left"
                  value={String(summary?.days_remaining ?? 0)}
                  tone="#E8ECF3"
                />
              </div>
            </section>

            {/* AI Adviser — Emma-style insight card */}
            <section className="rounded-3xl border border-white/[0.06] bg-[#111623] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-sky-400/10 text-sky-300">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <div className="text-[13px] font-medium text-white">AI Adviser</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Personal insight
                    </div>
                  </div>
                </div>
                <LanguageSelector value={lang} onChange={setLangPersist} />
              </div>
              <p className="mt-4 min-h-[3rem] text-[14px] leading-relaxed text-slate-300">
                {insightLoading ? "Thinking…" : insight?.answer ?? defaultMessage(lang)}
              </p>
              <div className="mt-3 flex items-center justify-end">
                <button
                  onClick={() => refetchInsight()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.06]"
                  aria-label="Refresh insight"
                >
                  <RefreshCw className="h-3 w-3" strokeWidth={1.75} /> Refresh
                </button>
              </div>
            </section>

            <NjangiWidget />

            {/* Categories — Emma list style */}
            <section>
              <SectionHeader title="Categories" action={`${summary?.categories?.length ?? 0} total`} />
              <div className="overflow-hidden rounded-3xl border border-white/[0.06] bg-[#111623]">
                {(summary?.categories ?? []).slice(0, 10).map((c, idx, arr) => {
                  const meta = getCategory(c.id);
                  const cpct = Math.min(100, Math.round(c.percentage_used ?? 0));
                  const tone =
                    cpct >= 100 ? "#F87171" : cpct >= 80 ? "#FBBF24" : cpct >= 60 ? "#60A5FA" : "#34D399";
                  return (
                    <button
                      key={c.id}
                      onClick={() =>
                        setEditCat({ id: c.id, name: c.name, limit: c.limit, colour: meta.colour })
                      }
                      className={`group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] ${
                        idx !== arr.length - 1 ? "border-b border-white/[0.04]" : ""
                      }`}
                    >
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                        style={{ background: `${meta.colour}1A`, color: meta.colour }}
                      >
                        <CatIcon id={c.id} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <div
                            className="truncate text-[14px] font-medium text-white"
                            style={{ fontFamily: "Sora, Inter, sans-serif" }}
                          >
                            {localiseCategoryName(c.id, lang)}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[13px] font-medium tabular-nums text-white">
                              {formatXAF(c.spent, true)}
                            </div>
                            <div className="text-[10px] tabular-nums text-slate-500">
                              of {formatXAF(c.limit, true)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                              style={{ width: `${cpct}%`, background: tone }}
                            />
                          </div>
                          <span
                            className="w-9 text-right text-[11px] font-medium tabular-nums"
                            style={{ color: tone }}
                          >
                            {cpct}%
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Spending history */}
            <section>
              <SectionHeader title="Spending trend" action="Last 3 months" icon={<TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />} />
              <SpendingChart />
            </section>

            {/* Goals — Emma-style horizontal cards */}
            <section>
              <SectionHeader
                title="Goals"
                rightSlot={
                  <button
                    onClick={() => setGoalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-sky-300 hover:bg-white/[0.06]"
                  >
                    <Plus className="h-3 w-3" strokeWidth={2} /> New
                  </button>
                }
              />
              {goals.length === 0 ? (
                <button
                  onClick={() => setGoalOpen(true)}
                  className="flex w-full flex-col items-center gap-2 rounded-3xl border border-dashed border-white/10 bg-[#111623]/40 px-6 py-8 text-center transition-colors hover:border-white/20 hover:bg-[#111623]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-sky-400/10 text-sky-300">
                    <Target className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="text-[14px] font-medium text-white">Set your first goal</div>
                  <div className="max-w-[240px] text-[12px] text-slate-400">
                    Save towards what matters — automatically.
                  </div>
                </button>
              ) : (
                <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {goals.map((g) => {
                    const gpct = Math.min(
                      100,
                      Math.round((g.current_amount / Math.max(1, g.target_amount)) * 100),
                    );
                    return (
                      <div
                        key={g.id}
                        className="flex h-[176px] w-[164px] shrink-0 flex-col justify-between rounded-3xl border border-white/[0.06] bg-[#111623] p-4"
                      >
                        <div className="flex items-start justify-between">
                          <span
                            className="grid h-9 w-9 place-items-center rounded-2xl"
                            style={{ background: `${g.colour || "#60A5FA"}1A`, color: g.colour || "#60A5FA" }}
                          >
                            <Target className="h-4 w-4" strokeWidth={1.75} />
                          </span>
                          <ArrowUpRight className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
                        </div>
                        <div>
                          <div
                            className="truncate text-[13px] font-medium text-white"
                            style={{ fontFamily: "Sora, Inter, sans-serif" }}
                          >
                            {g.name}
                          </div>
                          <div
                            className="mt-0.5 text-[22px] font-semibold tracking-tight text-white"
                            style={{ fontFamily: "Sora, Inter, sans-serif", letterSpacing: "-0.02em" }}
                          >
                            {gpct}%
                          </div>
                          <div className="mt-1 text-[10px] tabular-nums text-slate-500">
                            {formatXAF(g.current_amount, true)} · {formatXAF(g.target_amount, true)}
                          </div>
                          <div className="mt-2 h-[4px] overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${gpct}%`, background: g.colour || "#60A5FA" }}
                            />
                          </div>
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

      <BudgetSetupSheet
        open={setupOpen}
        onOpenChange={setSetupOpen}
        lang={lang}
        onCreated={() => refetchBudget()}
      />
      <GoalCreateSheet open={goalOpen} onOpenChange={setGoalOpen} />
      <CategoryEditSheet
        open={!!editCat}
        onOpenChange={(v) => !v && setEditCat(null)}
        budgetId={budget?.budget?.id ?? ""}
        category={editCat}
      />
    </>
  );
}

function HeroStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-3 py-4 text-center">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div
        className="mt-1.5 text-[15px] font-semibold tabular-nums"
        style={{ fontFamily: "Sora, Inter, sans-serif", color: tone }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  action,
  rightSlot,
  icon,
}: {
  title: string;
  action?: string;
  rightSlot?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2
        className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white"
        style={{ fontFamily: "Sora, Inter, sans-serif", letterSpacing: "-0.01em" }}
      >
        {icon && <span className="text-slate-400">{icon}</span>}
        {title}
      </h2>
      {rightSlot ?? (action && <span className="text-[11px] text-slate-500">{action}</span>)}
    </div>
  );
}

const LoadingState: React.FC = () => (
  <div className="space-y-5 pt-2">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-3 w-16 rounded-md bg-white/5 animate-pulse" />
        <div className="h-7 w-40 rounded-md bg-white/5 animate-pulse" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-10 rounded-full bg-white/5 animate-pulse" />
        <div className="h-10 w-10 rounded-full bg-white/5 animate-pulse" />
      </div>
    </div>
    <div className="h-[360px] rounded-[28px] bg-white/5 animate-pulse" />
    <div className="h-32 rounded-3xl bg-white/5 animate-pulse" />
    <div className="h-72 rounded-3xl bg-white/5 animate-pulse" />
  </div>
);

const EmptyState: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
    <span className="grid h-16 w-16 place-items-center rounded-3xl border border-white/8 bg-white/[0.03] text-sky-300">
      <PiggyBank className="h-7 w-7" strokeWidth={1.5} />
    </span>
    <h2
      className="mt-5 text-[24px] font-semibold tracking-tight text-white"
      style={{ fontFamily: "Sora, Inter, sans-serif", letterSpacing: "-0.02em" }}
    >
      Take control of your money
    </h2>
    <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-slate-400">
      Set a monthly budget in under two minutes. Track every XAF automatically across all your accounts.
    </p>
    <button
      onClick={onStart}
      className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[13px] font-semibold text-slate-900 transition-transform active:scale-[0.98]"
    >
      Get started
      <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
    </button>
  </div>
);

const defaultMessage = (lang: BudgetLang) => {
  if (lang === "fr") return "Connectez votre compte pour recevoir des conseils personnalisés.";
  if (lang === "pid") return "Connect your account first, then I go give you advice for your money.";
  return "Connect your account to receive personalised budgeting advice.";
};
