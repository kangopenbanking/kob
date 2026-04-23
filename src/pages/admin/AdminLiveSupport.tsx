import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { format, formatDistanceToNow } from 'date-fns';
import { Send, MessageCircle, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Conv {
  id: string; guest_name: string; guest_email: string; subject: string | null;
  status: 'open' | 'closed'; last_message_at: string; created_at: string; source: string;
}
interface Msg {
  id: string; sender_type: 'guest' | 'agent' | 'system'; sender_name: string | null;
  content: string; created_at: string;
}

const AdminLiveSupport: React.FC = () => {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Identify current user + heartbeat
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
      setMe({ id: data.user.id, name: prof?.full_name || data.user.email || 'Agent' });
      const ping = () => supabase.functions.invoke('support-agent-heartbeat').catch(() => {});
      ping();
      heartbeatRef.current = window.setInterval(ping, 30_000);
    })();
    return () => { cancelled = true; if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, []);

  const loadConversations = useCallback(async () => {
    let q = supabase.from('support_conversations')
      .select('id, guest_name, guest_email, subject, status, last_message_at, created_at, source')
      .order('last_message_at', { ascending: false }).limit(200);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) { toast.error('Could not load conversations'); return; }
    setConversations((data as Conv[]) || []);
  }, [filter]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Realtime list refresh
  useEffect(() => {
    const ch = supabase.channel('admin-support-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadConversations]);

  // Load messages on selection + realtime per conversation
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('support_messages')
        .select('id, sender_type, sender_name, content, created_at')
        .eq('conversation_id', activeId).order('created_at', { ascending: true });
      if (!cancelled) setMessages((data as Msg[]) || []);
    })();
    const ch = supabase.channel(`admin-conv-${activeId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${activeId}` },
        (p) => setMessages((prev) => [...prev, p.new as Msg])
      ).subscribe();
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
  };

  const closeConv = async (id: string) => {
    const { error } = await supabase.from('support_conversations').update({ status: 'closed' }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Conversation closed'); loadConversations(); }
  };
  const reopenConv = async (id: string) => {
    const { error } = await supabase.from('support_conversations').update({ status: 'open' }).eq('id', id);
    if (error) toast.error(error.message); else loadConversations();
  };

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return c.guest_name.toLowerCase().includes(s)
      || c.guest_email.toLowerCase().includes(s)
      || (c.subject || '').toLowerCase().includes(s);
  });

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 p-4">
      {/* Sidebar */}
      <Card className="flex w-80 shrink-0 flex-col overflow-hidden">
        <div className="border-b border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Conversations</h2>
            <Link to="/admin/support-settings" className="text-xs text-muted-foreground hover:text-foreground">Settings</Link>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 pl-8 text-xs" />
          </div>
          <div className="flex gap-1">
            {(['open', 'closed', 'all'] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="h-7 flex-1 text-xs capitalize">{f}</Button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">No conversations.</p>
          ) : filtered.map((c) => (
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
                <Badge variant={c.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">{c.status}</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{c.guest_email}</p>
              {c.subject && <p className="mt-0.5 truncate text-xs text-foreground/80">{c.subject}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}</p>
            </button>
          ))}
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
            <div className="flex items-center justify-between border-b border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{active.guest_name} <span className="font-normal text-muted-foreground">· {active.guest_email}</span></p>
                {active.subject && <p className="truncate text-xs text-muted-foreground">{active.subject}</p>}
              </div>
              <div className="flex items-center gap-2">
                {active.status === 'open' ? (
                  <Button size="sm" variant="outline" onClick={() => closeConv(active.id)}><X className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />Close</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => reopenConv(active.id)}>Reopen</Button>
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
    </div>
  );
};

export default AdminLiveSupport;
