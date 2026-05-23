import { useNjangiBudget } from "@/hooks/budget/useBudgetApi";
import { formatXAF } from "@/lib/budget/formatXAF";

export function NjangiWidget() {
  const { data, isLoading } = useNjangiBudget();
  if (isLoading) {
    return (
      <div
        className="h-20 rounded-2xl animate-pulse"
        style={{ background: "var(--bud-track)" }}
      />
    );
  }
  const items = data?.schedules ?? [];
  if (!items.length) return null;

  return (
    <div
      className="rounded-3xl p-4 space-y-2"
      style={{
        background: "var(--bud-surface)",
        border: "1px solid var(--bud-border)",
      }}
    >
      <div
        className="text-[11px] font-medium uppercase tracking-[0.14em]"
        style={{ color: "var(--bud-text-3)" }}
      >
        Upcoming Njangi
      </div>
      {items.slice(0, 3).map((s) => (
        <div key={s.group_id} className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--bud-text)" }}>{s.group_name}</span>
          <span style={{ color: "#D97706" }} className="tabular-nums font-medium">
            {formatXAF(s.next_contribution_amount, true)} · {s.days_until_due}d
          </span>
        </div>
      ))}
    </div>
  );
}
