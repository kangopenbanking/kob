import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthenticatedUser } from '@/hooks/useAuthenticatedUser';
import { ChatThread } from '@/components/support/ChatThread';
import { ChatInput } from '@/components/support/ChatInput';
import { useSupportMessages, useSendMessage, useAssignConversation, useResolveNotification } from '@/hooks/useSupportChat';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { MessageCircle, Users, Building2, Search, Loader2, RefreshCw, CheckCircle2, Clock, AlertTriangle, Plus, Trash2, Edit2, UserPlus, ArrowRightLeft, ArrowUpCircle, Hand, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAgentHeartbeat, useAgentPresenceList } from '@/hooks/useSupportAgentPresence';
import { logSupportAudit } from '@/lib/supportAudit';
import { SupportAuditLog } from '@/components/support/SupportAuditLog';

const statusColors: Record<string, string> = {
  open: 'bg-yellow-500',
  assigned: 'bg-blue-500',
  resolved: 'bg-green-500',
  closed: 'bg-muted-foreground',
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' },
};

const ICON_OPTIONS = ['headphones', 'credit-card', 'shield', 'settings', 'zap', 'heart', 'globe', 'truck'];

const AdminSupportChat: React.FC = () => {
  const { user } = useAuthenticatedUser();
  const [conversations, setConversations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string>();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('conversations');

  // Department CRUD state
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [deptForm, setDeptForm] = useState({ name: '', description: '', icon: 'headphones', display_order: 0, is_active: true });

  // Agent invite state
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', department_id: '', max_concurrent_chats: 5 });
  const [inviting, setInviting] = useState(false);

  const { messages, loading: msgsLoading } = useSupportMessages(activeConvId, user?.id);
  const sendMessage = useSendMessage();
  const assignConversationEmail = useAssignConversation();
  const resolveNotification = useResolveNotification();

  // Presence: heartbeat for this agent + watch all agents in workspace
  useAgentHeartbeat(user?.id);
  const presence = useAgentPresenceList();

  const fetchConversations = useCallback(async () => {
    let q = supabase
      .from('support_conversations')
      .select('*, support_departments(name)')
      .order('updated_at', { ascending: false })
      .limit(100) as any;
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setConversations(data || []);
    setLoading(false);
  }, [statusFilter]);

  const fetchDepartments = useCallback(async () => {
    const { data } = await supabase.from('support_departments').select('*').order('display_order') as any;
    setDepartments(data || []);
  }, []);

  const fetchAgents = useCallback(async () => {
    const { data } = await supabase.from('support_agents').select('*, profiles(full_name, email), support_departments(name)') as any;
    setAgents(data || []);
  }, []);

  useEffect(() => { fetchConversations(); fetchDepartments(); fetchAgents(); }, [fetchConversations, fetchDepartments, fetchAgents]);

  useEffect(() => {
    const ch = supabase
      .channel('admin-support-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, (payload) => {
        fetchConversations();
        // Play sound for new conversations
        if (payload.eventType === 'INSERT') {
          import('@/utils/notificationSound').then(m => m.playNotificationSound());
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchConversations]);

  const handleSend = async (content: string, fileUrl?: string, fileType?: string) => {
    if (!activeConvId || !user) return;
    await sendMessage(activeConvId, user.id, 'agent', content, fileUrl, fileType);
  };

  const updateConvStatus = async (convId: string, status: string) => {
    await supabase.from('support_conversations').update({
      status,
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', convId);
    toast({ title: `Conversation ${status}` });
    fetchConversations();

    // Send resolution/closure email to user
    if (status === 'resolved' || status === 'closed') {
      resolveNotification(convId, status as 'resolved' | 'closed');
    }
  };

  const updatePriority = async (convId: string, priority: string) => {
    const conv = conversations.find((c) => c.id === convId);
    await supabase.from('support_conversations').update({ priority, updated_at: new Date().toISOString() }).eq('id', convId);
    await logSupportAudit({
      conversationId: convId,
      action: 'priority_change',
      actorId: user?.id,
      details: { from: conv?.priority, to: priority },
    });
    fetchConversations();
  };

  const assignAgent = async (convId: string, agentId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    // Block assigning to an offline / away agent
    if (agentId) {
      const target = agents.find((a: any) => a.id === agentId || a.user_id === agentId);
      const isOnline = presence.isOnline(target?.user_id) || presence.isOnline(target?.id);
      if (!isOnline) {
        toast({
          title: 'Agent unavailable',
          description: 'This agent is offline or away. Pick someone online or wait for them to return.',
          variant: 'destructive',
        });
        return;
      }
    }
    await supabase.from('support_conversations').update({
      assigned_agent_id: agentId || null,
      status: agentId ? 'assigned' : 'open',
      updated_at: new Date().toISOString(),
    }).eq('id', convId);
    await logSupportAudit({
      conversationId: convId,
      action: 'assignment_change',
      actorId: user?.id,
      details: { from: conv?.assigned_agent_id, to: agentId || null },
    });
    toast({ title: agentId ? 'Agent assigned' : 'Agent unassigned' });
    fetchConversations();

    // Send assignment email to agent
    if (agentId) {
      const agent = agents.find((a: any) => a.id === agentId);
      if (agent?.user_id) {
        assignConversationEmail(convId, agent.user_id);
      }
    }
  };

  // Claim chat — optimistic UI, atomic DB function rejects if already claimed
  const claimConversation = async (convId: string) => {
    const previous = conversations;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, claimed_by: user?.id, claimed_at: new Date().toISOString(), status: 'assigned' }
          : c,
      ),
    );
    const { data, error } = await (supabase.rpc as any)('claim_support_conversation', { _conversation_id: convId });
    if (error) {
      setConversations(previous);
      toast({
        title: 'Could not claim',
        description: error.message === 'conversation_already_claimed'
          ? 'Another agent claimed this chat first.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Chat claimed', description: 'You are now responsible for this conversation.' });
    fetchConversations();
  };

  // Transfer conversation to another department (and clear current agent)
  const transferDepartment = async (convId: string, departmentId: string) => {
    if (!departmentId) return;
    const conv = conversations.find((c) => c.id === convId);
    await supabase.from('support_conversations').update({
      department_id: departmentId,
      assigned_agent_id: null,
      claimed_by: null,
      claimed_at: null,
      status: 'open',
      updated_at: new Date().toISOString(),
    }).eq('id', convId);
    await logSupportAudit({
      conversationId: convId,
      action: 'transfer',
      actorId: user?.id,
      details: { from_department: conv?.department_id, to_department: departmentId },
    });
    toast({ title: 'Conversation transferred', description: 'Re-routed to the selected department.' });
    fetchConversations();
    // Notify agents in the new department
    try {
      await supabase.functions.invoke('notify-support-agents', { body: { conversation_id: convId } });
    } catch (e) { console.warn('notify-support-agents (transfer) failed:', e); }
  };

  // Escalate priority one level (medium → high → urgent)
  const escalateConversation = async (convId: string, currentPriority: string) => {
    const next = currentPriority === 'low' ? 'medium'
      : currentPriority === 'medium' ? 'high'
      : 'urgent';
    if (next === currentPriority) {
      toast({ title: 'Already at highest priority' });
      return;
    }
    await supabase.from('support_conversations').update({
      priority: next,
      updated_at: new Date().toISOString(),
    }).eq('id', convId);
    await logSupportAudit({
      conversationId: convId,
      action: 'escalate',
      actorId: user?.id,
      details: { from: currentPriority, to: next },
    });
    toast({ title: `Escalated to ${next}` });
    fetchConversations();
  };

  // ---- Department CRUD ----
  const openDeptDialog = (dept?: any) => {
    if (dept) {
      setEditingDept(dept);
      setDeptForm({ name: dept.name, description: dept.description || '', icon: dept.icon || 'headphones', display_order: dept.display_order || 0, is_active: dept.is_active });
    } else {
      setEditingDept(null);
      setDeptForm({ name: '', description: '', icon: 'headphones', display_order: departments.length, is_active: true });
    }
    setDeptDialogOpen(true);
  };

  const saveDepartment = async () => {
    if (!deptForm.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    if (editingDept) {
      await supabase.from('support_departments').update(deptForm).eq('id', editingDept.id);
      toast({ title: 'Department updated' });
    } else {
      await supabase.from('support_departments').insert(deptForm);
      toast({ title: 'Department created' });
    }
    setDeptDialogOpen(false);
    fetchDepartments();
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm('Delete this department?')) return;
    await supabase.from('support_departments').delete().eq('id', id);
    toast({ title: 'Department deleted' });
    fetchDepartments();
  };

  // ---- Agent invite ----
  const inviteAgent = async () => {
    if (!inviteForm.email.trim() || !inviteForm.email.includes('@')) {
      toast({ title: 'Valid email required', variant: 'destructive' }); return;
    }
    if (!inviteForm.department_id) {
      toast({ title: 'Select a department', variant: 'destructive' }); return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('support-invite-agent', {
        body: {
          email: inviteForm.email.trim().toLowerCase(),
          full_name: inviteForm.full_name.trim() || undefined,
          department_id: inviteForm.department_id,
          max_concurrent_chats: inviteForm.max_concurrent_chats,
        },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || 'Failed to invite agent');
      }
      toast({
        title: 'Agent invited',
        description: (data as any)?.invite_sent
          ? 'Invitation email sent. They can set their password and log in.'
          : 'Existing user added as a support agent.',
      });
      setAgentDialogOpen(false);
      setInviteForm({ email: '', full_name: '', department_id: '', max_concurrent_chats: 5 });
      fetchAgents();
    } catch (e: any) {
      toast({ title: 'Invite failed', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const removeAgent = async (id: string) => {
    if (!confirm('Remove this agent?')) return;
    await supabase.from('support_agents').delete().eq('id', id);
    toast({ title: 'Agent removed' });
    fetchAgents();
  };

  const toggleAgentStatus = async (id: string, currentStatus: string) => {
    const next = currentStatus === 'online' ? 'offline' : 'online';
    await supabase.from('support_agents').update({ status: next }).eq('id', id);
    fetchAgents();
  };

  const filtered = conversations.filter((c) =>
    !search || c.subject?.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search)
  );

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const stats = {
    open: conversations.filter((c) => c.status === 'open').length,
    assigned: conversations.filter((c) => c.status === 'assigned').length,
    resolved: conversations.filter((c) => c.status === 'resolved').length,
    total: conversations.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support Chat</h1>
          <p className="text-sm text-muted-foreground">Manage customer support conversations</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchConversations()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3"><Clock className="h-5 w-5 text-yellow-500" /><div><p className="text-2xl font-bold">{stats.open}</p><p className="text-xs text-muted-foreground">Open</p></div></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3"><MessageCircle className="h-5 w-5 text-blue-500" /><div><p className="text-2xl font-bold">{stats.assigned}</p><p className="text-xs text-muted-foreground">Assigned</p></div></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><div><p className="text-2xl font-bold">{stats.resolved}</p><p className="text-xs text-muted-foreground">Resolved</p></div></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3"><Users className="h-5 w-5 text-primary" /><div><p className="text-2xl font-bold">{agents.length}</p><p className="text-xs text-muted-foreground">Agents</p></div></div>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations">
          <div className="flex gap-4 rounded-xl border border-border bg-card" style={{ minHeight: 500 }}>
            {/* Left — Conversation list */}
            <div className="flex w-80 shrink-0 flex-col border-r border-border">
              <div className="flex items-center gap-2 border-b border-border p-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 rounded-lg h-9 text-sm" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : filtered.map((conv) => {
                  const assignedAgent = agents.find((a: any) => a.user_id === conv.assigned_agent_id);
                  return (
                    <button key={conv.id} onClick={() => setActiveConvId(conv.id)}
                      className={cn('flex w-full items-start gap-3 border-b border-border p-3 text-left transition-colors',
                        activeConvId === conv.id ? 'bg-accent' : 'hover:bg-muted/50')}>
                      <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', statusColors[conv.status])} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{conv.subject || 'Support Chat'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{conv.support_departments?.name}</span>
                          <span>·</span>
                          <span>{conv.channel}</span>
                        </div>
                        {assignedAgent && (
                          <p className="mt-0.5 text-[10px] text-primary font-medium">
                            → {assignedAgent.profiles?.full_name || 'Agent'}
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge className={cn('text-[10px]', priorityLabels[conv.priority]?.color)}>
                        {priorityLabels[conv.priority]?.label}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right — Chat */}
            <div className="flex flex-1 flex-col">
              {!activeConvId ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <MessageCircle className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Select a conversation</p>
                </div>
              ) : (
                <>
                  {activeConv && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
                      <p className="flex-1 text-sm font-medium truncate">{activeConv.subject || 'Support Chat'}</p>
                      {/* Claim chat */}
                      {!activeConv.claimed_by && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => claimConversation(activeConvId)}
                        >
                          <Hand className="mr-1 h-3 w-3" /> Claim chat
                        </Button>
                      )}
                      {activeConv.claimed_by && activeConv.claimed_by !== user?.id && (
                        <Badge variant="secondary" className="h-6 text-[10px]">
                          Claimed by another agent
                        </Badge>
                      )}
                      {/* Assign agent — disabled options for offline agents */}
                      <Select
                        value={activeConv.assigned_agent_id || 'unassigned'}
                        onValueChange={(v) => assignAgent(activeConvId, v === 'unassigned' ? '' : v)}
                      >
                        <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Assign agent" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {agents.map((a: any) => {
                            const online = presence.isOnline(a.user_id) || presence.isOnline(a.id);
                            return (
                              <SelectItem key={a.user_id} value={a.user_id} disabled={!online}>
                                <span className="inline-flex items-center gap-2">
                                  <Circle
                                    className={cn(
                                      'h-2 w-2',
                                      online ? 'fill-green-500 text-green-500' : 'fill-muted text-muted-foreground',
                                    )}
                                  />
                                  {a.profiles?.full_name || a.profiles?.email || 'Agent'}
                                  {!online && <span className="text-[10px] text-muted-foreground">(offline)</span>}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Select value={activeConv.priority} onValueChange={(v) => updatePriority(activeConvId, v)}>
                        <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      {/* Transfer to another department */}
                      <Select value="" onValueChange={(v) => transferDepartment(activeConvId, v)}>
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <ArrowRightLeft className="mr-1 h-3 w-3" />
                          <SelectValue placeholder="Transfer" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments
                            .filter((d: any) => d.is_active && d.id !== activeConv.department_id)
                            .map((d: any) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          {departments.filter((d: any) => d.is_active && d.id !== activeConv.department_id).length === 0 && (
                            <SelectItem value="__none" disabled>No other departments</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {/* Escalate one priority level */}
                      {activeConv.priority !== 'urgent' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => escalateConversation(activeConvId, activeConv.priority)}>
                          <ArrowUpCircle className="mr-1 h-3 w-3" /> Escalate
                        </Button>
                      )}
                      {activeConv.status !== 'resolved' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateConvStatus(activeConvId, 'resolved')}>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
                        </Button>
                      )}
                      {activeConv.status !== 'closed' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateConvStatus(activeConvId, 'closed')}>
                          Close
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="flex flex-1 min-h-0">
                    <div className="flex flex-1 flex-col min-w-0">
                      <ChatThread messages={messages} currentUserId={user?.id} viewerRole="agent" className="flex-1" />
                      <ChatInput
                        onSend={handleSend}
                        disabled={activeConv?.status === 'closed'}
                        placeholder="Reply as agent..."
                        conversationId={activeConvId}
                        typingRole="agent"
                      />
                    </div>
                    <SupportAuditLog conversationId={activeConvId} className="hidden w-72 shrink-0 border-l border-border lg:block" />
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Departments Tab with CRUD */}
        <TabsContent value="departments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Departments</CardTitle>
              <Button size="sm" onClick={() => openDeptDialog()}>
                <Plus className="mr-1 h-4 w-4" /> Add Department
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {departments.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-semibold">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Icon: {d.icon} · Order: {d.display_order}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={d.is_active ? 'default' : 'secondary'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDeptDialog(d)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteDepartment(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {departments.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No departments yet</p>}
              </div>
            </CardContent>
          </Card>

          {/* Department Dialog */}
          <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDept ? 'Edit Department' : 'Add Department'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="e.g. Billing" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} placeholder="Brief description" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Icon</Label>
                    <Select value={deptForm.icon} onValueChange={(v) => setDeptForm({ ...deptForm, icon: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Display Order</Label>
                    <Input type="number" value={deptForm.display_order} onChange={(e) => setDeptForm({ ...deptForm, display_order: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={deptForm.is_active} onCheckedChange={(v) => setDeptForm({ ...deptForm, is_active: v })} />
                  <Label>Active</Label>
                </div>
                <Button onClick={saveDepartment} className="w-full">{editingDept ? 'Update' : 'Create'} Department</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Agents Tab with CRUD */}
        <TabsContent value="agents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Support Agents</CardTitle>
              <Button size="sm" onClick={() => { setAgentDialogOpen(true); setInviteForm({ email: '', full_name: '', department_id: '', max_concurrent_chats: 5 }); }}>
                <UserPlus className="mr-1 h-4 w-4" /> Invite Agent
              </Button>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No agents yet — invite one to get started.</p>
              ) : (
                <div className="space-y-3">
                  {agents.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-semibold">{a.profiles?.full_name || a.profiles?.email || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{a.support_departments?.name} · Max {a.max_concurrent_chats} chats</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs"
                          onClick={() => toggleAgentStatus(a.id, a.status)}>
                          <span className={cn('mr-1.5 h-2 w-2 rounded-full', a.status === 'online' ? 'bg-green-500' : 'bg-muted-foreground')} />
                          {a.status}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeAgent(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invite Agent Dialog */}
          <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Support Agent</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Agent Email</Label>
                  <Input type="email" value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="agent@example.com" />
                  <p className="text-xs text-muted-foreground mt-1">An invitation email will be sent if the user doesn't have an account yet.</p>
                </div>
                <div>
                  <Label>Full Name (optional)</Label>
                  <Input value={inviteForm.full_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                    placeholder="Jane Doe" />
                </div>
                <div>
                  <Label>Department</Label>
                  <Select value={inviteForm.department_id} onValueChange={(v) => setInviteForm({ ...inviteForm, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.filter((d: any) => d.is_active).map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max Concurrent Chats</Label>
                  <Input type="number" value={inviteForm.max_concurrent_chats}
                    onChange={(e) => setInviteForm({ ...inviteForm, max_concurrent_chats: parseInt(e.target.value) || 5 })} />
                </div>
                <Button onClick={inviteAgent} disabled={inviting} className="w-full">
                  {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Send Invite
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSupportChat;
