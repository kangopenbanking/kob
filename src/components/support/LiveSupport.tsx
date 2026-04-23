import React, { useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLiveSupport, getStoredIdentity } from '@/hooks/useLiveSupport';

interface LiveSupportProps {
  variant?: 'page' | 'panel';
  source?: string;
  onClose?: () => void;
  className?: string;
}

export const LiveSupport: React.FC<LiveSupportProps> = ({ variant = 'page', source = 'web', onClose, className }) => {
  const { token, conv, messages, loading, error, start, send, reset } = useLiveSupport();
  const seed = getStoredIdentity();
  const [name, setName] = useState(seed.name);
  const [email, setEmail] = useState(seed.email);
  const [subject, setSubject] = useState('');
  const [firstMsg, setFirstMsg] = useState('');
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    await start({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: firstMsg.trim(), source });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const v = draft;
    setDraft('');
    await send(v);
  };

  const wrapper = cn(
    'flex flex-col bg-background',
    variant === 'page' ? 'h-[calc(100vh-4rem)] w-full' : 'h-[560px] w-[360px] rounded-xl border border-border shadow-xl',
    className
  );

  return (
    <div className={wrapper}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-foreground">Live Support</h2>
        </div>
        <div className="flex items-center gap-1">
          {token && (
            <Button variant="ghost" size="icon" onClick={reset} aria-label="New conversation">
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          )}
        </div>
      </header>

      {!token ? (
        <form onSubmit={handleStart} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <p className="text-sm text-muted-foreground">
            Start a free chat with our support team. No account needed — replies arrive within 15 minutes during business hours, and within 24 hours otherwise.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="ls-name">Your name</Label>
            <Input id="ls-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ls-email">Email</Label>
            <Input id="ls-email" required type="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ls-subject">Subject (optional)</Label>
            <Input id="ls-subject" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Briefly, what can we help with?" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ls-msg">Message</Label>
            <Textarea id="ls-msg" rows={4} maxLength={4000} value={firstMsg} onChange={(e) => setFirstMsg(e.target.value)} placeholder="Tell us a bit about your question…" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !name.trim() || !email.trim()} className="rounded-xl">
            {loading ? 'Starting…' : 'Start chat'}
          </Button>
        </form>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {conv?.subject && (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Subject: </span>{conv.subject}
              </div>
            )}
            {messages.map((m) => {
              if (m.sender_type === 'system') {
                return (
                  <div key={m.id} className="flex justify-center">
                    <span className="max-w-[90%] rounded-lg border border-border bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
                      {m.content}
                    </span>
                  </div>
                );
              }
              const own = m.sender_type === 'guest';
              return (
                <div key={m.id} className={cn('flex', own ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-3.5 py-2',
                    own ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
                  )}>
                    {!own && <p className="mb-0.5 text-[10px] font-semibold opacity-70">{m.sender_name || 'Support'}</p>}
                    <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={cn('mt-1 text-[10px] opacity-60', own ? 'text-right' : 'text-left')}>
                      {format(new Date(m.created_at), 'HH:mm')}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-3 shrink-0">
            <Textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
              placeholder={conv?.status === 'closed' ? 'This conversation is closed.' : 'Write a message…'}
              disabled={conv?.status === 'closed'}
              className="min-h-[40px] resize-none"
              maxLength={4000}
            />
            <Button type="submit" size="icon" disabled={!draft.trim() || conv?.status === 'closed'} className="shrink-0">
              <Send className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </form>
        </>
      )}
    </div>
  );
};

export default LiveSupport;
