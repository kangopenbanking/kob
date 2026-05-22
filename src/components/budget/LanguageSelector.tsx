import { cn } from "@/lib/utils";
import type { BudgetLang } from "@/types/budget";

const LABELS: Record<BudgetLang, string> = { en: "EN", fr: "FR", pid: "Pidgin" };

interface Props {
  value: BudgetLang;
  onChange: (lang: BudgetLang) => void;
  className?: string;
}

export const LanguageSelector: React.FC<Props> = ({ value, onChange, className }) => (
  <div className={cn("inline-flex rounded-full border border-white/10 bg-white/5 p-0.5", className)}>
    {(Object.keys(LABELS) as BudgetLang[]).map((l) => (
      <button
        key={l}
        type="button"
        onClick={() => onChange(l)}
        className={cn(
          "rounded-full px-3 py-1 text-[11px] font-medium font-[DM_Sans,sans-serif] transition-colors",
          value === l
            ? "bg-sky-500 text-white"
            : "text-slate-400 hover:text-slate-200"
        )}
      >
        {LABELS[l]}
      </button>
    ))}
  </div>
);
