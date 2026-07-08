import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Eye, Pencil, Plus, ArrowUpRight, Bell, Users, Link2, ImagePlus, Loader2, Upload } from 'lucide-react';
import { giveting, formatMoney, fromMinor, progressPct, toMinor, uploadGivetingCover } from '@/lib/giveting';
import { ProgressRing } from '@/components/customer-app/giveting/ProgressRing';
import { CampaignAuditTrail } from '@/components/customer-app/giveting/CampaignAuditTrail';
import { useAuthenticatedUser } from '@/hooks/useAuthenticatedUser';
import { toast } from 'sonner';

export const GivetingManage: React.FC = () => {
  const { slug } = useParams();
  const nav = useNavigate();
  const { user: authUser, loading: authLoading } = useAuthenticatedUser();
  const [campaign, setCampaign] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    story: '',
    goal_amount: '',
    cover_media_url: '',
    location_city: '',
    location_country: '',
    beneficiary_name: '',
    beneficiary_relation: '',
  });

  const isOwner = !!(authUser && campaign && authUser.id === campaign.owner_user_id);

  const openEdit = () => {
    if (!campaign) return;
    if (!isOwner) {
      toast.error('Only the fundraiser owner can edit this fundraiser.');
      return;
    }
    setEditForm({
      title: campaign.title ?? '',
      story: campaign.story ?? '',
      goal_amount: String(fromMinor(campaign.goal_amount_minor ?? 0)),
      cover_media_url: campaign.cover_media_url ?? '',
      location_city: campaign.location_city ?? '',
      location_country: campaign.location_country ?? '',
      beneficiary_name: campaign.beneficiary_name ?? '',
      beneficiary_relation: campaign.beneficiary_relation ?? '',
    });
    setEditOpen(true);
  };

  const onFilePicked = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadGivetingCover(file);
      setEditForm((f) => ({ ...f, cover_media_url: url }));
      toast.success('Cover image uploaded');
    } catch (e: any) {
      const m = e?.message || '';
      if (m === 'image_too_large') toast.error('Image is larger than 8 MB.');
      else if (m === 'unsupported_image_type') toast.error('Only PNG, JPEG, WebP or GIF supported.');
      else toast.error(m || 'Could not upload image');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveEdit = async () => {
    if (!campaign) return;
    const title = editForm.title.trim();
    const story = editForm.story.trim();
    if (title.length < 3) return toast.error('Title must be at least 3 characters.');
    if (story.length < 20) return toast.error('Story must be at least 20 characters.');
    const goalNum = Number(editForm.goal_amount);
    if (!goalNum || goalNum <= 0) return toast.error('Enter a valid goal amount.');
    setSaving(true);
    try {
      const res: any = await giveting('update', {
        id: campaign.id,
        patch: {
          title,
          story,
          goal_amount_minor: toMinor(goalNum, campaign.currency),
          cover_media_url: editForm.cover_media_url || null,
          location_city: editForm.location_city || null,
          location_country: editForm.location_country || null,
          beneficiary_name: editForm.beneficiary_name || null,
          beneficiary_relation: editForm.beneficiary_relation || null,
        },
      });
      setCampaign((c: any) => ({ ...c, ...res.campaign }));
      toast.success('Fundraiser updated');
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not update fundraiser');
    } finally {
      setSaving(false);
    }
  };

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

  if (authLoading || !campaign) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  if (!isOwner) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-lg font-semibold">Owner-only page</div>
        <p className="mb-6 max-w-xs text-sm text-muted-foreground">
          You can view this fundraiser, but only its owner can manage it.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav(`/app/giveting/c/${slug}`)} className="rounded-full">
            View fundraiser
          </Button>
          <Button onClick={() => nav('/app/giveting')} className="rounded-full">
            Back to Giveting
          </Button>
        </div>
      </div>
    );
  }

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
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" title={isOwner ? 'Edit' : 'Owner only'} onClick={openEdit} disabled={!isOwner}>
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

        <section className="mt-8">
          <CampaignAuditTrail campaignId={campaign.id} currency={campaign.currency} />
        </section>
      </div>

      <footer className="fixed inset-x-0 bottom-16 z-40 mx-auto flex max-w-lg gap-3 border-t bg-background px-5 py-3">
        <Button variant="outline" onClick={copyLink} className="h-12 flex-1 rounded-full">
          <Link2 className="mr-2 h-4 w-4" /> Copy link
        </Button>
        <Button onClick={share} className="h-12 flex-[2] rounded-full bg-primary font-semibold">
          Share
        </Button>
      </footer>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit fundraiser</DialogTitle>
            <DialogDescription>Update your fundraiser details. Changes are saved instantly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={100}
                className="mt-1 h-11"
              />
            </div>
            <div>
              <Label>Story</Label>
              <Textarea
                value={editForm.story}
                onChange={(e) => setEditForm((f) => ({ ...f, story: e.target.value }))}
                maxLength={4000}
                className="mt-1 min-h-[140px]"
              />
              <p className="mt-1 text-xs text-muted-foreground">{editForm.story.length} / 4000</p>
            </div>
            <div>
              <Label>Goal amount ({campaign?.currency})</Label>
              <Input
                type="number"
                min="1"
                inputMode="decimal"
                value={editForm.goal_amount}
                onChange={(e) => setEditForm((f) => ({ ...f, goal_amount: e.target.value }))}
                className="mt-1 h-11"
              />
            </div>
            <div>
              <Label>Cover image</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
              />
              <div className="mt-1 flex items-center gap-3">
                {editForm.cover_media_url ? (
                  <img src={editForm.cover_media_url} alt="" className="h-16 w-24 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                )}
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-full">
                  {uploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>) : (<><Upload className="mr-2 h-4 w-4" /> {editForm.cover_media_url ? 'Replace' : 'Upload'}</>)}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>City</Label>
                <Input value={editForm.location_city} onChange={(e) => setEditForm((f) => ({ ...f, location_city: e.target.value }))} className="mt-1 h-11" />
              </div>
              <div>
                <Label>Country</Label>
                <Input value={editForm.location_country} onChange={(e) => setEditForm((f) => ({ ...f, location_country: e.target.value }))} className="mt-1 h-11" />
              </div>
            </div>
            <div>
              <Label>Beneficiary name</Label>
              <Input value={editForm.beneficiary_name} onChange={(e) => setEditForm((f) => ({ ...f, beneficiary_name: e.target.value }))} className="mt-1 h-11" />
            </div>
            <div>
              <Label>Relationship</Label>
              <Input value={editForm.beneficiary_relation} onChange={(e) => setEditForm((f) => ({ ...f, beneficiary_relation: e.target.value }))} className="mt-1 h-11" placeholder="e.g. Brother, Local charity" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving} className="rounded-full">Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || uploading} className="rounded-full">
              {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>) : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GivetingManage;
