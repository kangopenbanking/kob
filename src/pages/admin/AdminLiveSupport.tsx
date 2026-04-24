import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format, formatDistanceToNow } from 'date-fns';
import { Send, MessageCircle, X, Search, ArrowRightLeft, AlertTriangle, UserPlus, Clock, History } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type ConvStatus = 'open' | 'closed';
type Priority = 'low' | 'normal' | 'high' | 'urgent';

interface Conv {
  id: string; guest_name: string; guest_email: string; subject: string | null;
  status: ConvStatus; last_message_at: string; created_at: string; source: string;
  assigned_agent_id: string | null;
  department_id: string | null;
  priority: Priority;
  escalated_at: string | null;
  sla_response_due_at: string | null;
  sla_escalation_due_at: string | null;
}
interface Msg { id: string; sender_type: 'guest' | 'agent' | 'system'; sender_name: string | null; content: string; created_at: string; }
interface Dept { id: string; name: string }
interface Agent { id: string; display_name: string | null; is_active: boolean; is_supervisor: boolean; last_seen_at: string | null; full_name?: string; email?: string; }
interface Ev {
  id: string; event_type: string; actor_name: string | null; reason: string | null;
  from_agent_id: string | null; to_agent_id: string | null;
  from_department_id: string | null; to_department_id: string | null;
  metadata: any; created_at: string;
}

type StatusFilter = 'open' | 'closed' | 'all';
type AssignFilter = 'all' | 'assigned' | 'unassigned' | 'mine';
type PresenceFilter = 'all' | 'online' | 'offline';

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-secondary text-secondary-foreground',
  high: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40',
  urgent: 'bg-destructive/15 text-destructive border-destructive/40',
};

const AdminLiveSupport: React.FC = () => {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [draft, setDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all');
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [me, setMe] = useState<{ id: string; agentId?: string; name: string } | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [transferTo, setTransferTo] = useState<{ dept: string; agent: string; reason: string }>({ dept: '', agent: '', reason: '' });
  const [escalateTo, setEscalateTo] = useState<{ dept: string; agent: string; priority: Priority; reason: string }>({ dept: '', agent: '', priority: 'high', reason: '' });
  const heartbeatRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Identify current user + heartbeat
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      const [{ data: prof }, { data: agent }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle(),
        supabase.from('support_agents').select('id').eq('user_id', data.user.id).maybeSingle(),
      ]);
      setMe({ id: data.user.id, agentId: agent?.id, name: prof?.full_name || data.user.email || 'Agent' });
      const ping = () => supabase.functions.invoke('support-agent-heartbeat').catch(() => {});
      ping();
      heartbeatRef.current = window.setInterval(ping, 30_000);
    })();
    return () => { cancelled = true; if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, []);

  const loadDirectory = useCallback(async () => {
    const [{ data: d }, { data: a }] = await Promise.all([
      supabase.from('support_departments').select('id, name').eq('is_active', true).order('name'),
      supabase.from('support_agents').select('id, display_name, is_active, is_supervisor, last_seen_at, user_id').order('created_at'),
    ]);
    setDepartments((d as Dept[]) || []);
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
  }, []);
  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  const loadConversations = useCallback(async () => {
    let q = supabase.from('support_conversations')
      .select('id, guest_name, guest_email, subject, status, last_message_at, created_at, source, assigned_agent_id, department_id, priority, escalated_at, sla_response_due_at, sla_escalation_due_at')
      .order('priority', { ascending: false })
      .order('last_message_at', { ascending: false }).limit(300);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (deptFilter !== 'all') q = q.eq('department_id', deptFilter);
    if (assignFilter === 'assigned') q = q.not('assigned_agent_id', 'is', null);
    else if (assignFilter === 'unassigned') q = q.is('assigned_agent_id', null);
    else if (assignFilter === 'mine' && me?.agentId) q = q.eq('assigned_agent_id', me.agentId);
    const { data, error } = await q;
    if (error) { toast.error('Could not load conversations'); return; }
    setConversations((data as Conv[]) || []);
  }, [statusFilter, assignFilter, deptFilter, me?.agentId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Realtime list refresh
  useEffect(() => {
    const ch = supabase.channel('admin-support-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadConversations]);

  // Load messages + events on selection + realtime per conversation
  useEffect(() => {
    if (!activeId) { setMessages([]); setEvents([]); return; }
    let cancelled = false;
    (async () => {
      const [{ data: m }, { data: e }] = await Promise.all([
        supabase.from('support_messages')
          .select('id, sender_type, sender_name, content, created_at')
          .eq('conversation_id', activeId).order('created_at', { ascending: true }),
        supabase.from('support_conversation_events')
          .select('*').eq('conversation_id', activeId).order('created_at', { ascending: true }),
      ]);
      if (!cancelled) {
        setMessages((m as Msg[]) || []);
        setEvents((e as Ev[]) || []);
      }
    })();
    const ch = supabase.channel(`admin-conv-${activeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${activeId}` },
        (p) => setMessages((prev) => [...prev, p.new as Msg]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_conversation_events', filter: `conversation_id=eq.${activeId}` },
        (p) => setEvents((prev) => [...prev, p.new as Ev]))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activeId || !me) return;
    const content = draft.trim();
    setDraft('');
    const { error } = await supabase.from('support_messages').insert({
      conversation_id: activeId, sender_type: 'agent', sender_id: me.id, sender_name: me.name, content,
    });
    if (error) { toast.error(error.message); return; }
    // Mark first response if not yet set
    const conv = conversations.find(c => c.id === activeId);
    if (conv && !(conv as any).first_response_at) {
      await supabase.from('support_conversations').update({ first_response_at: new Date().toISOString() }).eq('id', activeId);
    }
  };

  const callAction = async (action: string, payload: Record<string, any> = {}) => {
    if (!activeId) return;
    const { data, error } = await supabase.functions.invoke('support-conversation-action', {
      body: { action, conversation_id: activeId, ...payload },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message || 'Action failed'); return false; }
    return true;
  };

  const claim = async () => {
    if (!me?.agentId) { toast.error('You are not registered as an agent.'); return; }
    if (await callAction('claim')) { toast.success('Claimed'); loadConversations(); }
  };
  const closeConv = async () => { if (await callAction('close')) { toast.success('Closed'); loadConversations(); } };
  const reopenConv = async () => { if (await callAction('reopen')) { loadConversations(); } };

  const submitTransfer = async () => {
    if (!transferTo.dept && !transferTo.agent) { toast.error('Pick a department or an agent.'); return; }
    const ok = await callAction('transfer', {
      to_department_id: transferTo.dept || null,
      to_agent_id: transferTo.agent || null,
      reason: transferTo.reason || null,
    });
    if (ok) { toast.success('Transferred'); setTransferOpen(false); setTransferTo({ dept: '', agent: '', reason: '' }); loadConversations(); }
  };
  const submitEscalate = async () => {
    const ok = await callAction('escalate', {
      to_department_id: escalateTo.dept || null,
      to_agent_id: escalateTo.agent || null,
      priority: escalateTo.priority,
      reason: escalateTo.reason || null,
    });
    if (ok) { toast.success('Escalated'); setEscalateOpen(false); setEscalateTo({ dept: '', agent: '', priority: 'high', reason: '' }); loadConversations(); }
  };

  const isAgentOnline = (id: string) => {
    const a = agents.find(x => x.id === id);
    return !!a?.last_seen_at && (Date.now() - new Date(a.last_seen_at).getTime()) < 90_000;
  };

  const filtered = useMemo(() => conversations.filter((c) => {
    if (presenceFilter !== 'all') {
      const online = c.assigned_agent_id ? isAgentOnline(c.assigned_agent_id) : false;
      if (presenceFilter === 'online' && !online) return false;
      if (presenceFilter === 'offline' && online) return false;
    }
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return c.guest_name.toLowerCase().includes(s)
      || c.guest_email.toLowerCase().includes(s)
      || (c.subject || '').toLowerCase().includes(s);
  }), [conversations, presenceFilter, search, agents]);

  const active = conversations.find((c) => c.id === activeId);
  const activeDept = active?.department_id ? departments.find(d => d.id === active.department_id) : null;
  const assignedAgent = active?.assigned_agent_id ? agents.find(a => a.id === active.assigned_agent_id) : null;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 p-4">
      {/* Sidebar */}
      <Card className="flex w-80 shrink-0 flex-col overflow-hidden">
        <div className="border-b border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Conversations</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/admin/support-departments" className="hover:text-foreground">Departments</Link>
              <span>·</span>
              <Link to="/admin/support-agents" className="hover:text-foreground">Agents</Link>
              <span>·</span>
              <Link to="/admin/support-settings" className="hover:text-foreground">Settings</Link>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 pl-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="all">All status</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignFilter} onValueChange={(v) => setAssignFilter(v as AssignFilter)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assignment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                {me?.agentId && <SelectItem value="mine">Assigned to me</SelectItem>}
              </SelectContent>
            </Select>
            <Select value={presenceFilter} onValueChange={(v) => setPresenceFilter(v as PresenceFilter)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Presence" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any presence</SelectItem>
                <SelectItem value="online">Agent online</SelectItem>
                <SelectItem value="offline">Agent offline</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All depts</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">No conversations.</p>
          ) : filtered.map((c) => {
            const dept = c.department_id ? departments.find(d => d.id === c.department_id) : null;
            const agent = c.assigned_agent_id ? agents.find(a => a.id === c.assigned_agent_id) : null;
            const online = agent ? isAgentOnline(agent.id) : false;
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  'w-full border-b border-border p-3 text-left transition-colors hover:bg-muted/50',
                  activeId === c.id && 'bg-muted'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{c.guest_name}</p>
                  <div className="flex items-center gap-1">
                    {c.priority !== 'normal' && (
                      <Badge variant="outline" className={cn('text-[10px] capitalize', PRIORITY_COLORS[c.priority])}>{c.priority}</Badge>
                    )}
                    <Badge variant={c.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">{c.status}</Badge>
                  </div>
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.guest_email}</p>
                {c.subject && <p className="mt-0.5 truncate text-xs text-foreground/80">{c.subject}</p>}
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    {dept && <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-foreground/80">{dept.name}</span>}
                    {agent ? (
                      <span className="flex items-center gap-1">
                        <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                        {agent.display_name || agent.full_name || 'Agent'}
                      </span>
                    ) : (
                      <span className="italic">Unassigned</span>
                    )}
                  </div>
                  <span>{formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}</span>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </Card>

      {/* Thread */}
      <Card className="flex flex-1 flex-col overflow-hidden">
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
            <MessageCircle className="mb-2 h-8 w-8" strokeWidth={1.25} />
            <p className="text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {active.guest_name} <span className="font-normal text-muted-foreground">· {active.guest_email}</span>
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {activeDept && <Badge variant="secondary" className="text-[10px]">{activeDept.name}</Badge>}
                  <Badge variant="outline" className={cn('text-[10px] capitalize', PRIORITY_COLORS[active.priority])}>{active.priority}</Badge>
                  {assignedAgent ? (
                    <Badge variant="outline" className="text-[10px]">
                      <span className={cn('mr-1 h-1.5 w-1.5 rounded-full inline-block', isAgentOnline(assignedAgent.id) ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                      {assignedAgent.display_name || assignedAgent.full_name || 'Agent'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-400 border-amber-500/40">Unassigned</Badge>
                  )}
                  {active.escalated_at && (
                    <Badge variant="outline" className="gap-1 text-[10px] text-destructive border-destructive/40">
                      <AlertTriangle className="h-3 w-3" strokeWidth={1.5} /> Escalated
                    </Badge>
                  )}
                  {active.sla_response_due_at && (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      Reply by {format(new Date(active.sla_response_due_at), 'MMM d, HH:mm')}
                    </Badge>
                  )}
                  {active.sla_escalation_due_at && (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      Escalate at {format(new Date(active.sla_escalation_due_at), 'HH:mm')}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!active.assigned_agent_id && me?.agentId && (
                  <Button size="sm" variant="outline" onClick={claim}><UserPlus className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />Claim</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}><ArrowRightLeft className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />Transfer</Button>
                <Button size="sm" variant="outline" onClick={() => setEscalateOpen(true)}><AlertTriangle className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />Escalate</Button>
                <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}><History className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />History</Button>
                {active.status === 'open' ? (
                  <Button size="sm" variant="outline" onClick={closeConv}><X className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />Close</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={reopenConv}>Reopen</Button>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-3 p-4">
                {messages.map((m) => {
                  if (m.sender_type === 'system') {
                    return (
                      <div key={m.id} className="flex justify-center">
                        <span className="max-w-[90%] rounded-lg border border-border bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">{m.content}</span>
                      </div>
                    );
                  }
                  const own = m.sender_type === 'agent';
                  return (
                    <div key={m.id} className={cn('flex', own ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[75%] rounded-2xl px-3.5 py-2', own ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md')}>
                        <p className="mb-0.5 text-[10px] font-semibold opacity-70">{m.sender_name || (own ? 'You' : 'Guest')}</p>
                        <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={cn('mt-1 text-[10px] opacity-60', own ? 'text-right' : 'text-left')}>{format(new Date(m.created_at), 'MMM d, HH:mm')}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
            <form onSubmit={reply} className="flex items-end gap-2 border-t border-border p-3">
              <Textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reply(e as any); } }}
                placeholder={active.status === 'closed' ? 'Reopen to reply.' : 'Type a reply…'}
                disabled={active.status === 'closed'}
                className="min-h-[40px] resize-none"
                maxLength={4000}
              />
              <Button type="submit" size="icon" disabled={!draft.trim() || active.status === 'closed'}>
                <Send className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </form>
          </>
        )}
      </Card>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer conversation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Department</label>
              <Select value={transferTo.dept || 'none'} onValueChange={(v) => setTransferTo({ ...transferTo, dept: v === 'none' ? '' : v, agent: '' })}>
                <SelectTrigger><SelectValue placeholder="Keep current" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keep current</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Agent</label>
              <Select value={transferTo.agent || 'none'} onValueChange={(v) => setTransferTo({ ...transferTo, agent: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Unassign / leave to claim" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassign</SelectItem>
                  {agents.filter(a => a.is_active).map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.display_name || a.full_name || a.email || 'Agent'}{isAgentOnline(a.id) ? ' · online' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason</label>
              <Textarea rows={2} value={transferTo.reason} onChange={(e) => setTransferTo({ ...transferTo, reason: e.target.value })} placeholder="Why are you transferring?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={submitTransfer}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalate dialog */}
      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Escalate conversation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New priority</label>
              <Select value={escalateTo.priority} onValueChange={(v) => setEscalateTo({ ...escalateTo, priority: v as Priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Escalate to department (optional)</label>
              <Select value={escalateTo.dept || 'none'} onValueChange={(v) => setEscalateTo({ ...escalateTo, dept: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Keep current" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keep current</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Assign to supervisor (optional)</label>
              <Select value={escalateTo.agent || 'none'} onValueChange={(v) => setEscalateTo({ ...escalateTo, agent: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Leave for any supervisor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Leave for any supervisor</SelectItem>
                  {agents.filter(a => a.is_supervisor && a.is_active).map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.display_name || a.full_name || a.email || 'Supervisor'}{isAgentOnline(a.id) ? ' · online' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason</label>
              <Textarea rows={2} value={escalateTo.reason} onChange={(e) => setEscalateTo({ ...escalateTo, reason: e.target.value })} placeholder="Why are you escalating?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateOpen(false)}>Cancel</Button>
            <Button onClick={submitEscalate}>Escalate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit history */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Conversation audit trail</DialogTitle></DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : events.map((e) => {
              const fromAgent = e.from_agent_id ? agents.find(a => a.id === e.from_agent_id) : null;
              const toAgent = e.to_agent_id ? agents.find(a => a.id === e.to_agent_id) : null;
              const fromDept = e.from_department_id ? departments.find(d => d.id === e.from_department_id) : null;
              const toDept = e.to_department_id ? departments.find(d => d.id === e.to_department_id) : null;
              return (
                <div key={e.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{e.event_type.replace('_', ' ')}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(e.created_at), 'MMM d, HH:mm:ss')}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">By {e.actor_name || '—'}</p>
                  {(fromAgent || toAgent) && (
                    <p className="mt-1 text-xs">
                      Agent: {fromAgent ? (fromAgent.display_name || fromAgent.full_name) : '—'} → {toAgent ? (toAgent.display_name || toAgent.full_name) : '—'}
                    </p>
                  )}
                  {(fromDept || toDept) && (
                    <p className="text-xs">Dept: {fromDept?.name || '—'} → {toDept?.name || '—'}</p>
                  )}
                  {e.reason && <p className="mt-1 text-xs italic text-foreground/80">"{e.reason}"</p>}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLiveSupport;
