// Helpers for displaying SLA status in the support chat UI.
export type SlaState = 'on_track' | 'at_risk' | 'breached' | 'met';

export interface SlaStatus {
  state: SlaState;
  label: string;
  detail: string;
  minutesRemaining: number;
}

export function computeSlaStatus(opts: {
  createdAt?: string | null;
  slaTargetMinutes?: number | null;
  slaBreachAt?: string | null;
  firstResponseAt?: string | null;
  status?: string;
}): SlaStatus {
  const target = opts.slaTargetMinutes ?? 15;
  const now = Date.now();
  const breachAt = opts.slaBreachAt ? new Date(opts.slaBreachAt).getTime() : (opts.createdAt ? new Date(opts.createdAt).getTime() + target * 60_000 : now);
  const minutesRemaining = Math.round((breachAt - now) / 60_000);

  if (opts.firstResponseAt) {
    return {
      state: 'met',
      label: 'SLA met',
      detail: `First response received within ${target}-minute target.`,
      minutesRemaining,
    };
  }
  if (now >= breachAt) {
    const minutesOver = Math.abs(minutesRemaining);
    return {
      state: 'breached',
      label: 'SLA breached',
      detail: `${minutesOver} min over the ${target}-minute target — escalating.`,
      minutesRemaining,
    };
  }
  if (minutesRemaining <= Math.max(2, Math.round(target * 0.25))) {
    return {
      state: 'at_risk',
      label: 'SLA at risk',
      detail: `Agent response expected in under ${minutesRemaining} min.`,
      minutesRemaining,
    };
  }
  return {
    state: 'on_track',
    label: 'On track',
    detail: `Agent will respond within ${minutesRemaining} min (target ${target} min).`,
    minutesRemaining,
  };
}
