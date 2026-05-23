import { Coins, ChevronRight } from "lucide-react";
import { useRoundupSettings, useRoundupTransactions } from "@/hooks/budget/useRoundup";
import { formatXAF } from "@/lib/budget/formatXAF";

interface Props {
  onOpenSettings: () => void;
  theme: "light" | "dark";
}

export function RoundupCard({ onOpenSettings, theme }: Props) {
  const { data: settingsData } = useRoundupSettings();
  const { data: txData } = useRoundupTransactions(5);
  const settings = settingsData?.settings;
  const enabled = !!settings?.enabled;
  const savedThisMonth = txData?.saved_this_month ?? 0;
  const last = (txData?.transactions ?? []).find(
    (t) => t.state === "successful" || t.state === "pending",
  );
  const pendingCount = (txData?.transactions ?? []).filter((t) => t.state === "pending").length;

  return (
    <button
      onClick={onOpenSettings}
      className="group flex w-full items-center gap-4 rounded-3xl border p-5 text-left transition-colors"
      style={{
        background: "var(--bud-surface)",
        borderColor: "var(--bud-border)",
        boxShadow:
          theme === "light"
            ? "0 1px 2px rgba(15,23,42,0.04)"
            : "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
      aria-label="Round-up savings settings"
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
        style={{
          background: theme === "light" ? "rgba(14,165,233,0.12)" : "rgba(56,189,248,0.14)",
          color: theme === "light" ? "#0284C7" : "#7DD3FC",
        }}
      >
        <Coins className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div
            className="text-[14px] font-medium"
            style={{ fontFamily: "Sora, Inter, sans-serif", color: "var(--bud-text)" }}
          >
            Round-up savings
          </div>
          <div
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ color: enabled ? (theme === "light" ? "#059669" : "#34D399") : "var(--bud-text-3)" }}
          >
            {enabled ? "Active" : "Off"}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[12px]" style={{ color: "var(--bud-text-2)" }}>
          <span>Saved this month </span>
          <span className="font-medium tabular-nums" style={{ color: "var(--bud-text)" }}>
            {formatXAF(savedThisMonth, true)}
          </span>
          {pendingCount > 0 && (
            <span
              className="ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px]"
              style={{
                background: "var(--bud-accent-soft)",
                color: "var(--bud-accent)",
              }}
            >
              {pendingCount} saving…
            </span>
          )}
        </div>
        {last && (
          <div className="mt-1 text-[11px]" style={{ color: "var(--bud-text-3)" }}>
            Last: {formatXAF(Number(last.roundup_amount), true)} from {formatXAF(Number(last.original_amount), true)}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--bud-text-3)" }} strokeWidth={1.75} />
    </button>
  );
}
