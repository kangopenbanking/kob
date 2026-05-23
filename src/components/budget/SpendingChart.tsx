import { useMonthlyAnalytics } from "@/hooks/budget/useBudgetApi";
import { formatXAF } from "@/lib/budget/formatXAF";

export function SpendingChart() {
  const { data, isLoading } = useMonthlyAnalytics();
  const months = data?.months ?? [];

  if (isLoading) {
    return (
      <div
        className="h-32 rounded-3xl animate-pulse"
        style={{ background: "var(--bud-track)" }}
      />
    );
  }

  const max = Math.max(1, ...months.map((m) => m.total_spent));

  if (!months.length) {
    return (
      <div
        className="rounded-3xl border border-dashed p-6 text-center text-sm"
        style={{ borderColor: "var(--bud-border)", color: "var(--bud-text-2)" }}
      >
        No spending history yet
      </div>
    );
  }

  return (
    <div
      className="rounded-3xl p-4"
      style={{ background: "var(--bud-surface)", border: "1px solid var(--bud-border)" }}
    >
      <div className="flex items-end gap-2 h-32">
        {months.map((m) => {
          const h = Math.max(4, (m.total_spent / max) * 100);
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t-md transition-[height] duration-700"
                style={{ height: `${h}%`, background: "var(--bud-accent)" }}
                title={formatXAF(m.total_spent)}
              />
              <div className="text-[10px]" style={{ color: "var(--bud-text-3)" }}>
                {m.month.slice(5)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
