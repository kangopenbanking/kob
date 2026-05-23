import { useNjangiBudget } from "@/hooks/budget/useBudgetApi";
import { formatXAF } from "@/lib/budget/formatXAF";

export function NjangiWidget() {
  const { data, isLoading } = useNjangiBudget();
  if (isLoading) return <div className="h-20 rounded-2xl bg-white/5 animate-pulse" />;
  const items = data?.schedules ?? [];
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-white/5 bg-[#111827] p-4 space-y-2">
      <div className="text-xs uppercase tracking-wider text-slate-400">Upcoming Njangi</div>
      {items.slice(0, 3).map((s) => (
        <div key={s.group_id} className="flex items-center justify-between text-sm">
          <span>{s.group_name}</span>
          <span className="text-amber-300">
            {formatXAF(s.next_contribution_amount, true)} · {s.days_until_due}d
          </span>
        </div>
      ))}
    </div>
  );
}
