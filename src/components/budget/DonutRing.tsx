import { useEffect, useState } from "react";

interface Segment {
  value: number;
  colour: string;
  label?: string;
}

interface Props {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: React.ReactNode;
  centerSub?: React.ReactNode;
}

/**
 * DonutRing — animated SVG donut ring.
 * Segments draw in sequentially with spring easing. Track ring sits behind.
 */
export const DonutRing: React.FC<Props> = ({
  segments,
  size = 200,
  strokeWidth = 18,
  centerLabel,
  centerSub,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));

  let offset = 0;
  const arcs = segments.map((seg, i) => {
    const fraction = seg.value / total;
    const length = circumference * fraction * progress;
    const dash = `${length} ${circumference}`;
    const arc = (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={seg.colour}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={-offset}
        style={{
          transform: `rotate(-90deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          filter: `drop-shadow(0 0 8px ${seg.colour}66)`,
          transition: "stroke-width 200ms ease",
        }}
      />
    );
    offset += circumference * fraction;
    return arc;
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        {arcs}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && (
            <div className="font-[Sora,sans-serif] text-3xl font-semibold tracking-tight text-[var(--bud-text,#E2EAF4)]">
              {centerLabel}
            </div>
          )}
          {centerSub && (
            <div className="mt-1 font-[DM_Sans,sans-serif] text-xs uppercase tracking-wider text-[var(--bud-text2,#94A3B8)]">
              {centerSub}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
