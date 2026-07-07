import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Plus, ArrowRight, ShieldAlert } from 'lucide-react';
import { giveting, formatMoney, progressPct } from '@/lib/giveting';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressRing } from '@/components/customer-app/giveting/ProgressRing';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-900',
  draft: 'bg-muted text-muted-foreground',
  paused: 'bg-slate-200 text-slate-700',
  blocked: 'bg-rose-100 text-rose-800',
  completed: 'bg-primary/15 text-primary',
  archived: 'bg-muted text-muted-foreground',
};

export const GivetingHome: React.FC = () => {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await giveting('list-mine');
        setCampaigns(res.campaigns ?? []);
      } catch (e: any) {
        toast.error(e.message ?? 'Failed to load fundraisers');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="px-5 pt-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Fundraise</h1>
        <p className="mt-1 text-sm text-muted-foreground">Rally support for the causes you care about.</p>
      </header>

      <Button
        onClick={() => nav('/app/giveting/new')}
        className="mb-6 h-14 w-full rounded-full text-base font-semibold shadow-sm"
      >
        <Plus className="mr-2 h-5 w-5" /> Start a fundraiser
      </Button>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="rounded-3xl border-dashed p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-6 w-6 text-primary" strokeWidth={1.8} />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No fundraisers yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first campaign in a couple of minutes.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const pct = progressPct(c.total_raised_minor, c.goal_amount_minor);
            return (
              <Card
                key={c.id}
                onClick={() => nav(`/app/giveting/c/${c.slug}/manage`)}
                className="cursor-pointer overflow-hidden rounded-3xl border-border/70 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-4 p-4">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-muted">
                    {c.cover_media_url ? (
                      <img src={c.cover_media_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/10 text-xs text-primary">
                        <Heart className="h-6 w-6" strokeWidth={1.6} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="line-clamp-1 text-base font-semibold">{c.title}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.status}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatMoney(c.total_raised_minor, c.currency)}
                      <span className="text-xs font-normal text-muted-foreground"> of {formatMoney(c.goal_amount_minor, c.currency)}</span>
                    </p>
                  </div>
                  <ProgressRing pct={pct} size={44} stroke={4} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GivetingHome;
