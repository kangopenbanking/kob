import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2, Circle, ShieldCheck, HeartHandshake, Banknote, PencilLine, Flag, History,
} from 'lucide-react';
import { giveting, formatMoney } from '@/lib/giveting';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_role: string | null;
  reason: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface Props {
  campaignId: string;
  currency: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Circle,
  status_changed: CheckCircle2,
  auto_published_kyc: ShieldCheck,
  donation: HeartHandshake,
  withdrawal: Banknote,
  edited: PencilLine,
  moderated: Flag,
};

const LABELS: Record<string, (e: Event, currency: string) => string> = {
  created: (e) => `Fundraiser created (${e.to_status ?? 'draft'})`,
  status_changed: (e) => `Status changed: ${e.from_status ?? '—'} → ${e.to_status ?? '—'}`,
  auto_published_kyc: () => 'Auto-published after identity verification',
  donation: (e, c) =>
    `Donation received — ${formatMoney(e.metadata?.amount_minor ?? 0, e.metadata?.currency ?? c)}`,
  withdrawal: (e, c) =>
    `Withdrawal ${e.metadata?.status ?? 'requested'} — ${formatMoney(e.metadata?.amount_minor ?? 0, e.metadata?.currency ?? c)}`,
  edited: () => 'Fundraiser details edited',
  moderated: (e) => `Moderated${e.reason ? ` — ${e.reason}` : ''}`,
};

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = Math.floor(diff / 86400);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export const CampaignAuditTrail: React.FC<Props> = ({ campaignId, currency }) => {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await giveting('list-events', { campaign_id: campaignId, limit: 100 });
        if (!cancelled) setEvents(res.events ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load activity');
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  if (error) {
    return (
      <Card className="rounded-2xl border-dashed p-4 text-sm text-muted-foreground">
        Activity is temporarily unavailable ({error}).
      </Card>
    );
  }

  if (!events) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  if (events.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed p-4 text-sm text-muted-foreground">
        No activity yet.
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-muted-foreground" />
        Activity & audit trail
      </div>
      <ol className="relative space-y-4 border-l border-border pl-5">
        {events.map((e) => {
          const Icon = ICONS[e.event_type] ?? Circle;
          const label = (LABELS[e.event_type] ?? (() => e.event_type))(e, currency);
          const isKyc = e.event_type === 'auto_published_kyc';
          return (
            <li key={e.id} className="relative">
              <span
                className={cn(
                  'absolute -left-[26px] flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-background',
                  isKyc ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="h-2.5 w-2.5" />
              </span>
              <p className={cn('text-sm', isKyc ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>
                {label}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {new Date(e.created_at).toLocaleString()} · {relTime(e.created_at)}
                {e.actor_role ? ` · ${e.actor_role}` : ''}
              </p>
            </li>
          );
        })}
      </ol>
    </Card>
  );
};

export default CampaignAuditTrail;
