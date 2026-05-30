import { useEffect, useMemo, useState } from "react";
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
  Sun,
  Moon,
} from "lucide-react";
import { DonutRing } from "@/components/budget/DonutRing";
import { AnimatedAmount } from "@/components/budget/AnimatedAmount";
import { LanguageSelector } from "@/components/budget/LanguageSelector";
import { BudgetSetupSheet } from "@/components/budget/BudgetSetupSheet";
import { CategoryEditSheet } from "@/components/budget/CategoryEditSheet";
import { GoalCreateSheet } from "@/components/budget/GoalCreateSheet";
import { SpendingChart } from "@/components/budget/SpendingChart";
import { NjangiWidget } from "@/components/budget/NjangiWidget";
import { RoundupCard } from "@/components/budget/RoundupCard";
import { RoundupSettingsSheet } from "@/components/budget/RoundupSettingsSheet";
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

import { useBudgetTheme, type BudgetTheme } from "@/lib/budget/theme";

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

  const [theme, toggleTheme] = useBudgetTheme();

  const { data: budget, isLoading, refetch: refetchBudget } = useBudget();
  const { data: goalsData } = useGoals();
  const { data: alertsData } = useBudgetAlerts();
  const { data: insight, refetch: refetchInsight, isFetching: insightLoading } = useInsight(lang);
  const dismissAlert = useDismissAlert();

  const [setupOpen, setSetupOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [roundupOpen, setRoundupOpen] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
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

  // Mini-donut metrics
  const totalDays = useMemo(() => {
    if (!summary?.period_start || !summary?.period_end) return 30;
    const s = new Date(summary.period_start).getTime();
    const e = new Date(summary.period_end).getTime();
    const d = Math.round((e - s) / 86400000) + 1;
    return d > 0 ? d : 30;
  }, [summary?.period_start, summary?.period_end]);
  const daysLeft = summary?.days_remaining ?? 0;
  const daysLeftPct = Math.round(Math.min(100, (daysLeft / Math.max(1, totalDays)) * 100));
  const leftPct = 100 - pct;
  const dailyTarget = summary ? summary.total_limit / Math.max(1, totalDays) : 0;
  const dailyAllowance = summary && daysLeft > 0 ? (summary.total_remaining ?? 0) / daysLeft : 0;
  const dailyPct = dailyTarget > 0 ? Math.min(100, Math.round((dailyAllowance / dailyTarget) * 100)) : 0;


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
        className="min-h-screen px-5 pb-28 pt-5 transition-colors duration-300"
        style={{
          background: "var(--bud-bg)",
          color: "var(--bud-text)",
          fontFamily: "DM Sans, Inter, system-ui, sans-serif",
        }}

      >
        {isLoading ? (
          <LoadingState />
        ) : empty ? (
          <EmptyState onStart={() => setSetupOpen(true)} theme={theme} onToggleTheme={toggleTheme} />
        ) : (
          <div className="space-y-6">
            {/* Top bar — month nav + theme toggle + settings */}
            <header className="flex items-center justify-between">
              <div>
                <p
                  className="text-[11px] font-medium uppercase tracking-[0.14em]"
                  style={{ color: "var(--bud-text-3)" }}
                >
                  Budget
                </p>
                <h1
                  className="mt-1 text-[28px] font-semibold tracking-tight"
                  style={{
                    fontFamily: "Sora, Inter, sans-serif",
                    letterSpacing: "-0.02em",
                    color: "var(--bud-text)",
                  }}
                >
                  {monthLabel}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <IconButton ariaLabel="Previous month">
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
                </IconButton>
                <IconButton ariaLabel="Next month">
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  ariaLabel={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                  onClick={toggleTheme}
                >
                  {theme === "light" ? (
                    <Moon className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <Sun className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </IconButton>
                <IconButton ariaLabel="Budget settings" onClick={() => setSetupOpen(true)}>
                  <Settings2 className="h-4 w-4" strokeWidth={1.75} />
                </IconButton>
              </div>
            </header>

            {/* Alerts */}
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between rounded-2xl border p-4"
                style={{
                  borderColor: "rgba(245,158,11,0.25)",
                  background: theme === "light" ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.06)",
                  color: theme === "light" ? "#92400E" : "#FDE68A",
                }}
              >
                <div className="flex-1 text-[13px] leading-relaxed">{a.message}</div>
                <button
                  className="ml-3 text-[11px] uppercase tracking-wider opacity-70 hover:opacity-100"
                  onClick={() => dismissAlert.mutate(a.id)}
                >
                  Dismiss
                </button>
              </div>
            ))}

            {/* Hero — spending overview */}
            <section
              className="rounded-[28px] border p-6"
              style={{
                background: "var(--bud-surface)",
                borderColor: "var(--bud-border)",
                boxShadow:
                  theme === "light"
                    ? "0 1px 2px rgba(15,23,42,0.04), 0 10px 30px -12px rgba(15,23,42,0.08)"
                    : "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
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
                      : [{ value: 1, colour: theme === "light" ? "#E5E7EB" : "#1F2937" }]
                  }
                  centerLabel={
                    <span
                      className="text-[34px] font-semibold tracking-tight"
                      style={{
                        fontFamily: "Sora, Inter, sans-serif",
                        letterSpacing: "-0.03em",
                        color: "var(--bud-text)",
                      }}
                    >
                      {pct}%
                    </span>
                  }
                  centerSub={
                    <span style={{ color: "var(--bud-text-3)" }}>
                      {pct >= 100 ? "Over budget" : "of budget used"}
                    </span>
                  }
                />

                <div className="mt-5 space-y-1">
                  <div
                    className="text-[11px] font-medium uppercase tracking-[0.14em]"
                    style={{ color: "var(--bud-text-3)" }}
                  >
                    Spent this month
                  </div>
                  <div
                    className="text-[40px] font-semibold leading-none tracking-tight"
                    style={{
                      fontFamily: "Sora, Inter, sans-serif",
                      letterSpacing: "-0.03em",
                      color: "var(--bud-text)",
                    }}
                  >
                    <AnimatedAmount value={summary?.total_spent ?? 0} />
                  </div>
                  <div className="text-[13px]" style={{ color: "var(--bud-text-2)" }}>
                    of {formatXAF(summary?.total_limit ?? 0)} budget
                  </div>
                </div>
              </div>

              {/* Hero stat row — mini donuts */}
              <div
                className="mt-6 grid grid-cols-3 gap-3"
              >
                <MiniDonutStat
                  label="Left"
                  percent={leftPct}
                  centerValue={formatXAF(summary?.total_remaining ?? 0, true)}
                  colour="#10D9A0"
                  bg={theme === "light" ? "rgba(16,217,160,0.10)" : "rgba(16,217,160,0.14)"}
                />
                <MiniDonutStat
                  label="Daily"
                  percent={dailyPct}
                  centerValue={formatXAF(dailyAllowance, true)}
                  colour="#38BDF8"
                  bg={theme === "light" ? "rgba(56,189,248,0.10)" : "rgba(56,189,248,0.14)"}
                />
                <MiniDonutStat
                  label="Days left"
                  percent={daysLeftPct}
                  centerValue={String(daysLeft)}
                  centerSub={`/${totalDays}`}
                  colour="#A78BFA"
                  bg={theme === "light" ? "rgba(167,139,250,0.12)" : "rgba(167,139,250,0.16)"}
                />
              </div>
            </section>

            {/* AI Adviser */}
            <section
              className="rounded-3xl border p-5"
              style={{
                background: "var(--bud-surface)",
                borderColor: "var(--bud-border)",
                boxShadow:
                  theme === "light"
                    ? "0 1px 2px rgba(15,23,42,0.04)"
                    : "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full"
                    style={{
                      background: theme === "light" ? "rgba(14,165,233,0.12)" : "rgba(56,189,248,0.14)",
                      color: theme === "light" ? "#0284C7" : "#7DD3FC",
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: "var(--bud-text)" }}>
                      Kang Adviser
                    </div>
                  </div>
                </div>
                <LanguageSelector value={lang} onChange={setLangPersist} />
              </div>
              <p
                className="mt-4 min-h-[3rem] text-[14px] leading-relaxed"
                style={{ color: "var(--bud-text-2)" }}
              >
                {insightLoading ? "Thinking…" : insight?.answer ?? defaultMessage(lang)}
              </p>
              <div className="mt-3 flex items-center justify-end">
                <button
                  onClick={() => refetchInsight()}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition-colors"
                  style={{
                    borderColor: "var(--bud-border)",
                    background: "var(--bud-surface-2)",
                    color: "var(--bud-text-2)",
                  }}
                  aria-label="Refresh insight"
                >
                  <RefreshCw className="h-3 w-3" strokeWidth={1.75} /> Refresh
                </button>
              </div>
            </section>

            <RoundupCard onOpenSettings={() => setRoundupOpen(true)} theme={theme} />

            <NjangiWidget />

            {/* Categories */}
            <section>
              <SectionHeader
                title="Categories"
                rightSlot={
                  (summary?.categories?.length ?? 0) > 5 ? (
                    <button
                      onClick={() => setShowAllCats((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors"
                      style={{
                        borderColor: "var(--bud-border)",
                        background: "var(--bud-surface-2)",
                        color: "var(--bud-text-2)",
                      }}
                    >
                      {showAllCats ? "Show less" : `View all ${summary?.categories?.length ?? 0}`}
                      <ChevronRight
                        className="h-3 w-3 transition-transform"
                        strokeWidth={2}
                        style={{ transform: showAllCats ? "rotate(90deg)" : "rotate(0deg)" }}
                      />
                    </button>
                  ) : (
                    <span className="text-[11px]" style={{ color: "var(--bud-text-3)" }}>
                      {summary?.categories?.length ?? 0} total
                    </span>
                  )
                }
              />
              <div className="grid grid-cols-2 gap-3">
                {(summary?.categories ?? [])
                  .slice(0, showAllCats ? undefined : 4)
                  .map((c) => {
                    const meta = getCategory(c.id);
                    const cpct = Math.min(100, Math.round(c.percentage_used ?? 0));
                    const tone =
                      cpct >= 100
                        ? "#F87171"
                        : cpct >= 80
                        ? "#FBBF24"
                        : cpct >= 60
                        ? "#60A5FA"
                        : "#10D9A0";
                    return (
                      <button
                        key={c.id}
                        onClick={() =>
                          setEditCat({ id: c.id, name: c.name, limit: c.limit, colour: meta.colour })
                        }
                        className="group relative flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.98]"
                        style={{
                          background: "var(--bud-surface)",
                          borderColor: "var(--bud-border)",
                          boxShadow:
                            theme === "light"
                              ? "0 1px 2px rgba(15,23,42,0.04)"
                              : "inset 0 1px 0 rgba(255,255,255,0.03)",
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <span
                            className="grid h-10 w-10 place-items-center rounded-2xl"
                            style={{ background: `${meta.colour}22`, color: meta.colour }}
                          >
                            <CatIcon id={c.id} className="h-5 w-5" />
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                            style={{ background: `${tone}1F`, color: tone }}
                          >
                            {cpct}%
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div
                            className="truncate text-[13px] font-medium"
                            style={{ fontFamily: "Sora, Inter, sans-serif", color: "var(--bud-text)" }}
                          >
                            {localiseCategoryName(c.id, lang)}
                          </div>
                          <div
                            className="mt-0.5 text-[11px] tabular-nums"
                            style={{ color: "var(--bud-text-3)" }}
                          >
                            {formatXAF(c.spent, true)} / {formatXAF(c.limit, true)}
                          </div>
                        </div>
                        <div
                          className="relative h-[5px] overflow-hidden rounded-full"
                          style={{ background: "var(--bud-track)" }}
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                            style={{ width: `${cpct}%`, background: tone }}
                          />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </section>

            {/* Spending history */}
            <section>
              <SectionHeader
                title="Spending trend"
                action="Last 3 months"
                icon={<TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />}
              />
              <SpendingChart />
            </section>

            {/* Goals */}
            <section>
              <SectionHeader
                title="Goals"
                rightSlot={
                  <button
                    onClick={() => setGoalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors"
                    style={{
                      borderColor: "var(--bud-border)",
                      background: "var(--bud-surface-2)",
                      color: theme === "light" ? "#0284C7" : "#7DD3FC",
                    }}
                  >
                    <Plus className="h-3 w-3" strokeWidth={2} /> New
                  </button>
                }
              />
              {goals.length === 0 ? (
                <button
                  onClick={() => setGoalOpen(true)}
                  className="flex w-full flex-col items-center gap-2 rounded-3xl border border-dashed px-6 py-8 text-center transition-colors"
                  style={{
                    borderColor: "var(--bud-border)",
                    background: "transparent",
                  }}
                >
                  <span
                    className="grid h-10 w-10 place-items-center rounded-full"
                    style={{
                      background: theme === "light" ? "rgba(14,165,233,0.12)" : "rgba(56,189,248,0.14)",
                      color: theme === "light" ? "#0284C7" : "#7DD3FC",
                    }}
                  >
                    <Target className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="text-[14px] font-medium" style={{ color: "var(--bud-text)" }}>
                    Set your first goal
                  </div>
                  <div className="max-w-[240px] text-[12px]" style={{ color: "var(--bud-text-2)" }}>
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
                    const accent = g.colour || (theme === "light" ? "#2563EB" : "#60A5FA");
                    return (
                      <div
                        key={g.id}
                        className="flex h-[176px] w-[164px] shrink-0 flex-col justify-between rounded-3xl border p-4"
                        style={{
                          background: "var(--bud-surface)",
                          borderColor: "var(--bud-border)",
                          boxShadow: theme === "light" ? "0 1px 2px rgba(15,23,42,0.04)" : "none",
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <span
                            className="grid h-9 w-9 place-items-center rounded-2xl"
                            style={{ background: `${accent}1F`, color: accent }}
                          >
                            <Target className="h-4 w-4" strokeWidth={1.75} />
                          </span>
                          <ArrowUpRight
                            className="h-4 w-4"
                            strokeWidth={1.75}
                            style={{ color: "var(--bud-text-3)" }}
                          />
                        </div>
                        <div>
                          <div
                            className="truncate text-[13px] font-medium"
                            style={{ fontFamily: "Sora, Inter, sans-serif", color: "var(--bud-text)" }}
                          >
                            {g.name}
                          </div>
                          <div
                            className="mt-0.5 text-[22px] font-semibold tracking-tight"
                            style={{
                              fontFamily: "Sora, Inter, sans-serif",
                              letterSpacing: "-0.02em",
                              color: "var(--bud-text)",
                            }}
                          >
                            {gpct}%
                          </div>
                          <div
                            className="mt-1 text-[10px] tabular-nums"
                            style={{ color: "var(--bud-text-3)" }}
                          >
                            {formatXAF(g.current_amount, true)} · {formatXAF(g.target_amount, true)}
                          </div>
                          <div
                            className="mt-2 h-[4px] overflow-hidden rounded-full"
                            style={{ background: "var(--bud-track)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${gpct}%`, background: accent }}
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
      <RoundupSettingsSheet open={roundupOpen} onOpenChange={setRoundupOpen} />
      <CategoryEditSheet
        open={!!editCat}
        onOpenChange={(v) => !v && setEditCat(null)}
        budgetId={budget?.budget?.id ?? ""}
        category={editCat}
      />
    </>
  );
}

function IconButton({
  children,
  ariaLabel,
  onClick,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="grid h-10 w-10 place-items-center rounded-full border transition-colors active:scale-95"
      style={{
        borderColor: "var(--bud-border)",
        background: "var(--bud-surface)",
        color: "var(--bud-text-2)",
      }}
    >
      {children}
    </button>
  );
}

function HeroStat({
  label,
  value,
  tone,
  border,
}: {
  label: string;
  value: string;
  tone: string;
  border?: boolean;
}) {
  return (
    <div
      className="px-3 py-4 text-center"
      style={border ? { borderRight: "1px solid var(--bud-border-soft)" } : undefined}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-[0.14em]"
        style={{ color: "var(--bud-text-3)" }}
      >
        {label}
      </div>
      <div
        className="mt-1.5 text-[15px] font-semibold tabular-nums"
        style={{ fontFamily: "Sora, Inter, sans-serif", color: tone }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniDonutStat({
  label,
  percent,
  centerValue,
  centerSub,
  colour,
  bg,
}: {
  label: string;
  percent: number;
  centerValue: string;
  centerSub?: string;
  colour: string;
  bg: string;
}) {
  const safePct = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="flex flex-col items-center rounded-2xl border px-2 py-3"
      style={{
        background: bg,
        borderColor: "var(--bud-border-soft)",
      }}
    >
      <DonutRing
        size={68}
        strokeWidth={7}
        segments={[
          { value: safePct, colour },
          { value: 100 - safePct, colour: "var(--bud-track)" },
        ]}
        centerLabel={
          <span
            className="text-[12px] font-semibold tabular-nums"
            style={{ fontFamily: "Sora, Inter, sans-serif", color: "var(--bud-text)" }}
          >
            {centerValue}
            {centerSub && (
              <span className="text-[9px] font-normal" style={{ color: "var(--bud-text-3)" }}>
                {centerSub}
              </span>
            )}
          </span>
        }
      />
      <div
        className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--bud-text-2)" }}
      >
        {label}
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
        className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
        style={{
          fontFamily: "Sora, Inter, sans-serif",
          letterSpacing: "-0.01em",
          color: "var(--bud-text)",
        }}
      >
        {icon && <span style={{ color: "var(--bud-text-3)" }}>{icon}</span>}
        {title}
      </h2>
      {rightSlot ??
        (action && (
          <span className="text-[11px]" style={{ color: "var(--bud-text-3)" }}>
            {action}
          </span>
        ))}
    </div>
  );
}

const LoadingState: React.FC = () => (
  <div className="space-y-5 pt-2">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div
          className="h-3 w-16 rounded-md animate-pulse"
          style={{ background: "var(--bud-track)" }}
        />
        <div
          className="h-7 w-40 rounded-md animate-pulse"
          style={{ background: "var(--bud-track)" }}
        />
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-10 rounded-full animate-pulse" style={{ background: "var(--bud-track)" }} />
        <div className="h-10 w-10 rounded-full animate-pulse" style={{ background: "var(--bud-track)" }} />
      </div>
    </div>
    <div className="h-[360px] rounded-[28px] animate-pulse" style={{ background: "var(--bud-track)" }} />
    <div className="h-32 rounded-3xl animate-pulse" style={{ background: "var(--bud-track)" }} />
    <div className="h-72 rounded-3xl animate-pulse" style={{ background: "var(--bud-track)" }} />
  </div>
);

const EmptyState: React.FC<{
  onStart: () => void;
  theme: BudgetTheme;
  onToggleTheme: () => void;
}> = ({ onStart, theme, onToggleTheme }) => (
  <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
    <div className="absolute right-5 top-5">
      <IconButton
        ariaLabel={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        onClick={onToggleTheme}
      >
        {theme === "light" ? (
          <Moon className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <Sun className="h-4 w-4" strokeWidth={1.75} />
        )}
      </IconButton>
    </div>
    <span
      className="grid h-16 w-16 place-items-center rounded-3xl border"
      style={{
        background: "var(--bud-surface)",
        borderColor: "var(--bud-border)",
        color: theme === "light" ? "#0284C7" : "#7DD3FC",
      }}
    >
      <PiggyBank className="h-7 w-7" strokeWidth={1.5} />
    </span>
    <h2
      className="mt-5 text-[24px] font-semibold tracking-tight"
      style={{
        fontFamily: "Sora, Inter, sans-serif",
        letterSpacing: "-0.02em",
        color: "var(--bud-text)",
      }}
    >
      Take control of your money
    </h2>
    <p className="mt-2 max-w-xs text-[13px] leading-relaxed" style={{ color: "var(--bud-text-2)" }}>
      Set a monthly budget in under two minutes. Track every XAF automatically across all your accounts.
    </p>
    <button
      onClick={onStart}
      className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-semibold transition-transform active:scale-[0.98]"
      style={{ background: "var(--bud-cta-bg)", color: "var(--bud-cta-fg)" }}
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
