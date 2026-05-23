import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

const fieldStyle: React.CSSProperties = {
  background: "var(--bud-input-bg)",
  border: "1px solid var(--bud-border)",
  color: "var(--bud-text)",
};

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
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[92vh] overflow-y-auto border-0 p-6"
        style={{
          background: "var(--bud-bg)",
          color: "var(--bud-text)",
          borderTop: "1px solid var(--bud-border)",
        }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: "var(--bud-text)" }}>
            {step === 0 ? "Step 1 · Monthly income" : "Step 2 · Category limits"}
          </SheetTitle>
        </SheetHeader>

        {step === 0 ? (
          <div className="mt-6 space-y-5">
            <p className="text-sm" style={{ color: "var(--bud-text-2)" }}>
              Tell us your typical monthly income in XAF. We&apos;ll suggest sensible category limits you can edit.
            </p>
            <input
              inputMode="numeric"
              value={income}
              onChange={(e) => setIncome(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 250000"
              className="h-14 w-full rounded-2xl px-4 text-lg outline-none transition-colors focus:ring-2 focus:ring-sky-500/40"
              style={fieldStyle}
            />
            {incomeNum > 0 && (
              <div className="text-xs" style={{ color: "var(--bud-text-3)" }}>
                {formatXAF(incomeNum)}
              </div>
            )}
            <button
              className="h-12 w-full rounded-2xl text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
              style={{ background: "var(--bud-cta-bg)", color: "var(--bud-cta-fg)" }}
              disabled={incomeNum <= 0}
              onClick={() => {
                autoAllocate();
                setStep(1);
              }}
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-xs" style={{ color: "var(--bud-text-2)" }}>
              <span>Total allocated</span>
              <span style={{ color: "var(--bud-text)" }}>{formatXAF(total)}</span>
            </div>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {DEFAULT_CATEGORIES.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl p-3"
                  style={{ background: "var(--bud-surface)", border: "1px solid var(--bud-border)" }}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: `${c.colour}26`, color: c.colour }}
                  >
                    {c.icon.slice(0, 1)}
                  </span>
                  <div className="flex-1 text-sm" style={{ color: "var(--bud-text)" }}>
                    {c.name[lang]}
                  </div>
                  <input
                    inputMode="numeric"
                    value={limits[c.id] || ""}
                    onChange={(e) =>
                      setLimits({ ...limits, [c.id]: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })
                    }
                    className="w-28 h-9 rounded-lg px-2 text-right text-sm outline-none"
                    style={fieldStyle}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-3">
              <button
                className="flex-1 h-12 rounded-2xl text-sm font-medium transition-colors"
                style={{
                  border: "1px solid var(--bud-border)",
                  background: "transparent",
                  color: "var(--bud-text)",
                }}
                onClick={() => setStep(0)}
              >
                Back
              </button>
              <button
                className="flex-1 h-12 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-transform active:scale-[0.98]"
                style={{ background: "var(--bud-cta-bg)", color: "var(--bud-cta-fg)" }}
                disabled={total <= 0 || create.isPending}
                onClick={submit}
              >
                {create.isPending ? "Saving…" : "Create budget"}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
