import { useMonthlyAnalytics } from "@/hooks/budget/useBudgetApi";
import { formatXAF } from "@/lib/budget/formatXAF";

export function SpendingChart() {
  const { data, isLoading } = useMonthlyAnalytics();
  const months = data?.months ?? [];

  if (isLoading) {
    return <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />;
  }

  const max = Math.max(1, ...months.map((m) => m.total_spent));

  if (!months.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
        No spending history yet
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-[#111827] p-4">
      <div className="flex items-end gap-2 h-32">
        {months.map((m) => {
          const h = Math.max(4, (m.total_spent / max) * 100);
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t-md bg-sky-500/80 transition-[height] duration-700"
                style={{ height: `${h}%` }}
                title={formatXAF(m.total_spent)}
              />
              <div className="text-[10px] text-slate-500">{m.month.slice(5)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
