import { Minus, Plus } from "lucide-react";

interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  ariaLabel?: string;
}

export function QuantityStepper({ value, onChange, min = 0, max = 99, size = "md", ariaLabel = "Quantity" }: Props) {
  const sz = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const txt = size === "sm" ? "text-sm w-6" : "text-base w-8";
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-0.5" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={`${sz} rounded-full inline-flex items-center justify-center hover:bg-muted disabled:opacity-40`}
        aria-label="Decrease"
      >
        <Minus className="size-3.5" />
      </button>
      <span className={`${txt} text-center font-semibold tabular-nums`} aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={`${sz} rounded-full inline-flex items-center justify-center hover:bg-muted disabled:opacity-40`}
        aria-label="Increase"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
