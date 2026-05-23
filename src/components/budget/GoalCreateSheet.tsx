import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateGoal } from "@/hooks/budget/useBudgetApi";
import { formatXAF } from "@/lib/budget/formatXAF";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#0F172A] border-t border-white/10 text-[#E2EAF4] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="text-[#E2EAF4]">New savings goal</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-400">Goal name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. School fees"
              className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-400">Target amount (XAF)</label>
            <Input
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 500000"
              className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
            {Number(target) > 0 && <div className="text-xs text-slate-500">{formatXAF(Number(target))}</div>}
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-400">Deadline (optional)</label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-12 bg-white/5 border-white/10 text-white"
            />
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
            <input
              type="checkbox"
              checked={roundUp}
              onChange={(e) => setRoundUp(e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            <span>Enable round-up savings (nearest 500 XAF)</span>
          </label>
          <div className="flex gap-2 pt-3">
            <Button variant="outline" className="flex-1 h-12 rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/5" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white"
              disabled={create.isPending || Number(target) <= 0}
              onClick={submit}
            >
              {create.isPending ? "Saving…" : "Create goal"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
