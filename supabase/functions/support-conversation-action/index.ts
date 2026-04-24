// Admin/agent endpoint — claim, transfer, escalate, change priority, close, reopen.
// Writes to support_conversations and inserts a row into support_conversation_events
// for full audit trail.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify caller is admin OR a support agent
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    const isAdmin = !!roleRow;
    const { data: agentRow } = await admin.from('support_agents').select('id, is_supervisor, display_name').eq('user_id', userId).maybeSingle();
    if (!isAdmin && !agentRow) return json({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const conversationId = String(body.conversation_id || '');
    if (!conversationId) return json({ error: 'conversation_id required' }, 400);

    const { data: conv } = await admin.from('support_conversations')
      .select('id, status, assigned_agent_id, department_id, priority')
      .eq('id', conversationId).maybeSingle();
    if (!conv) return json({ error: 'Conversation not found' }, 404);

    // Resolve actor display name
    let actorName = agentRow?.display_name || null;
    if (!actorName) {
      const { data: prof } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
      actorName = prof?.full_name || prof?.email || 'Agent';
    }

    let update: Record<string, any> = {};
    let event: Record<string, any> = {
      conversation_id: conversationId,
      actor_user_id: userId,
      actor_name: actorName,
      from_agent_id: conv.assigned_agent_id,
      from_department_id: conv.department_id,
      reason: String(body.reason || '').slice(0, 500) || null,
    };

    switch (action) {
      case 'claim': {
        if (!agentRow) return json({ error: 'Only agents can claim' }, 403);
        update.assigned_agent_id = agentRow.id;
        event.event_type = 'claimed';
        event.to_agent_id = agentRow.id;
        break;
      }
      case 'unassign': {
        update.assigned_agent_id = null;
        event.event_type = 'reassigned';
        event.to_agent_id = null;
        break;
      }
      case 'transfer': {
        const toAgentId = body.to_agent_id ? String(body.to_agent_id) : null;
        const toDeptId = body.to_department_id ? String(body.to_department_id) : null;
        if (!toAgentId && !toDeptId) return json({ error: 'Provide to_agent_id or to_department_id' }, 400);
        if (toAgentId) update.assigned_agent_id = toAgentId;
        if (toDeptId) {
          update.department_id = toDeptId;
          if (!toAgentId) update.assigned_agent_id = null; // unassign on dept change unless explicit
        }
        event.event_type = 'transferred';
        event.to_agent_id = toAgentId;
        event.to_department_id = toDeptId;
        break;
      }
      case 'escalate': {
        update.escalated_at = new Date().toISOString();
        const newPriority = body.priority && ['low','normal','high','urgent'].includes(body.priority)
          ? body.priority
          : (conv.priority === 'urgent' ? 'urgent' : conv.priority === 'high' ? 'urgent' : 'high');
        update.priority = newPriority;
        if (body.to_department_id) update.department_id = String(body.to_department_id);
        if (body.to_agent_id) update.assigned_agent_id = String(body.to_agent_id);
        event.event_type = 'escalated';
        event.to_agent_id = body.to_agent_id || null;
        event.to_department_id = body.to_department_id || null;
        event.metadata = { new_priority: newPriority };
        break;
      }
      case 'priority': {
        const p = String(body.priority || '');
        if (!['low','normal','high','urgent'].includes(p)) return json({ error: 'Invalid priority' }, 400);
        update.priority = p;
        event.event_type = 'priority_changed';
        event.metadata = { from: conv.priority, to: p };
        break;
      }
      case 'close': {
        update.status = 'closed';
        event.event_type = 'closed';
        break;
      }
      case 'reopen': {
        update.status = 'open';
        event.event_type = 'reopened';
        break;
      }
      default:
        return json({ error: 'Unknown action' }, 400);
    }

    const { error: uErr } = await admin.from('support_conversations').update(update).eq('id', conversationId);
    if (uErr) return json({ error: uErr.message }, 500);

    await admin.from('support_conversation_events').insert(event);

    return json({ ok: true, update });
  } catch (e: any) {
    return json({ error: e?.message || 'Unexpected error' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
