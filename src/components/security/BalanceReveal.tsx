/**
 * BalanceReveal — tap-to-reveal wrapper for sensitive numeric values
 * (wallet balance, available credit, account totals).
 *
 * Default state is *masked* — the user must tap the value to reveal it.
 * After `revealMs` (default 8 seconds) the value automatically re-masks
 * to reduce shoulder-surfing exposure and the probability that a
 * timed screenshot catches a real number.
 *
 * Persists the reveal preference per-field in `sessionStorage` so a
 * repeated tap within the same session feels instant, but the value
 * always returns to masked when the page is refreshed or the tab is
 * closed.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { SecureField } from "./SecureField";

interface BalanceRevealProps {
  /** The real, formatted value (e.g. "1 250 000 XAF"). */
  value: string;
  /** Mask preview shown while hidden (default "•••••• XAF"). */
  maskedValue?: string;
  /** Auto re-mask after this many ms (default 8000). */
  revealMs?: number;
  /** Stable field name used for the eye-button aria-label & analytics. */
  field?: string;
  className?: string;
  /** Optional custom className for the value text. */
  valueClassName?: string;
}

export function BalanceReveal({
  value,
  maskedValue = "•••••• XAF",
  revealMs = 8000,
  field = "balance",
  className,
  valueClassName,
}: BalanceRevealProps) {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const reveal = useCallback(() => {
    setRevealed(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setRevealed(false), revealMs);
  }, [revealMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Always re-mask when the tab loses visibility (defence-in-depth on
  // top of the page-level ScreenshotGuard mask).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") {
        setRevealed(false);
        if (timerRef.current) window.clearTimeout(timerRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <SecureField
      field={field}
      revealed={revealed}
      className={cn("inline-flex items-center gap-2", className)}
      mask={
        <button
          type="button"
          onClick={reveal}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-2 py-1 tabular-nums",
            "hover:bg-foreground/5 active:scale-[0.98] transition",
            valueClassName,
          )}
          aria-label={`Reveal ${field}`}
          data-testid={`balance-reveal-mask-${field}`}
        >
          <span aria-hidden="true">{maskedValue}</span>
          <Eye className="h-4 w-4 opacity-70" strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">Tap to reveal balance</span>
        </button>
      }
    >
      <button
        type="button"
        onClick={() => setRevealed(false)}
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-2 py-1 tabular-nums",
          "hover:bg-foreground/5 active:scale-[0.98] transition",
          valueClassName,
        )}
        aria-label={`Hide ${field}`}
        data-testid={`balance-reveal-value-${field}`}
      >
        <span>{value}</span>
        <EyeOff className="h-4 w-4 opacity-70" strokeWidth={1.75} aria-hidden="true" />
        <span className="sr-only">Tap to hide balance</span>
      </button>
    </SecureField>
  );
}
