import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Shield, UserPlus, Loader2, Mail, Send, KeyRound, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Agent {
  id: string;
  user_id: string;
  display_name: string | null;
  is_active: boolean;
  is_supervisor: boolean;
  max_concurrent_chats: number;
  last_seen_at: string | null;
  email?: string;
  full_name?: string;
}
interface Dept { id: string; name: string }

// Canonical, persistent Support Agent Console URL — must NEVER point to a preview/lovable host.
const SUPPORT_AGENT_CONSOLE_URL = 'https://info.kangfintechsolutions.com/support-agent';

const AdminSupportAgents: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [memberships, setMemberships] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [editDepts, setEditDepts] = useState<string[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState<{ email: string; full_name: string; display_name: string; is_supervisor: boolean; max_concurrent_chats: number; department_ids: string[] }>({
    email: '', full_name: '', display_name: '', is_supervisor: false, max_concurrent_chats: 5, department_ids: [],
  });

  const load = async () => {
    setLoading(true);
    const [{ data: a }, { data: d }, { data: m }] = await Promise.all([
      supabase.from('support_agents').select('*').order('created_at', { ascending: true }),
      supabase.from('support_departments').select('id, name').eq('is_active', true).order('name'),
      supabase.from('support_agent_departments').select('agent_id, department_id'),
    ]);
    const userIds = (a || []).map((x: any) => x.user_id);
    const { data: profs } = userIds.length
      ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
      : { data: [] as any[] };
    const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
    setAgents((a || []).map((x: any) => ({
      ...x,
      full_name: profMap.get(x.user_id)?.full_name,
      email: profMap.get(x.user_id)?.email,
    })));
    setDepts((d as Dept[]) || []);
    const mm: Record<string, string[]> = {};
    (m || []).forEach((r: any) => { (mm[r.agent_id] ||= []).push(r.department_id); });
    setMemberships(mm);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (a: Agent) => {
    setEditing(a);
    setEditDepts(memberships[a.id] || []);
  };

  const save = async () => {
    if (!editing) return;
    const upd = await supabase.from('support_agents').update({
      display_name: editing.display_name?.trim() || null,
      is_active: editing.is_active,
      is_supervisor: editing.is_supervisor,
      max_concurrent_chats: Number(editing.max_concurrent_chats) || 5,
    }).eq('id', editing.id);
    if (upd.error) { toast.error(upd.error.message); return; }
    // Reset memberships
    await supabase.from('support_agent_departments').delete().eq('agent_id', editing.id);
    if (editDepts.length) {
      const rows = editDepts.map((dId) => ({ agent_id: editing.id, department_id: dId }));
      const ins = await supabase.from('support_agent_departments').insert(rows);
      if (ins.error) { toast.error(ins.error.message); return; }
    }
    toast.success('Agent updated');
    setEditing(null);
    load();
  };

  const isOnline = (ts: string | null) => !!ts && (Date.now() - new Date(ts).getTime()) < 90_000;

  const sendInvite = async () => {
    if (!invite.email.trim() || !invite.full_name.trim()) {
      toast.error('Email and full name are required.');
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('support-invite-agent', {
        body: {
          ...invite,
          login_url: SUPPORT_AGENT_CONSOLE_URL,
        },
      });
      if (error) { toast.error(error.message); return; }
      if ((data as any)?.error) { toast.error((data as any).error); return; }
      const sent = (data as any)?.email_sent;
      toast.success(sent ? 'Agent invited. Invitation email sent.' : 'Agent created. Email could not be sent — please share credentials manually.');
      setInviteOpen(false);
      setInvite({ email: '', full_name: '', display_name: '', is_supervisor: false, max_concurrent_chats: 5, department_ids: [] });
      load();
    } finally { setInviting(false); }
  };

  const [resendingId, setResendingId] = useState<string | null>(null);
  const resendInvite = async (agent: Agent) => {
    if (!agent.email) { toast.error('Agent has no email on file.'); return; }
    if (!confirm(`Resend invitation to ${agent.email}? A new temporary password will be generated and the previous one will stop working.`)) return;
    setResendingId(agent.id);
    try {
      const { data, error } = await supabase.functions.invoke('support-invite-agent', {
        body: {
          resend: true,
          agent_id: agent.id,
          login_url: SUPPORT_AGENT_CONSOLE_URL,
        },
      });
      if (error) { toast.error(error.message); return; }
      if ((data as any)?.error) { toast.error((data as any).error); return; }
      const sent = (data as any)?.email_sent;
      toast.success(sent ? `Invitation re-sent to ${agent.email}.` : 'Password reset, but the email could not be sent.');
    } finally { setResendingId(null); }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Support Agents</h1>
          <p className="text-sm text-muted-foreground">Invite and manage agent activation, departments, supervisor role, and chat capacity.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Invite agent
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-3">Agent</div>
          <div className="col-span-3">Departments</div>
          <div className="col-span-1 text-center">Capacity</div>
          <div className="col-span-2 text-center">Last seen</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-1 text-right">Edit</div>
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No agents yet. Admins are auto-registered when they sign in to the support inbox.</p>
        ) : agents.map((a) => {
          const memberDeptNames = (memberships[a.id] || [])
            .map((id) => depts.find((d) => d.id === id)?.name).filter(Boolean).join(', ');
          return (
            <div key={a.id} className="grid grid-cols-12 items-center gap-2 border-b border-border px-4 py-3 text-sm last:border-0">
              <div className="col-span-3">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  {a.display_name || a.full_name || 'Agent'}
                  {a.is_supervisor && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Shield className="h-3 w-3" strokeWidth={1.5} /> Supervisor
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{a.email || '—'}</p>
              </div>
              <div className="col-span-3 text-xs text-muted-foreground">{memberDeptNames || <span className="italic">No department</span>}</div>
              <div className="col-span-1 text-center text-xs">{a.max_concurrent_chats}</div>
              <div className="col-span-2 text-center text-xs text-muted-foreground">
                {a.last_seen_at ? formatDistanceToNow(new Date(a.last_seen_at), { addSuffix: true }) : '—'}
              </div>
              <div className="col-span-2 flex items-center justify-center gap-2">
                <Badge variant={a.is_active ? 'default' : 'secondary'} className="text-[10px]">{a.is_active ? 'Active' : 'Off'}</Badge>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnline(a.last_seen_at) ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                  {isOnline(a.last_seen_at) ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <div className="col-span-1 flex items-center justify-end gap-1">
                <Button size="icon" variant="ghost" title="Resend invite" onClick={() => resendInvite(a)} disabled={resendingId === a.id}>
                  {resendingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.5} />}
                </Button>
                <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" strokeWidth={1.5} /></Button>
              </div>
            </div>
          );
        })}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit agent</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Display name</label>
                <Input value={editing.display_name || ''} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} placeholder={editing.full_name || 'Agent'} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Max concurrent chats</label>
                <Input type="number" min={1} max={50} value={editing.max_concurrent_chats}
                  onChange={(e) => setEditing({ ...editing, max_concurrent_chats: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Departments</label>
                <div className="rounded-lg border border-border p-3 space-y-2 max-h-48 overflow-y-auto">
                  {depts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No active departments.</p>
                  ) : depts.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editDepts.includes(d.id)}
                        onCheckedChange={(v) => setEditDepts(v ? [...editDepts, d.id] : editDepts.filter(x => x !== d.id))}
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.is_supervisor} onCheckedChange={(v) => setEditing({ ...editing, is_supervisor: v })} />
                  Supervisor
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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" strokeWidth={1.5} /> Invite a support agent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="agent@example.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full name</label>
              <Input value={invite.full_name} onChange={(e) => setInvite({ ...invite, full_name: e.target.value, display_name: invite.display_name || e.target.value })} placeholder="Marie Kemegne" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Display name (optional)</label>
              <Input value={invite.display_name} onChange={(e) => setInvite({ ...invite, display_name: e.target.value })} placeholder="Marie K." />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Max concurrent chats</label>
              <Input type="number" min={1} max={50} value={invite.max_concurrent_chats}
                onChange={(e) => setInvite({ ...invite, max_concurrent_chats: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Departments</label>
              <div className="rounded-lg border border-border p-3 space-y-2 max-h-40 overflow-y-auto">
                {depts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active departments. Create one first.</p>
                ) : depts.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={invite.department_ids.includes(d.id)}
                      onCheckedChange={(v) => setInvite({
                        ...invite,
                        department_ids: v ? [...invite.department_ids, d.id] : invite.department_ids.filter(x => x !== d.id),
                      })}
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={invite.is_supervisor} onCheckedChange={(v) => setInvite({ ...invite, is_supervisor: v })} />
              Supervisor
            </label>
            <p className="text-xs text-muted-foreground">
              A temporary password will be generated and emailed to the agent. They will be required to set a new password on first login at <code>/support-agent</code>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancel</Button>
            <Button onClick={sendInvite} disabled={inviting}>
              {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" strokeWidth={1.5} />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminSupportAgents;
