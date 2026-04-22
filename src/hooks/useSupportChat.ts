import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ChatMessage } from '@/components/support/ChatThread';
import { playNotificationSound } from '@/utils/notificationSound';
import type { Department } from '@/components/support/DepartmentPicker';
import type { ConversationSummary } from '@/components/support/ConversationList';

export function useSupportDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('support_departments')
      .select('id, name, description, icon')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data }) => {
        setDepartments((data as any) || []);
        setLoading(false);
      });
  }, []);

  return { departments, loading };
}

/** Count of agents currently marked online — drives the presence indicator. */
export function useOnlineAgentCount() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { count: c } = await supabase
        .from('support_agents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'online') as any;
      if (!cancelled) setCount(c ?? 0);
    };
    refresh();

    const ch = supabase
      .channel('support-agent-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_agents' }, () => refresh())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  return count;
}

export function useSupportConversations(userId?: string, guestId?: string) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId && !guestId) { setLoading(false); return; }
    let query = supabase
      .from('support_conversations')
      .select('id, subject, status, priority, created_at, updated_at, last_message_preview, last_message_at, unread_user_count, support_departments(name)')
      .order('updated_at', { ascending: false })
      .limit(20);
    if (userId) query = query.eq('user_id', userId);
    else if (guestId) query = query.eq('guest_id', guestId);
    const { data } = await query as any;

    setConversations(
      (data || []).map((c: any) => ({
        ...c,
        department_name: c.support_departments?.name,
      }))
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Live refresh whenever any of the user's conversations change
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`user-support-convs-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'support_conversations',
        filter: `user_id=eq.${userId}`,
      }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, refresh]);

  return { conversations, loading, refresh };
}

export function useSupportMessages(conversationId?: string, currentUserId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    initialLoadDone.current = false;
    if (!conversationId) { setLoading(false); setMessages([]); return; }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }) as any;
      setMessages(data || []);
      setLoading(false);
      initialLoadDone.current = true;
    };
    fetchMessages();

    const channel = supabase
      .channel(`support-msg-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages((prev) => [...prev, newMsg]);
        if (initialLoadDone.current && newMsg.sender_id !== currentUserId) {
          playNotificationSound();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const updated = payload.new as ChatMessage;
        setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, ...updated } : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, currentUserId]);

  return { messages, loading };
}

/** Marks the counterpart's messages in a conversation as read for the given role. */
export function useMarkRead() {
  return useCallback(async (conversationId: string, role: 'user' | 'agent') => {
    try {
      await supabase.rpc('support_mark_read' as any, {
        p_conversation_id: conversationId,
        p_role: role,
      });
    } catch (e) {
      console.warn('mark_read failed:', e);
    }
  }, []);
}

export function useCreateConversation() {
  return useCallback(async (
    userId: string,
    departmentId: string,
    subject: string,
    channel: string,
    initialMessage?: string
  ) => {
    const { data: conv, error } = await supabase
      .from('support_conversations')
      .insert({ user_id: userId, department_id: departmentId, subject, channel })
      .select('id')
      .single() as any;

    if (error || !conv) throw error || new Error('Failed to create conversation');

    if (initialMessage) {
      await supabase.from('support_messages').insert({
        conversation_id: conv.id,
        sender_type: 'user',
        sender_id: userId,
        content: initialMessage,
      });
    }

    await supabase.from('support_messages').insert({
      conversation_id: conv.id,
      sender_type: 'system',
      content: 'Welcome — an agent will be with you shortly.',
    });

    // Notify admins (best-effort, non-blocking)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single() as any;

      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin') as any;

      if (adminRoles?.length) {
        const adminIds = adminRoles.map((r: any) => r.user_id);
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('email, full_name')
          .in('id', adminIds) as any;

        await Promise.all((adminProfiles || []).map((p: any) => p?.email && supabase.functions.invoke('managed-send-email', {
          body: {
            email_key: 'support_new_conversation',
            recipient_email: p.email,
            variables: {
              user_name: p.full_name || 'Admin',
              subject: subject || 'General inquiry',
              customer_name: profile?.full_name || 'A customer',
              channel,
            },
          },
        })));
      }
    } catch (e) {
      console.warn('Admin email notification failed:', e);
    }

    return conv.id as string;
  }, []);
}

export function useSendMessage() {
  return useCallback(async (
    conversationId: string,
    senderId: string,
    senderType: 'user' | 'agent',
    content: string,
    filePath?: string,
    fileType?: string
  ) => {
    await supabase.from('support_messages').insert({
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: senderId,
      content: content || null,
      file_url: filePath || null, // schema name is file_url; we now persist a storage path
      file_type: fileType || null,
    });

    // updated_at, preview & unread counters are now handled by DB triggers.

    if (senderType === 'agent') {
      try {
        const { data: conv } = await supabase
          .from('support_conversations')
          .select('user_id, subject')
          .eq('id', conversationId)
          .single() as any;

        if (conv?.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', conv.user_id)
            .single() as any;

          if (profile?.email) {
            await supabase.functions.invoke('managed-send-email', {
              body: {
                email_key: 'support_agent_reply',
                recipient_email: profile.email,
                variables: {
                  user_name: profile.full_name || 'Customer',
                  subject: conv.subject || 'Support chat',
                  message_preview: (content || 'Sent an attachment').substring(0, 100),
                },
              },
            });
          }
        }
      } catch (e) {
        console.warn('Support email notification failed:', e);
      }
    }
  }, []);
}

/** Fired from admin when an agent is assigned to a conversation. */
export function useAssignConversation() {
  return useCallback(async (conversationId: string, agentUserId: string) => {
    try {
      const [{ data: conv }, { data: agentProfile }] = await Promise.all([
        supabase.from('support_conversations').select('subject, channel').eq('id', conversationId).single() as any,
        supabase.from('profiles').select('email, full_name').eq('id', agentUserId).single() as any,
      ]);

      if (agentProfile?.email) {
        await supabase.functions.invoke('managed-send-email', {
          body: {
            email_key: 'support_chat_assigned',
            recipient_email: agentProfile.email,
            variables: {
              agent_name: agentProfile.full_name || 'Agent',
              subject: conv?.subject || 'Support chat',
              channel: conv?.channel || 'website',
            },
          },
        });
      }
    } catch (e) {
      console.warn('Agent assignment email failed:', e);
    }
  }, []);
}

export function useResolveNotification() {
  return useCallback(async (conversationId: string, status: 'resolved' | 'closed') => {
    try {
      const { data: conv } = await supabase
        .from('support_conversations')
        .select('user_id, subject')
        .eq('id', conversationId)
        .single() as any;

      if (conv?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', conv.user_id)
          .single() as any;

        if (profile?.email) {
          await supabase.functions.invoke('managed-send-email', {
            body: {
              email_key: 'support_chat_resolved',
              recipient_email: profile.email,
              variables: {
                user_name: profile.full_name || 'Customer',
                subject: conv.subject || 'Support chat',
                status,
              },
            },
          });
        }
      }
    } catch (e) {
      console.warn('Resolve notification email failed:', e);
    }
  }, []);
}
