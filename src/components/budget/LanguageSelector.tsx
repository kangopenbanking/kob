import { cn } from "@/lib/utils";
import type { BudgetLang } from "@/types/budget";

const LABELS: Record<BudgetLang, string> = { en: "EN", fr: "FR", pid: "Pidgin" };

interface Props {
  value: BudgetLang;
  onChange: (lang: BudgetLang) => void;
  className?: string;
}

export const LanguageSelector: React.FC<Props> = ({ value, onChange, className }) => (
  <div
    className={cn("inline-flex rounded-full p-0.5", className)}
    style={{ background: "var(--bud-surface-2)", border: "1px solid var(--bud-border)" }}
  >
    {(Object.keys(LABELS) as BudgetLang[]).map((l) => {
      const active = value === l;
      return (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
          )}
          style={{
            background: active ? "var(--bud-cta-bg)" : "transparent",
            color: active ? "var(--bud-cta-fg)" : "var(--bud-text-2)",
          }}
        >
          {LABELS[l]}
        </button>
      );
    })}
  </div>
);
