import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Plus, ArrowRight, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { giveting, formatMoney, progressPct } from '@/lib/giveting';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressRing } from '@/components/customer-app/giveting/ProgressRing';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  const [kycApproved, setKycApproved] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res: any = await giveting('list-mine');
      setCampaigns(res.campaigns ?? []);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to load fundraisers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Track live KYC status + auto-refresh campaigns when it flips to approved.
  useEffect(() => {
    let channel: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('kyc_verifications')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .limit(1);
      setKycApproved((data?.length ?? 0) > 0);

      channel = supabase
        .channel(`kyc-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'kyc_verifications', filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            if (payload.new?.status === 'approved') {
              setKycApproved(true);
              load();
            }
          },
        )
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [load]);

  const publishNow = async (id: string) => {
    setPublishingId(id);
    try {
      const res: any = await giveting('publish', { id, idempotency_key: crypto.randomUUID() });
      if (res.kyc_required) {
        toast.info(res.message ?? 'Verify your identity first to make this fundraiser live.');
      } else if (res.replayed) {
        toast.success(res.message ?? 'Fundraiser is already live.');
        await load();
      } else {
        toast.success(res.message ?? 'Fundraiser is now live.');
        await load();
      }
    } catch (e: any) {
      const msg = (e as any)?.details?.message ?? e?.message;
      toast.error(msg ?? 'Could not publish this fundraiser. Please try again.');
    } finally {
      setPublishingId(null);
    }
  };

  const hasPending = campaigns.some((c) => c.status === 'pending');

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

      {!loading && hasPending && !kycApproved && (
        <Card
          onClick={() => nav('/app/kyc')}
          className="mb-5 cursor-pointer rounded-3xl border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              <ShieldAlert className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Verify your identity to go live</p>
              <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/80">
                One or more of your fundraisers is pending. Complete KYC to publish it and start receiving donations.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-amber-800 dark:text-amber-300" />
          </div>
        </Card>
      )}

      {!loading && hasPending && kycApproved && (
        <Card className="mb-5 rounded-3xl border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Identity verified</p>
              <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-200/80">
                Tap "Go live" on any pending fundraiser to publish it now.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={load}
              className="h-8 rounded-full border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </Card>
      )}

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
            const isPending = c.status === 'pending';
            return (
              <Card
                key={c.id}
                className="overflow-hidden rounded-3xl border-border/70 transition-shadow hover:shadow-md"
              >
                <div
                  onClick={() => nav(`/app/giveting/c/${c.slug}/manage`)}
                  className="flex cursor-pointer items-center gap-4 p-4"
                >
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
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide', STATUS_STYLES[c.status] ?? 'bg-muted text-muted-foreground')}>
                        {isPending ? (kycApproved ? 'Ready to publish' : 'Pending KYC') : c.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatMoney(c.total_raised_minor, c.currency)}
                      <span className="text-xs font-normal text-muted-foreground"> of {formatMoney(c.goal_amount_minor, c.currency)}</span>
                    </p>
                  </div>
                  <ProgressRing pct={pct} size={44} stroke={4} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                {isPending && kycApproved && (
                  <div className="border-t border-border/70 bg-emerald-50/60 px-4 py-2 dark:bg-emerald-500/5">
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); publishNow(c.id); }}
                      disabled={publishingId === c.id}
                      className="h-8 rounded-full"
                    >
                      {publishingId === c.id ? 'Publishing…' : 'Go live now'}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GivetingHome;
