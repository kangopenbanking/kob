import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  currency?: string;
  /** Static fee percent (legacy). If feeData is provided, this is ignored. */
  feePercent?: number;
  /** Dynamic fee data from useFeeEstimate */
  feeData?: {
    feePercent: number;
    fixedFee: number;
    totalFee: number;
    netAmount: number;
    source: "db" | "fallback";
  };
  feeLoading?: boolean;
  fmt: (n: number) => string;
  presets?: number[];
}

export const AmountInput = ({
  value,
  onChange,
  currency = "XAF",
  feePercent,
  feeData,
  feeLoading,
  fmt,
  presets = [10000, 25000, 50000, 100000],
}: AmountInputProps) => {
  const numAmount = Number(value);

  // Use dynamic feeData if available, otherwise fall back to static feePercent
  const effectivePercent = feeData?.feePercent ?? feePercent ?? 0;
  const fixedFee = feeData?.fixedFee ?? 0;
  const fee = feeData
    ? feeData.totalFee
    : numAmount > 0
      ? Math.round(numAmount * effectivePercent)
      : 0;
  const net = feeData ? feeData.netAmount : numAmount - fee;

  const feeLabel = fixedFee > 0
    ? `${(effectivePercent * 100).toFixed(1)}% + ${fmt(fixedFee)}`
    : `${(effectivePercent * 100).toFixed(1)}%`;

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">Amount ({currency})</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">
          {currency}
        </span>
        <Input
          type="number"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={1}
          className="pl-14 text-lg font-semibold h-12"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(String(p))}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              numAmount === p
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {fmt(p)}
          </button>
        ))}
      </div>
      {numAmount > 0 && (
        <div className="flex items-center gap-4 rounded-lg bg-muted/50 px-4 py-2.5 text-xs">
          {feeLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Calculating fee…</span>
            </div>
          ) : (
            <>
              <div>
                <span className="text-muted-foreground">Fee ({feeLabel})</span>
                <p className="font-semibold text-foreground">{fmt(fee)}</p>
              </div>
              <div className="h-6 w-px bg-border" />
              <div>
                <span className="text-muted-foreground">You receive</span>
                <p className="font-semibold text-green-600">{fmt(net)}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
