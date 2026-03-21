import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthenticatedUser } from '@/hooks/useAuthenticatedUser';
import { ChatThread } from '@/components/support/ChatThread';
import { ChatInput } from '@/components/support/ChatInput';
import { useSupportMessages, useSendMessage } from '@/hooks/useSupportChat';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Users, Building2, Search, Loader2, RefreshCw, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

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

  const { messages, loading: msgsLoading } = useSupportMessages(activeConvId);
  const sendMessage = useSendMessage();

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

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('admin-support-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => fetchConversations())
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
  };

  const updatePriority = async (convId: string, priority: string) => {
    await supabase.from('support_conversations').update({ priority, updated_at: new Date().toISOString() }).eq('id', convId);
    fetchConversations();
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
                ) : filtered.map((conv) => (
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
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge className={cn('text-[10px]', priorityLabels[conv.priority]?.color)}>
                      {priorityLabels[conv.priority]?.label}
                    </Badge>
                  </button>
                ))}
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
                  {/* Actions bar */}
                  {activeConv && (
                    <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                      <p className="flex-1 text-sm font-medium truncate">{activeConv.subject || 'Support Chat'}</p>
                      <Select value={activeConv.priority} onValueChange={(v) => updatePriority(activeConvId, v)}>
                        <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
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
                  <ChatThread messages={messages} currentUserId={user?.id} className="flex-1" />
                  <ChatInput onSend={handleSend} disabled={activeConv?.status === 'closed'} placeholder="Reply as agent..." />
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {departments.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-semibold">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.description}</p>
                    </div>
                    <Badge variant={d.is_active ? 'default' : 'secondary'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader><CardTitle>Support Agents</CardTitle></CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No agents assigned yet</p>
              ) : (
                <div className="space-y-3">
                  {agents.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-semibold">{a.profiles?.full_name || a.profiles?.email || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{a.support_departments?.name}</p>
                      </div>
                      <Badge variant={a.status === 'online' ? 'default' : 'secondary'}>{a.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSupportChat;
