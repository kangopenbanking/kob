import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { giveting, formatMoney, GIVETING_CATEGORIES, GIVETING_CURRENCIES } from '@/lib/giveting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Pause, Play, Pencil, Search, Shield, Loader2 } from 'lucide-react';

type Campaign = {
  id: string;
  slug: string;
  title: string;
  category_slug: string;
  currency: string;
  goal_amount_minor: number;
  total_raised_minor: number;
  donor_count: number;
  cover_media_url: string | null;
  location_country: string | null;
  location_city: string | null;
  status: string;
  owner_user_id: string;
  created_at: string;
  published_at: string | null;
  moderation_notes: string | null;
  moderated_at: string | null;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Draft',     className: 'bg-muted text-muted-foreground' },
  pending:   { label: 'Pending',   className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  active:    { label: 'Active',    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  paused:    { label: 'Suspended', className: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200' },
  blocked:   { label: 'Blocked',   className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  completed: { label: 'Completed', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  archived:  { label: 'Archived',  className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
};

export default function AdminGiveting() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [confirm, setConfirm] = useState<{ campaign: Campaign; nextStatus: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-giveting', search, status, category],
    queryFn: () => giveting<{ campaigns: Campaign[]; total: number }>('admin-list', {
      search: search || undefined,
      status: status === 'all' ? undefined : status,
      category: category === 'all' ? undefined : category,
      limit: 100,
    }),
  });

  const setStatusMut = useMutation({
    mutationFn: (p: { id: string; status: string; notes?: string }) =>
      giveting('admin-set-status', p),
    onSuccess: () => {
      toast.success('Campaign updated');
      qc.invalidateQueries({ queryKey: ['admin-giveting'] });
      setConfirm(null);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Update failed'),
  });

  const updateMut = useMutation({
    mutationFn: (p: { id: string; patch: Partial<Campaign> }) =>
      giveting('admin-update', p),
    onSuccess: () => {
      toast.success('Campaign saved');
      qc.invalidateQueries({ queryKey: ['admin-giveting'] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Save failed'),
  });

  const campaigns = data?.campaigns ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg border p-2">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fundraising Campaigns</h1>
          <p className="text-sm text-muted-foreground">Moderate, edit, suspend, block or re-enable Giveting fundraisers.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {GIVETING_CATEGORIES.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {isLoading ? 'Loading…' : `${data?.total ?? campaigns.length} campaigns`}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Raised / Goal</TableHead>
                <TableHead>Donors</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell></TableRow>
              )}
              {!isLoading && campaigns.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No campaigns match your filters.
                </TableCell></TableRow>
              )}
              {campaigns.map((c) => {
                const meta = STATUS_META[c.status] ?? { label: c.status, className: 'bg-muted' };
                const cat = GIVETING_CATEGORIES.find((x) => x.slug === c.category_slug);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {c.cover_media_url ? (
                          <img src={c.cover_media_url} alt="" className="h-10 w-14 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-14 rounded border bg-muted" />
                        )}
                        <div>
                          <div className="font-medium leading-tight">{c.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {(c.location_city || c.location_country) ?? '—'} · {new Date(c.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{cat?.label ?? c.category_slug}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm">{formatMoney(c.total_raised_minor, c.currency)}</div>
                      <div className="text-xs text-muted-foreground">of {formatMoney(c.goal_amount_minor, c.currency)}</div>
                    </TableCell>
                    <TableCell>{c.donor_count}</TableCell>
                    <TableCell>
                      <Badge className={meta.className} variant="secondary">{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                        {c.status !== 'active' && (
                          <Button size="sm" variant="outline" className="text-emerald-700 hover:text-emerald-800"
                            onClick={() => setConfirm({ campaign: c, nextStatus: 'active' })}>
                            <Play className="mr-1 h-3.5 w-3.5" /> Enable
                          </Button>
                        )}
                        {c.status !== 'paused' && c.status !== 'blocked' && (
                          <Button size="sm" variant="outline" className="text-orange-700 hover:text-orange-800"
                            onClick={() => setConfirm({ campaign: c, nextStatus: 'paused' })}>
                            <Pause className="mr-1 h-3.5 w-3.5" /> Suspend
                          </Button>
                        )}
                        {c.status !== 'blocked' && (
                          <Button size="sm" variant="outline" className="text-red-700 hover:text-red-800"
                            onClick={() => setConfirm({ campaign: c, nextStatus: 'blocked' })}>
                            <Ban className="mr-1 h-3.5 w-3.5" /> Block
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <EditCampaignDialog
          campaign={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => updateMut.mutate({ id: editing.id, patch })}
          saving={updateMut.isPending}
        />
      )}

      {confirm && (
        <StatusConfirmDialog
          campaign={confirm.campaign}
          nextStatus={confirm.nextStatus}
          onClose={() => setConfirm(null)}
          onConfirm={(notes) => setStatusMut.mutate({ id: confirm.campaign.id, status: confirm.nextStatus, notes })}
          saving={setStatusMut.isPending}
        />
      )}
    </div>
  );
}

function EditCampaignDialog({
  campaign, onClose, onSave, saving,
}: { campaign: Campaign; onClose: () => void; onSave: (patch: Partial<Campaign>) => void; saving: boolean }) {
  const [form, setForm] = useState({
    title: campaign.title,
    story: '',
    category_slug: campaign.category_slug,
    currency: campaign.currency,
    goal_amount_minor: String(campaign.goal_amount_minor),
    location_country: campaign.location_country ?? '',
    location_city: campaign.location_city ?? '',
    cover_media_url: campaign.cover_media_url ?? '',
    moderation_notes: campaign.moderation_notes ?? '',
  });

  useEffect(() => {
    // fetch full record to hydrate story
    giveting<{ campaign: any }>('get', { slug: campaign.slug }).then((r) => {
      if (r?.campaign?.story) setForm((f) => ({ ...f, story: r.campaign.story }));
    }).catch(() => {});
  }, [campaign.slug]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit campaign</DialogTitle>
          <DialogDescription>Update campaign details. Changes are logged with your moderator ID.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Story</Label>
            <Textarea rows={6} value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={form.category_slug} onValueChange={(v) => setForm({ ...form, category_slug: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GIVETING_CATEGORIES.map((c) => (<SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GIVETING_CURRENCIES.map((c) => (<SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Goal (minor units)</Label>
              <Input type="number" value={form.goal_amount_minor}
                onChange={(e) => setForm({ ...form, goal_amount_minor: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Cover URL</Label>
              <Input value={form.cover_media_url} onChange={(e) => setForm({ ...form, cover_media_url: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Country</Label>
              <Input value={form.location_country} onChange={(e) => setForm({ ...form, location_country: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>City</Label>
              <Input value={form.location_city} onChange={(e) => setForm({ ...form, location_city: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Moderator notes (internal)</Label>
            <Textarea rows={2} value={form.moderation_notes}
              onChange={(e) => setForm({ ...form, moderation_notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={() => onSave({
            title: form.title,
            story: form.story,
            category_slug: form.category_slug,
            currency: form.currency,
            goal_amount_minor: Number(form.goal_amount_minor),
            cover_media_url: form.cover_media_url || null,
            location_country: form.location_country || null,
            location_city: form.location_city || null,
            moderation_notes: form.moderation_notes || null,
          } as any)}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusConfirmDialog({
  campaign, nextStatus, onClose, onConfirm, saving,
}: { campaign: Campaign; nextStatus: string; onClose: () => void; onConfirm: (notes: string) => void; saving: boolean }) {
  const [notes, setNotes] = useState('');
  const label = STATUS_META[nextStatus]?.label ?? nextStatus;
  const isDestructive = nextStatus === 'blocked';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} campaign</DialogTitle>
          <DialogDescription>
            {isDestructive
              ? `"${campaign.title}" will be blocked and hidden from all public listings. The owner will not be able to reactivate it.`
              : `Set "${campaign.title}" to ${label.toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 py-2">
          <Label>Reason / notes {isDestructive ? '(required)' : '(optional)'}</Label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            disabled={saving || (isDestructive && notes.trim().length === 0)}
            onClick={() => onConfirm(notes.trim())}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
