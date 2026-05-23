import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useRoundupSettings,
  useUpdateRoundupSettings,
  usePauseRoundup,
  useRoundupTransactions,
} from "@/hooks/budget/useRoundup";
import { useGoals } from "@/hooks/budget/useBudgetApi";
import { formatXAF } from "@/lib/budget/formatXAF";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const THRESHOLDS = [10, 50, 100, 500, 1000] as const;

export function RoundupSettingsSheet({ open, onOpenChange }: Props) {
  const { data } = useRoundupSettings();
  const { data: goalsData } = useGoals();
  const { data: txData } = useRoundupTransactions(10);
  const update = useUpdateRoundupSettings();
  const pause = usePauseRoundup();

  const s = data?.settings;
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState<number>(100);
  const [minSave, setMinSave] = useState("10");
  const [maxSave, setMaxSave] = useState("2000");
  const [dailyCap, setDailyCap] = useState("5000");
  const [minFloor, setMinFloor] = useState("0");
  const [goalId, setGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (!s) return;
    setEnabled(s.enabled);
    setThreshold(s.threshold);
    setMinSave(String(s.min_save));
    setMaxSave(String(s.max_save));
    setDailyCap(String(s.daily_cap));
    setMinFloor(String(s.min_balance_floor));
    setGoalId(s.default_goal_id);
  }, [s, open]);

  async function save() {
    await update.mutateAsync({
      enabled,
      threshold: threshold as 10 | 50 | 100 | 500 | 1000,
      min_save: Number(minSave) || 0,
      max_save: Number(maxSave) || 0,
      daily_cap: Number(dailyCap) || 0,
      min_balance_floor: Number(minFloor) || 0,
      default_goal_id: goalId,
    });
    onOpenChange(false);
  }

  const recentTx = txData?.transactions ?? [];
  const isPaused = !!s?.paused_until && new Date(s.paused_until).getTime() > Date.now();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-3xl border-0 p-6"
        style={{
          background: "var(--bud-bg)",
          color: "var(--bud-text)",
          borderTop: "1px solid var(--bud-border)",
        }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: "var(--bud-text)" }}>Round-up savings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Master toggle */}
          <div
            className="flex items-center justify-between rounded-2xl border p-4"
            style={{ borderColor: "var(--bud-border)", background: "var(--bud-surface)" }}
          >
            <div>
              <div className="text-[14px] font-medium" style={{ color: "var(--bud-text)" }}>
                Automatic round-ups
              </div>
              <div className="mt-0.5 text-[12px]" style={{ color: "var(--bud-text-2)" }}>
                Spare change from every transaction is set aside.
              </div>
            </div>
            <button
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className="relative h-7 w-12 rounded-full transition-colors"
              style={{
                background: enabled ? "var(--bud-cta-bg)" : "var(--bud-track)",
              }}
            >
              <span
                className="absolute top-1 h-5 w-5 rounded-full bg-white transition-transform"
                style={{ left: enabled ? "26px" : "4px" }}
              />
            </button>
          </div>

          {/* Threshold */}
          <div>
            <Label>Round-up to nearest (XAF)</Label>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {THRESHOLDS.map((t) => (
                <button
                  key={t}
                  onClick={() => setThreshold(t)}
                  className="h-11 rounded-xl text-[13px] font-medium transition-colors"
                  style={{
                    background: threshold === t ? "var(--bud-cta-bg)" : "var(--bud-surface)",
                    color: threshold === t ? "var(--bud-cta-fg)" : "var(--bud-text)",
                    border: "1px solid var(--bud-border)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric grid */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Min per save" value={minSave} onChange={setMinSave} />
            <Field label="Max per save" value={maxSave} onChange={setMaxSave} />
            <Field label="Daily cap" value={dailyCap} onChange={setDailyCap} />
            <Field label="Min wallet balance" value={minFloor} onChange={setMinFloor} />
          </div>

          {/* Goal picker */}
          <div>
            <Label>Send round-ups to</Label>
            <select
              value={goalId ?? ""}
              onChange={(e) => setGoalId(e.target.value || null)}
              className="mt-2 h-12 w-full rounded-xl px-3 text-[14px] outline-none"
              style={{
                background: "var(--bud-input-bg)",
                border: "1px solid var(--bud-border)",
                color: "var(--bud-text)",
              }}
            >
              <option value="">Savings wallet (default)</option>
              {(goalsData?.goals ?? []).map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pause */}
          {enabled && (
            <button
              onClick={() => pause.mutate(!isPaused)}
              className="w-full rounded-xl px-4 py-3 text-[13px] font-medium transition-colors"
              style={{
                background: "var(--bud-surface)",
                border: "1px solid var(--bud-border)",
                color: "var(--bud-text-2)",
              }}
            >
              {isPaused ? "Resume now" : "Pause for 24 hours"}
            </button>
          )}

          {/* Recent activity */}
          {recentTx.length > 0 && (
            <div>
              <Label>Recent round-ups</Label>
              <div
                className="mt-2 overflow-hidden rounded-2xl border"
                style={{ borderColor: "var(--bud-border)", background: "var(--bud-surface)" }}
              >
                {recentTx.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-4 py-3 text-[12px]"
                    style={{
                      borderBottom:
                        idx !== recentTx.length - 1 ? "1px solid var(--bud-border-soft)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ color: "var(--bud-text)" }}>
                        {formatXAF(Number(t.roundup_amount), true)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--bud-text-3)" }}>
                        {t.state}{t.skip_reason ? ` · ${t.skip_reason}` : ""}
                      </div>
                    </div>
                    <div className="tabular-nums" style={{ color: "var(--bud-text-3)" }}>
                      from {formatXAF(Number(t.original_amount), true)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              className="flex-1 h-12 rounded-2xl text-sm font-medium"
              style={{
                border: "1px solid var(--bud-border)",
                background: "transparent",
                color: "var(--bud-text)",
              }}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              disabled={update.isPending}
              onClick={save}
              className="flex-1 h-12 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-transform active:scale-[0.98]"
              style={{ background: "var(--bud-cta-bg)", color: "var(--bud-cta-fg)" }}
            >
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[11px] uppercase tracking-[0.14em]"
      style={{ color: "var(--bud-text-3)" }}
    >
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className="mt-2 h-12 w-full rounded-xl px-3 text-[14px] outline-none"
        style={{
          background: "var(--bud-input-bg)",
          border: "1px solid var(--bud-border)",
          color: "var(--bud-text)",
        }}
      />
    </div>
  );
}
