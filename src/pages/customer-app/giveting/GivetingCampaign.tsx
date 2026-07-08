import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, ShieldCheck, Share2, Heart, MessageCircle, Lock, RotateCcw, Loader2, Info } from 'lucide-react';
import { giveting, formatMoney, progressPct } from '@/lib/giveting';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressRing } from '@/components/customer-app/giveting/ProgressRing';
import { CampaignAuditTrail } from '@/components/customer-app/giveting/CampaignAuditTrail';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';


export const GivetingCampaign: React.FC = () => {
  const { slug } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [organiser, setOrganiser] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);


  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res: any = await giveting('get', { slug });
        setCampaign(res.campaign);
        setOrganiser(res.organiser);
        const [d, u, cm]: any[] = await Promise.all([
          giveting('list-donations', { campaign_id: res.campaign.id, limit: 10 }),
          giveting('list-updates', { campaign_id: res.campaign.id }),
          giveting('list-comments', { campaign_id: res.campaign.id }),
        ]);
        setDonations(d.donations ?? []);
        setUpdates(u.updates ?? []);
        setComments(cm.comments ?? []);
      } catch (e: any) {
        toast.error(e.message ?? 'Could not load fundraiser');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }
  if (!campaign) {
    return <p className="p-10 text-center text-sm text-muted-foreground">Fundraiser not found.</p>;
  }

  const pct = progressPct(campaign.total_raised_minor, campaign.goal_amount_minor);
  const isOwner = !!currentUserId && currentUserId === campaign.owner_user_id;
  const isClosed = ['completed', 'archived'].includes(campaign.status);
  const isActive = campaign.status === 'active';

  const share = () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: campaign.title, url }).catch(() => {});
    else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  };

  const reopen = async () => {
    setReopening(true);
    try {
      const res: any = await giveting('set-status', { id: campaign.id, status: 'active' });
      if (res?.error) throw new Error(res.message || res.error);
      setCampaign(res.campaign ?? { ...campaign, status: 'active' });
      toast.success('Fundraiser reopened. It is active again.');
      setReopenOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not reopen fundraiser');
    } finally {
      setReopening(false);
    }
  };


  return (
    <div className="pb-32">
      <div className="flex items-center px-5 pt-6">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="h-9 w-9 rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative mt-4">
        <div className="h-72 w-full overflow-hidden">
          {campaign.cover_media_url ? (
            <img src={campaign.cover_media_url} alt={campaign.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10">
              <Heart className="h-14 w-14 text-primary" strokeWidth={1.4} />
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5 pb-8">
          {organiser?.full_name && (
            <p className="mb-1 text-sm font-medium text-white/90">
              {organiser.full_name}
              {campaign.beneficiary_name && ` for ${campaign.beneficiary_name}`}
              {campaign.verified_badge && <ShieldCheck className="ml-1 inline h-3.5 w-3.5" />}
            </p>
          )}
          <h1 className="text-2xl font-bold leading-tight text-white">{campaign.title}</h1>
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="flex items-center gap-4">
          <ProgressRing pct={pct} size={70} stroke={7} label={`${pct}%`} />
          <div className="flex-1">
            <p className="text-xl font-bold text-foreground">{formatMoney(campaign.total_raised_minor, campaign.currency)} <span className="text-xs font-normal text-muted-foreground">raised</span></p>
            <p className="text-sm text-muted-foreground">of {formatMoney(campaign.goal_amount_minor, campaign.currency)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{campaign.donor_count} {campaign.donor_count === 1 ? 'donor' : 'donors'}</p>
          </div>
        </div>

        <section className="mt-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{campaign.story}</p>
        </section>

        {updates.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold">Updates</h2>
            <div className="space-y-3">
              {updates.slice(0, 3).map((u) => (
                <Card key={u.id} className="rounded-2xl p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">{new Date(u.created_at).toLocaleDateString()}</p>
                  <h3 className="mt-1 font-semibold">{u.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">{u.body}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Donations <span className="ml-1 text-xs font-medium text-muted-foreground">({campaign.donor_count})</span></h2>
            <button onClick={() => nav(`/app/giveting/c/${slug}/donations`)} className="text-xs font-medium text-primary">See all</button>
          </div>
          {donations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Be the first to donate.</p>
          ) : (
            <div className="space-y-3">
              {donations.slice(0, 5).map((d) => (
                <div key={d.id} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase text-muted-foreground">
                    {(d.donor_display_name ?? '?').charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{d.donor_display_name ?? 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground">{formatMoney(d.amount_minor, d.currency)} · {new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-bold">Comments <span className="ml-1 text-xs font-medium text-muted-foreground">({comments.length})</span></h2>
          </div>
          <div className="mb-4 flex gap-2">
            <input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Leave a message of support…"
              className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
              maxLength={500}
            />
            <Button
              size="sm"
              disabled={postingComment || !commentBody.trim()}
              onClick={async () => {
                setPostingComment(true);
                try {
                  const res: any = await giveting('post-comment', { campaign_id: campaign.id, body: commentBody.trim() });
                  setComments((prev) => [res.comment, ...prev]);
                  setCommentBody('');
                } catch (e: any) {
                  toast.error(e?.message === 'Unauthorized' ? 'Sign in to comment' : (e?.message ?? 'Could not post'));
                } finally {
                  setPostingComment(false);
                }
              }}
              className="h-11 rounded-full px-5 text-xs font-semibold"
            >
              Post
            </Button>
          </div>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet. Be the first to share encouragement.</p>
          ) : (
            <div className="space-y-3">
              {comments.slice(0, 20).map((cm) => (
                <Card key={cm.id} className="rounded-2xl p-3">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{cm.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{new Date(cm.created_at).toLocaleString()}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        {organiser && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold">Organiser</h2>
            <Card className="flex items-center gap-3 rounded-2xl p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                {(organiser.full_name ?? 'O').charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{organiser.full_name ?? 'Organiser'}</p>
                {campaign.location_city && <p className="text-xs text-muted-foreground">{campaign.location_city}{campaign.location_country ? `, ${campaign.location_country}` : ''}</p>}
              </div>
            </Card>
          </section>
        )}

        {isOwner && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold">Activity</h2>
            <CampaignAuditTrail campaignId={campaign.id} currency={campaign.currency} />
          </section>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-16 z-40 mx-auto flex max-w-lg gap-3 border-t bg-background px-5 py-3">
        {isClosed ? (
          <>
            <Button
              disabled
              className="h-12 flex-[2] rounded-full bg-muted font-semibold text-muted-foreground"
              aria-disabled
            >
              <Lock className="mr-2 h-4 w-4" strokeWidth={2} />
              Fundraiser closed
            </Button>
            {isOwner && (
              <Button
                onClick={() => setReopenOpen(true)}
                variant="outline"
                className="h-12 flex-1 rounded-full border-primary font-semibold text-primary hover:bg-primary/5"
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Reopen
              </Button>
            )}
            {!isOwner && (
              <Button onClick={share} variant="outline" className="h-12 flex-1 rounded-full border-primary bg-primary font-semibold text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground">
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              onClick={() => nav(`/app/giveting/c/${slug}/donate`)}
              disabled={!isActive}
              className="h-12 flex-[2] rounded-full bg-accent font-semibold text-accent-foreground hover:bg-accent/90"
            >
              <Heart className="mr-2 h-4 w-4" strokeWidth={2} />
              {isActive ? 'Donate' : 'Not accepting donations'}
            </Button>
            <Button onClick={share} variant="outline" className="h-12 flex-1 rounded-full border-primary bg-primary font-semibold text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground">
              <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
          </>
        )}
      </footer>

      <AlertDialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this fundraiser?</AlertDialogTitle>
            <AlertDialogDescription>
              It will become active again and appear on the home screen. Donors will be able to
              contribute immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopening}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={reopening} onClick={reopen}>
              {reopening ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reopening…</> : 'Reopen fundraiser'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};


export default GivetingCampaign;
