import React from 'react';
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
  className?: string;
}

const STYLES: Record<SlaState, { wrap: string; icon: React.ElementType }> = {
  on_track: { wrap: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300', icon: Clock },
  at_risk: { wrap: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300', icon: Clock },
  breached: { wrap: 'border-destructive/40 bg-destructive/5 text-destructive', icon: AlertTriangle },
  met: { wrap: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
};

export const SlaBadge: React.FC<SlaBadgeProps> = (props) => {
  const sla = computeSlaStatus(props);
  const style = STYLES[sla.state];
  const Icon = style.icon;
  if (props.compact) {
    return (
      <span
        className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', style.wrap, props.className)}
        title={sla.detail}
      >
        <Icon className="h-3 w-3" strokeWidth={1.5} />
        {sla.label}
      </span>
    );
  }
  return (
    <div className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px]', style.wrap, props.className)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      <div className="min-w-0">
        <p className="font-semibold">{sla.label}</p>
        <p className="opacity-80">{sla.detail}</p>
      </div>
    </div>
  );
};
