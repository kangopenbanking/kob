import { useEffect, useRef, useState } from "react";
import { formatXAF } from "@/lib/budget/formatXAF";

interface Props {
  value: number;
  duration?: number;
  className?: string;
  compact?: boolean;
  suffix?: string;
}

/** AnimatedAmount — counts from previous value to target. Uses easeOutExpo. */
export const AnimatedAmount: React.FC<Props> = ({ value, duration = 800, className, compact, suffix }) => {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(2, -10 * t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatXAF(display, compact)}{suffix}
    </span>
  );
};
