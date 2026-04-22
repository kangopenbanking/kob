import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeSlaStatus, type SlaState } from '@/utils/supportSla';

interface SlaBadgeProps {
  createdAt?: string | null;
  slaTargetMinutes?: number | null;
  slaBreachAt?: string | null;
  firstResponseAt?: string | null;
  status?: string;
  compact?: boolean;
  /** When true, refresh every second and render a mm:ss countdown to breach. */
  liveCountdown?: boolean;
  className?: string;
}

const STYLES: Record<SlaState, { wrap: string; icon: React.ElementType }> = {
  on_track: { wrap: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300', icon: Clock },
  at_risk: { wrap: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300', icon: Clock },
  breached: { wrap: 'border-destructive/40 bg-destructive/5 text-destructive', icon: AlertTriangle },
  met: { wrap: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
};

/** Format the countdown as `+mm:ss` (over) or `mm:ss` (remaining). */
function formatCountdown(breachAt: number, now: number, met: boolean): string {
  if (met) return '00:00';
  const diff = Math.round((breachAt - now) / 1000);
  const sign = diff < 0 ? '+' : '';
  const abs = Math.abs(diff);
  const mm = String(Math.floor(abs / 60)).padStart(2, '0');
  const ss = String(abs % 60).padStart(2, '0');
  return `${sign}${mm}:${ss}`;
}

export const SlaBadge: React.FC<SlaBadgeProps> = (props) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!props.liveCountdown) return;
    if (props.firstResponseAt) return; // Already met — no need to tick
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [props.liveCountdown, props.firstResponseAt]);

  const sla = computeSlaStatus(props);
  const style = STYLES[sla.state];
  const Icon = style.icon;

  const breachAtMs = props.slaBreachAt
    ? new Date(props.slaBreachAt).getTime()
    : props.createdAt
      ? new Date(props.createdAt).getTime() + (props.slaTargetMinutes ?? 15) * 60_000
      : Date.now();
  const countdown = props.liveCountdown
    ? formatCountdown(breachAtMs, Date.now(), sla.state === 'met')
    : null;

  if (props.compact) {
    return (
      <span
        className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums', style.wrap, props.className)}
        title={sla.detail}
      >
        <Icon className="h-3 w-3" strokeWidth={1.5} />
        {countdown ? `${sla.label} · ${countdown}` : sla.label}
      </span>
    );
  }
  return (
    <div className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px]', style.wrap, props.className)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{sla.label}</p>
          {countdown && (
            <span className="font-mono text-[11px] tabular-nums" aria-label="Time remaining to SLA breach">
              {countdown}
            </span>
          )}
        </div>
        <p className="opacity-80">{sla.detail}</p>
      </div>
    </div>
  );
};
