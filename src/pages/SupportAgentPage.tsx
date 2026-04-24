// PERMANENT PUBLIC ROUTE — Support Agent Console
// Combined login + inbox. Free public URL: /support-agent
// Agents log in here with credentials emailed in the invite. On first login,
// they are forced to set a new password.
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Send, LogOut, MessageCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

interface Conv {
  id: string; guest_name: string; guest_email: string; subject: string | null;
  status: 'open' | 'closed'; last_message_at: string; assigned_agent_id: string | null;
  priority: string;
}
interface Msg { id: string; sender_type: 'guest' | 'agent' | 'system'; sender_name: string | null; content: string; created_at: string; }

const SupportAgentPage: React.FC = () => {
  const [phase, setPhase] = useState<'loading' | 'login' | 'reset' | 'inbox'>('loading');
  const [user, setUser] = useState<{ id: string; email: string; name: string; agentId: string } | null>(null);

  // login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [busy, setBusy] = useState(false);

  // inbox
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const heartbeatRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const initFromSession = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.user) { setPhase('login'); return; }
    const u = s.session.user;
    const { data: agent } = await supabase
      .from('support_agents')
      .select('id, password_reset_required, display_name')
      .eq('user_id', u.id).maybeSingle();
    if (!agent) {
      await supabase.auth.signOut();
      toast.error('This account is not registered as a support agent.');
      setPhase('login');
      return;
    }
    if (agent.password_reset_required) {
      setUser({ id: u.id, email: u.email || '', name: agent.display_name || u.email || 'Agent', agentId: agent.id });
      setPhase('reset');
      return;
    }
    setUser({ id: u.id, email: u.email || '', name: agent.display_name || u.email || 'Agent', agentId: agent.id });
    setPhase('inbox');
  }, []);

  useEffect(() => { initFromSession(); }, [initFromSession]);

  // heartbeat + load convs while in inbox
  useEffect(() => {
    if (phase !== 'inbox' || !user) return;
    const ping = () => supabase.functions.invoke('support-agent-heartbeat').catch(() => {});
    ping();
    heartbeatRef.current = window.setInterval(ping, 30_000);

    const load = async () => {
      const { data } = await supabase
        .from('support_conversations')
        .select('id, guest_name, guest_email, subject, status, last_message_at, assigned_agent_id, priority')
        .order('last_message_at', { ascending: false })
        .limit(100);
      setConversations((data as Conv[]) || []);
    };
    load();

    const ch = supabase.channel(`agent-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, load)
      .subscribe();

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      supabase.removeChannel(ch);
    };
  }, [phase, user]);

  // load messages for active
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    const load = async () => {
      const { data } = await supabase.from('support_messages')
        .select('id, sender_type, sender_name, content, created_at')
        .eq('conversation_id', activeId).order('created_at');
      setMessages((data as Msg[]) || []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };
    load();
    const ch = supabase.channel(`msgs-${activeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${activeId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) { toast.error(error.message); return; }
      await initFromSession();
    } finally { setBusy(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    if (newPwd !== confirmPwd) { toast.error('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) { toast.error(error.message); return; }
      if (user) {
        await supabase.from('support_agents')
          .update({ password_reset_required: false } as never)
          .eq('id', user.agentId);
      }
      toast.success('Password updated. Welcome!');
      setPhase('inbox');
    } finally { setBusy(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setActiveId(null);
    setPhase('login');
  };

  const sendReply = async () => {
    if (!activeId || !user || !draft.trim()) return;
    const content = draft.trim();
    setDraft('');
    const { error } = await supabase.from('support_messages').insert({
      conversation_id: activeId, sender_type: 'agent', sender_id: user.id, sender_name: user.name, content,
    });
    if (error) { toast.error(error.message); setDraft(content); return; }
    await supabase.from('support_conversations')
      .update({ last_message_at: new Date().toISOString(), assigned_agent_id: user.agentId } as never)
      .eq('id', activeId);
  };

  const active = useMemo(() => conversations.find(c => c.id === activeId), [conversations, activeId]);

  // ───────── render ─────────
  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (phase === 'login') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Helmet><title>Support Agent Console — Sign in</title></Helmet>
        <Card className="w-full max-w-md p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2"><ShieldCheck className="h-5 w-5 text-primary" strokeWidth={1.5} /></div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Support Agent Console</h1>
              <p className="text-xs text-muted-foreground">Sign in with the credentials from your invitation email.</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Need an invitation? Contact your administrator.
          </p>
        </Card>
      </div>
    );
  }

  if (phase === 'reset') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Helmet><title>Set a new password</title></Helmet>
        <Card className="w-full max-w-md p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Set your password</h1>
          <p className="mb-4 text-sm text-muted-foreground">Choose a new password to replace the temporary one from your invitation.</p>
          <form onSubmit={handleResetPassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="np">New password</Label>
              <Input id="np" type="password" required minLength={8} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp">Confirm password</Label>
              <Input id="cp" type="password" required minLength={8} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password & continue'}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // INBOX
  return (
    <div className="flex h-screen flex-col bg-background">
      <Helmet><title>Support Agent Console</title></Helmet>
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <span className="text-sm font-medium text-foreground">Support Agent Console</span>
          <Badge variant="outline" className="ml-2 text-[10px]">{user?.name}</Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={handleLogout}>
          <LogOut className="h-4 w-4" strokeWidth={1.5} /> <span className="ml-1.5 text-xs">Sign out</span>
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-border bg-card">
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            Conversations ({conversations.length})
          </div>
          <ScrollArea className="h-[calc(100vh-7.5rem)]">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`block w-full border-b border-border px-3 py-2.5 text-left text-sm hover:bg-muted/50 ${activeId === c.id ? 'bg-muted' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium text-foreground">{c.guest_name}</span>
                  <Badge variant={c.status === 'open' ? 'default' : 'secondary'} className="ml-2 text-[10px]">{c.status}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.subject || c.guest_email}</p>
                <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}</p>
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">No conversations yet.</p>
            )}
          </ScrollArea>
        </aside>

        <section className="flex flex-1 flex-col">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a conversation to start
            </div>
          ) : (
            <>
              <div className="border-b border-border bg-card px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{active.guest_name}</p>
                    <p className="text-xs text-muted-foreground">{active.guest_email} · {active.subject || 'No subject'}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{active.priority}</Badge>
                </div>
              </div>
              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-2.5">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        m.sender_type === 'agent' ? 'bg-primary text-primary-foreground'
                        : m.sender_type === 'system' ? 'bg-muted text-muted-foreground italic'
                        : 'bg-muted text-foreground'
                      }`}>
                        <p className="text-[10px] opacity-70">{m.sender_name || m.sender_type} · {format(new Date(m.created_at), 'p')}</p>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
              <div className="border-t border-border bg-card px-4 py-2.5">
                <div className="flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    placeholder="Type your reply…"
                    rows={2}
                    className="resize-none"
                  />
                  <Button onClick={sendReply} disabled={!draft.trim()} size="icon" className="h-auto">
                    <Send className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default SupportAgentPage;
