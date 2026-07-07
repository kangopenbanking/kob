import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { giveting, formatMoney, newIdempotencyKey, progressPct, toMinor } from '@/lib/giveting';
import { ProgressRing } from '@/components/customer-app/giveting/ProgressRing';
import { toast } from 'sonner';

export const GivetingDonations: React.FC = () => {
  const { slug } = useParams();
  const nav = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: '', donor_name: '', donor_email: '', comment: '', anon: false });

  const load = async () => {
    const res: any = await giveting('get', { slug });
    setCampaign(res.campaign);
    const d: any = await giveting('list-donations', { campaign_id: res.campaign.id, limit: 100 });
    setDonations(d.donations ?? []);
    // Owner detection: try list-mine
    try {
      const mine: any = await giveting('list-mine');
      setIsOwner((mine.campaigns ?? []).some((c: any) => c.id === res.campaign.id));
    } catch {}
  };

  useEffect(() => { load().catch((e) => toast.error(e.message ?? 'Load failed')); }, [slug]);

  const addOffline = async () => {
    if (!campaign) return;
    setSaving(true);
    try {
      await giveting('add-offline-donation', {
        campaign_id: campaign.id,
        amount_minor: toMinor(form.amount, campaign.currency),
        donor_name: form.donor_name || undefined,
        donor_email: form.donor_email || undefined,
        comment: form.comment || undefined,
        is_anonymous: form.anon,
        idempotency_key: newIdempotencyKey(),
      });
      toast.success('Offline donation recorded');
      setAddOpen(false);
      setForm({ amount: '', donor_name: '', donor_email: '', comment: '', anon: false });
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not add donation');
    } finally {
      setSaving(false);
    }
  };

  if (!campaign) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  const pct = progressPct(campaign.total_raised_minor, campaign.goal_amount_minor);

  return (
    <div className="pb-20">
      <header className="flex items-center justify-between px-5 pt-6">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="h-9 w-9 rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {isOwner && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                <Plus className="mr-1 h-4 w-4" /> Add donation
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader>
                <DialogTitle>Add offline donation</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Amount ({campaign.currency})</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <Label>Donor's full name</Label>
                  <Input value={form.donor_name} onChange={(e) => setForm({ ...form, donor_name: e.target.value })} />
                </div>
                <div>
                  <Label>Donor's email (optional)</Label>
                  <Input type="email" value={form.donor_email} onChange={(e) => setForm({ ...form, donor_email: e.target.value })} />
                </div>
                <div>
                  <Label>Comment (optional)</Label>
                  <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer">Make donor anonymous</Label>
                  <Switch checked={form.anon} onCheckedChange={(v) => setForm({ ...form, anon: v })} />
                </div>
                <Button onClick={addOffline} disabled={!form.amount || saving} className="h-12 w-full rounded-full">
                  Add donation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </header>

      <div className="px-5 pt-4">
        <h1 className="text-3xl font-bold">Donations</h1>

        <Card className="mt-6 flex items-center justify-between rounded-2xl p-4">
          <div>
            <p className="text-xl font-bold">{formatMoney(campaign.goal_amount_minor, campaign.currency)} <span className="text-sm font-normal text-muted-foreground">goal</span></p>
            <p className="text-xs text-muted-foreground">{formatMoney(campaign.total_raised_minor, campaign.currency)} raised</p>
          </div>
          <ProgressRing pct={pct} size={64} stroke={6} />
        </Card>

        {donations.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-lg font-semibold">No donations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Donations will appear here.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {donations.map((d) => (
              <div key={d.id} className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase text-muted-foreground">
                  {(d.donor_display_name ?? '?').charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{d.donor_display_name ?? 'Anonymous'}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(d.amount_minor, d.currency)} · {new Date(d.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GivetingDonations;
