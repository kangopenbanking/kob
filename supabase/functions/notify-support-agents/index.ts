// Sends an email to every support agent in a department when a new chat is created.
// Invoked from the client right after createConversation succeeds.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { conversation_id } = await req.json().catch(() => ({}));
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: 'conversation_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: conv, error: convErr } = await admin
      .from('support_conversations')
      .select('id, subject, department_id, channel, guest_name, user_id, support_departments(name)')
      .eq('id', conversation_id)
      .single();
    if (convErr || !conv?.department_id) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve customer display name
    let customerName = (conv as any).guest_name || 'A guest visitor';
    if ((conv as any).user_id) {
      const { data: p } = await admin.from('profiles').select('full_name').eq('id', (conv as any).user_id).single();
      if (p?.full_name) customerName = p.full_name;
    }

    // Resolve dept agents
    const { data: agents } = await admin.rpc('get_support_dept_agent_emails', {
      _department_id: conv.department_id,
    });

    const deptName = (conv as any).support_departments?.name || 'Support';
    let sent = 0;

    await Promise.all(((agents as any[]) || []).map(async (a) => {
      if (!a?.email) return;
      try {
        await admin.functions.invoke('managed-send-email', {
          body: {
            email_key: 'support_new_chat_agent',
            recipient_email: a.email,
            variables: {
              agent_name: a.full_name || 'Agent',
              department_name: deptName,
              subject: (conv as any).subject || 'No subject',
              customer_name: customerName,
              channel: (conv as any).channel || 'website',
              portal_url: `${new URL(req.url).origin.replace('functions.', '')}/admin/support-chat`,
            },
          },
        });
        sent++;
      } catch (e) {
        console.warn('agent email failed:', a.email, e);
      }
    }));

    return new Response(JSON.stringify({ success: true, agents_notified: sent }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('notify-support-agents error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
