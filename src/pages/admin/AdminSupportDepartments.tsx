import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Dept {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  routing_keywords: string[];
  sla_online_minutes: number;
  sla_offline_hours: number;
  escalate_after_minutes: number;
  created_at: string;
}

const empty: Partial<Dept> = {
  name: '', description: '', is_default: false, is_active: true,
  routing_keywords: [], sla_online_minutes: 15, sla_offline_hours: 24, escalate_after_minutes: 60,
};

const AdminSupportDepartments: React.FC = () => {
  const [rows, setRows] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Dept> | null>(null);
  const [keywordsText, setKeywordsText] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('support_departments')
      .select('*').order('is_default', { ascending: false }).order('name');
    if (error) toast.error(error.message); else setRows((data as Dept[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing({ ...empty }); setKeywordsText(''); };
  const openEdit = (d: Dept) => { setEditing({ ...d }); setKeywordsText((d.routing_keywords || []).join(', ')); };

  const save = async () => {
    if (!editing?.name?.trim()) { toast.error('Name is required'); return; }
    const payload = {
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      is_default: !!editing.is_default,
      is_active: editing.is_active !== false,
      routing_keywords: keywordsText.split(',').map(s => s.trim()).filter(Boolean),
      sla_online_minutes: Number(editing.sla_online_minutes) || 15,
      sla_offline_hours: Number(editing.sla_offline_hours) || 24,
      escalate_after_minutes: Number(editing.escalate_after_minutes) || 60,
    };
    if (payload.is_default) {
      // Unset other defaults first
      await supabase.from('support_departments').update({ is_default: false }).eq('is_default', true);
    }
    const res = editing.id
      ? await supabase.from('support_departments').update(payload).eq('id', editing.id)
      : await supabase.from('support_departments').insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success('Department saved');
    setEditing(null);
    load();
  };

  const remove = async (d: Dept) => {
    if (!confirm(`Delete department "${d.name}"? Assigned conversations will be unlinked.`)) return;
    const { error } = await supabase.from('support_departments').delete().eq('id', d.id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Support Departments</h1>
          <p className="text-sm text-muted-foreground">Route chats by keyword and set per-department SLAs.</p>
        </div>
        <Button onClick={openNew} className="rounded-xl"><Plus className="mr-1.5 h-4 w-4" strokeWidth={1.5} />New department</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Routing keywords</div>
          <div className="col-span-2">SLA (online / offline)</div>
          <div className="col-span-1 text-center">Escalate</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No departments yet.</p>
        ) : rows.map((d) => (
          <div key={d.id} className="grid grid-cols-12 items-center gap-2 border-b border-border px-4 py-3 text-sm last:border-0">
            <div className="col-span-3">
              <div className="flex items-center gap-2 font-medium text-foreground">
                {d.name}
                {d.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
              </div>
              {d.description && <p className="mt-0.5 text-xs text-muted-foreground">{d.description}</p>}
            </div>
            <div className="col-span-3 text-xs text-muted-foreground">
              {(d.routing_keywords || []).join(', ') || <span className="italic">—</span>}
            </div>
            <div className="col-span-2 text-xs text-foreground/80">{d.sla_online_minutes}m / {d.sla_offline_hours}h</div>
            <div className="col-span-1 text-center text-xs">{d.escalate_after_minutes}m</div>
            <div className="col-span-1 text-center">
              <Badge variant={d.is_active ? 'default' : 'secondary'} className="text-[10px]">{d.is_active ? 'Active' : 'Off'}</Badge>
            </div>
            <div className="col-span-2 flex items-center justify-end gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" strokeWidth={1.5} /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(d)} disabled={d.is_default}>
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit department' : 'New department'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Routing keywords (comma-separated)</Label>
                <Input value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder="payment, invoice, refund" />
                <p className="text-xs text-muted-foreground">If a guest's subject or first message contains any of these words, the chat is routed here.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Online SLA (min)</Label>
                  <Input type="number" min={1} max={1440} value={editing.sla_online_minutes ?? 15} onChange={(e) => setEditing({ ...editing, sla_online_minutes: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Offline SLA (hr)</Label>
                  <Input type="number" min={1} max={168} value={editing.sla_offline_hours ?? 24} onChange={(e) => setEditing({ ...editing, sla_offline_hours: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Escalate after (min)</Label>
                  <Input type="number" min={5} max={10080} value={editing.escalate_after_minutes ?? 60} onChange={(e) => setEditing({ ...editing, escalate_after_minutes: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
                  Default department
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.is_active !== false} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  Active
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSupportDepartments;
