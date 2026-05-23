import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_CATEGORIES } from "@/lib/budget/budgetCategories";
import { useCreateBudget } from "@/hooks/budget/useBudgetApi";
import { formatXAF } from "@/lib/budget/formatXAF";
import type { BudgetLang } from "@/types/budget";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lang: BudgetLang;
  onCreated?: () => void;
}

export function BudgetSetupSheet({ open, onOpenChange, lang, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState<string>("");
  const [limits, setLimits] = useState<Record<string, number>>(() =>
    Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, 0])),
  );
  const create = useCreateBudget();

  const incomeNum = Number(income) || 0;
  const total = useMemo(() => Object.values(limits).reduce((a, b) => a + b, 0), [limits]);

  function autoAllocate() {
    const next: Record<string, number> = {};
    DEFAULT_CATEGORIES.forEach((c) => {
      next[c.id] = Math.round(incomeNum * c.default_share);
    });
    setLimits(next);
  }

  async function submit() {
    const categories = DEFAULT_CATEGORIES.filter((c) => (limits[c.id] || 0) > 0).map((c) => ({
      id: c.id,
      limit: limits[c.id] || 0,
      name: c.name[lang],
      icon: c.icon,
      colour: c.colour,
    }));
    await create.mutateAsync({
      name: "My Budget",
      period: "monthly",
      total_limit: total,
      categories,
    } as any);
    onCreated?.();
    onOpenChange(false);
    setStep(0);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#0F172A] border-t border-white/10 text-[#E2EAF4] rounded-t-3xl max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#E2EAF4]">
            {step === 0 ? "Step 1 · Monthly income" : "Step 2 · Category limits"}
          </SheetTitle>
        </SheetHeader>

        {step === 0 ? (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-slate-400">
              Tell us your typical monthly income in XAF. We&apos;ll suggest sensible category limits you can edit.
            </p>
            <Input
              inputMode="numeric"
              value={income}
              onChange={(e) => setIncome(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 250000"
              className="h-14 text-lg bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
            {incomeNum > 0 && (
              <div className="text-xs text-slate-500">{formatXAF(incomeNum)}</div>
            )}
            <Button
              className="w-full h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white"
              disabled={incomeNum <= 0}
              onClick={() => {
                autoAllocate();
                setStep(1);
              }}
            >
              Continue
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Total allocated</span>
              <span className="text-white">{formatXAF(total)}</span>
            </div>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {DEFAULT_CATEGORIES.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs"
                    style={{ background: `${c.colour}26`, color: c.colour }}
                  >
                    {c.icon.slice(0, 1)}
                  </span>
                  <div className="flex-1 text-sm">{c.name[lang]}</div>
                  <Input
                    inputMode="numeric"
                    value={limits[c.id] || ""}
                    onChange={(e) =>
                      setLimits({ ...limits, [c.id]: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })
                    }
                    className="w-28 h-9 text-right bg-transparent border-white/10 text-white"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-3">
              <Button variant="outline" className="flex-1 h-12 rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/5" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                className="flex-1 h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white"
                disabled={total <= 0 || create.isPending}
                onClick={submit}
              >
                {create.isPending ? "Saving…" : "Create budget"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
