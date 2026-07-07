import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Eye, Pencil, Plus, ArrowUpRight, Bell, Users, Link2 } from 'lucide-react';
import { giveting, formatMoney, progressPct } from '@/lib/giveting';
import { ProgressRing } from '@/components/customer-app/giveting/ProgressRing';
import { toast } from 'sonner';

export const GivetingManage: React.FC = () => {
  const { slug } = useParams();
  const nav = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await giveting('get', { slug });
        setCampaign(res.campaign);
        const [d, u]: any[] = await Promise.all([
          giveting('list-donations', { campaign_id: res.campaign.id, limit: 5 }),
          giveting('list-updates', { campaign_id: res.campaign.id }),
        ]);
        setDonations(d.donations ?? []);
        setUpdates(u.updates ?? []);
      } catch (e: any) {
        toast.error(e.message ?? 'Load failed');
      }
    })();
  }, [slug]);

  const share = () => {
    const url = `${window.location.origin}/app/giveting/c/${slug}`;
    if (navigator.share) navigator.share({ title: campaign?.title ?? 'Fundraiser', url }).catch(() => {});
    else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/app/giveting/c/${slug}`);
    toast.success('Link copied');
  };

  if (!campaign) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  const pct = progressPct(campaign.total_raised_minor, campaign.goal_amount_minor);

  return (
    <div className="pb-32">
      <header className="flex items-center justify-between px-5 pt-6">
        <Button variant="ghost" size="icon" onClick={() => nav('/app/giveting')} className="h-9 w-9 rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav(`/app/giveting/c/${slug}`)} className="h-9 w-9 rounded-full" title="Preview">
            <Eye className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" title="Edit" disabled>
            <Pencil className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="px-5 pt-4">
        <h1 className="text-3xl font-bold tracking-tight">{campaign.title}</h1>

        <Card className="mt-6 overflow-hidden rounded-3xl">
          <div className="relative h-56 w-full bg-primary/5">
            {campaign.cover_media_url ? (
              <img src={campaign.cover_media_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary">
                <ProgressRing pct={pct} size={80} stroke={7} label={`${pct}%`} />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between p-5">
            <div>
              <p className="text-2xl font-bold">{formatMoney(campaign.goal_amount_minor, campaign.currency)} <span className="text-base font-normal text-muted-foreground">goal</span></p>
              <button onClick={() => nav(`/app/giveting/c/${slug}/withdraw`)} className="mt-1 text-sm font-medium text-primary underline">
                Set up transfers
              </button>
            </div>
            <ProgressRing pct={pct} size={72} stroke={7} />
          </div>
        </Card>

        <Card onClick={() => nav(`/app/giveting/c/${slug}/donations`)} className="mt-4 flex cursor-pointer items-center gap-4 rounded-2xl p-4 hover:shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Users className="h-5 w-5" strokeWidth={1.6} />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold">Donations</p>
            <p className="text-xs text-muted-foreground">{campaign.donor_count} total · {formatMoney(campaign.total_raised_minor, campaign.currency)} raised</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </Card>

        <Card onClick={() => nav(`/app/giveting/c/${slug}/updates/new`)} className="mt-3 flex cursor-pointer items-center gap-4 rounded-2xl p-4 hover:shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Bell className="h-5 w-5" strokeWidth={1.6} />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold">Post an update</p>
            <p className="text-xs text-muted-foreground">{updates.length} posted so far</p>
          </div>
          <Plus className="h-4 w-4 text-muted-foreground" />
        </Card>

        {donations.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold">Recent donations</h2>
            <div className="space-y-3">
              {donations.map((d) => (
                <div key={d.id} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase text-muted-foreground">
                    {(d.donor_display_name ?? '?').charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{d.donor_display_name ?? 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground">{formatMoney(d.amount_minor, d.currency)} · {new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-16 z-40 mx-auto flex max-w-lg gap-3 border-t bg-background px-5 py-3">
        <Button variant="outline" onClick={copyLink} className="h-12 flex-1 rounded-full">
          <Link2 className="mr-2 h-4 w-4" /> Copy link
        </Button>
        <Button onClick={share} className="h-12 flex-[2] rounded-full bg-primary font-semibold">
          Share
        </Button>
      </footer>
    </div>
  );
};

export default GivetingManage;
