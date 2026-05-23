import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCreateGoal } from "@/hooks/budget/useBudgetApi";
import { formatXAF } from "@/lib/budget/formatXAF";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const fieldStyle: React.CSSProperties = {
  background: "var(--bud-input-bg)",
  border: "1px solid var(--bud-border)",
  color: "var(--bud-text)",
};

export function GoalCreateSheet({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [roundUp, setRoundUp] = useState(false);
  const create = useCreateGoal();

  async function submit() {
    await create.mutateAsync({
      name: name || "Goal",
      target_amount: Number(target) || 0,
      deadline: deadline || undefined,
      round_up_enabled: roundUp,
      round_up_nearest: roundUp ? 500 : null,
    } as any);
    onOpenChange(false);
    setName("");
    setTarget("");
    setDeadline("");
    setRoundUp(false);
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="text-xs uppercase tracking-wider" style={{ color: "var(--bud-text-3)" }}>
      {children}
    </label>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-0 p-6"
        style={{
          background: "var(--bud-bg)",
          color: "var(--bud-text)",
          borderTop: "1px solid var(--bud-border)",
        }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: "var(--bud-text)" }}>New savings goal</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Goal name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. School fees"
              className="h-12 w-full rounded-2xl px-4 outline-none focus:ring-2 focus:ring-sky-500/40"
              style={fieldStyle}
            />
          </div>
          <div className="space-y-2">
            <Label>Target amount (XAF)</Label>
            <input
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 500000"
              className="h-12 w-full rounded-2xl px-4 outline-none focus:ring-2 focus:ring-sky-500/40"
              style={fieldStyle}
            />
            {Number(target) > 0 && (
              <div className="text-xs" style={{ color: "var(--bud-text-3)" }}>
                {formatXAF(Number(target))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Deadline (optional)</Label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-12 w-full rounded-2xl px-4 outline-none focus:ring-2 focus:ring-sky-500/40"
              style={fieldStyle}
            />
          </div>
          <label
            className="flex items-center gap-3 rounded-2xl p-3 text-sm"
            style={{ background: "var(--bud-surface)", border: "1px solid var(--bud-border)", color: "var(--bud-text)" }}
          >
            <input
              type="checkbox"
              checked={roundUp}
              onChange={(e) => setRoundUp(e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            <span>Enable round-up savings (nearest 500 XAF)</span>
          </label>
          <div className="flex gap-2 pt-3">
            <button
              className="flex-1 h-12 rounded-2xl text-sm font-medium"
              style={{ border: "1px solid var(--bud-border)", background: "transparent", color: "var(--bud-text)" }}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              className="flex-1 h-12 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-transform active:scale-[0.98]"
              style={{ background: "var(--bud-cta-bg)", color: "var(--bud-cta-fg)" }}
              disabled={create.isPending || Number(target) <= 0}
              onClick={submit}
            >
              {create.isPending ? "Saving…" : "Create goal"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
