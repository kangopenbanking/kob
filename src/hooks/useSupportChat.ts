import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ChatMessage } from '@/components/support/ChatThread';
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

export function useSupportConversations(userId?: string) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from('support_conversations')
      .select('id, subject, status, priority, created_at, updated_at, support_departments(name)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(20) as any;

    setConversations(
      (data || []).map((c: any) => ({
        ...c,
        department_name: c.support_departments?.name,
      }))
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { conversations, loading, refresh };
}

export function useSupportMessages(conversationId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) { setLoading(false); return; }

    const fetch = async () => {
      const { data } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }) as any;
      setMessages(data || []);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel(`support-msg-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  return { messages, loading };
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

    // System welcome message
    await supabase.from('support_messages').insert({
      conversation_id: conv.id,
      sender_type: 'system',
      content: 'Welcome! An agent will be with you shortly.',
    });

    return conv.id as string;
  }, []);
}

export function useSendMessage() {
  return useCallback(async (
    conversationId: string,
    senderId: string,
    senderType: 'user' | 'agent',
    content: string,
    fileUrl?: string,
    fileType?: string
  ) => {
    await supabase.from('support_messages').insert({
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: senderId,
      content: content || null,
      file_url: fileUrl || null,
      file_type: fileType || null,
    });

    await supabase
      .from('support_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  }, []);
}
