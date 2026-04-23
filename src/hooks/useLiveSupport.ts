import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TOKEN_KEY = 'kob_support_guest_token';
const NAME_KEY = 'kob_support_guest_name';
const EMAIL_KEY = 'kob_support_guest_email';

export interface SupportMsg {
  id: string;
  sender_type: 'guest' | 'agent' | 'system';
  sender_name?: string | null;
  content: string;
  created_at: string;
}

export interface SupportConv {
  id: string;
  guest_name: string;
  guest_email: string;
  subject: string | null;
  status: 'open' | 'closed';
  created_at: string;
  last_message_at: string;
}

export interface SupportAvailability {
  online: boolean;
  in_business_hours: boolean;
  agents_available: boolean;
  sla_online_minutes: number;
  sla_offline_hours: number;
}

export function getStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function getStoredIdentity() {
  try {
    return {
      name: localStorage.getItem(NAME_KEY) || '',
      email: localStorage.getItem(EMAIL_KEY) || '',
    };
  } catch { return { name: '', email: '' }; }
}
export function clearSupportSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function useLiveSupport() {
  const [token, setToken] = useState<string>(() => getStoredToken());
  const [conv, setConv] = useState<SupportConv | null>(null);
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [availability, setAvailability] = useState<SupportAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  const refresh = useCallback(async (t = token) => {
    if (!t) {
      const { data } = await supabase.functions.invoke('support-fetch', { body: { status_only: true } });
      if ((data as any)?.availability) setAvailability((data as any).availability);
      return;
    }
    const { data, error } = await supabase.functions.invoke('support-fetch', { body: { guest_token: t } });
    if (error || (data as any)?.error) {
      setError((data as any)?.error || error?.message || 'Failed to load');
      return;
    }
    setConv((data as any).conversation);
    setMessages((data as any).messages);
    if ((data as any).availability) setAvailability((data as any).availability);
  }, [token]);

  useEffect(() => { refresh(token); }, [token, refresh]);

  // Refresh availability every 60s so the badge stays accurate.
  useEffect(() => {
    const i = window.setInterval(() => {
      supabase.functions.invoke('support-fetch', { body: token ? { guest_token: token } : { status_only: true } })
        .then(({ data }) => { if ((data as any)?.availability) setAvailability((data as any).availability); })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(i);
  }, [token]);

  // Realtime subscription on the conversation
  useEffect(() => {
    if (!conv?.id) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase.channel(`support-conv-${conv.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${conv.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as SupportMsg])
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_conversations', filter: `id=eq.${conv.id}` },
        (payload) => setConv((c) => c ? { ...c, ...(payload.new as any) } : c)
      )
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [conv?.id]);

  const start = useCallback(async (input: { name: string; email: string; subject?: string; message?: string; source?: string }) => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('support-start', { body: input });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Could not start chat');
      const t = (data as any).guest_token as string;
      try {
        localStorage.setItem(TOKEN_KEY, t);
        localStorage.setItem(NAME_KEY, input.name);
        localStorage.setItem(EMAIL_KEY, input.email);
      } catch {}
      setToken(t);
      await refresh(t);
      return t;
    } catch (e: any) {
      setError(e?.message || 'Could not start chat'); throw e;
    } finally { setLoading(false); }
  }, [refresh]);

  const send = useCallback(async (content: string) => {
    if (!token || !content.trim()) return;
    const optimistic: SupportMsg = {
      id: `tmp-${Date.now()}`,
      sender_type: 'guest',
      sender_name: conv?.guest_name || 'You',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const { data, error } = await supabase.functions.invoke('support-send', {
      body: { guest_token: token, content: content.trim() },
    });
    if (error || (data as any)?.error) {
      setError((data as any)?.error || error?.message || 'Failed to send');
      setMessages((prev) => prev.filter(m => m.id !== optimistic.id));
    }
  }, [token, conv?.guest_name]);

  const reset = useCallback(() => {
    clearSupportSession();
    setToken(''); setConv(null); setMessages([]); setError(null);
  }, []);

  return { token, conv, messages, availability, loading, error, start, send, refresh, reset };
}
