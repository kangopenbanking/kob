// Public endpoint — no auth required. Creates a guest support conversation,
// auto-routes to a department, computes SLA timestamps, and posts an offline
// system notice when no agent is available or outside business hours.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isInHours(bh: { timezone: string; start_hour: number; end_hour: number; active_days: number[] } | null) {
  if (!bh) return false;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: bh.timezone || 'UTC', hour: 'numeric', hour12: false, weekday: 'short',
    });
    const parts = fmt.formatToParts(new Date());
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const wkMap: Record<string, number> = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6, Sun:7 };
    const wk = wkMap[parts.find(p => p.type === 'weekday')?.value || ''] || 0;
    return bh.active_days.includes(wk) && hour >= bh.start_hour && hour < bh.end_hour;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const subject = String(body.subject || '').trim().slice(0, 200) || null;
    const initialMessage = String(body.message || '').trim().slice(0, 4000);
    const source = String(body.source || 'web').slice(0, 32);
    const requestedDeptId = body.department_id ? String(body.department_id) : null;

    if (!name || name.length > 120) return json({ error: 'Name is required.' }, 400);
    if (!EMAIL_RX.test(email) || email.length > 255) return json({ error: 'A valid email is required.' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Resolve department: explicit pick > keyword routing > default
    let departmentId: string | null = requestedDeptId;
    if (!departmentId) {
      const { data: routed } = await supabase.rpc('support_route_department', {
        p_text: `${subject || ''} ${initialMessage}`,
      });
      departmentId = (routed as string) || null;
    }
    const { data: dept } = await supabase
      .from('support_departments')
      .select('id, name, sla_online_minutes, sla_offline_hours, escalate_after_minutes')
      .eq('id', departmentId)
      .maybeSingle();

    // Availability
    const [{ data: bh }, { data: agentsOnline }] = await Promise.all([
      supabase.from('support_business_hours').select('*').eq('id', 1).maybeSingle(),
      supabase.from('support_agents').select('id').eq('is_active', true)
        .gte('last_seen_at', new Date(Date.now() - 90_000).toISOString()),
    ]);
    const inHours = isInHours(bh as any);
    const anyOnline = (agentsOnline?.length || 0) > 0;
    const isOnline = inHours && anyOnline;

    const slaOnlineMin = dept?.sla_online_minutes ?? 15;
    const slaOfflineHr = dept?.sla_offline_hours ?? 24;
    const escalateMin = dept?.escalate_after_minutes ?? 60;

    const now = Date.now();
    const responseDue = isOnline ? now + slaOnlineMin * 60_000 : now + slaOfflineHr * 3600_000;
    const escalationDue = now + escalateMin * 60_000;

    const { data: conv, error: cErr } = await supabase
      .from('support_conversations')
      .insert({
        guest_name: name,
        guest_email: email,
        subject,
        source,
        department_id: departmentId,
        sla_response_due_at: new Date(responseDue).toISOString(),
        sla_escalation_due_at: new Date(escalationDue).toISOString(),
      })
      .select('id, guest_token, last_message_at')
      .single();
    if (cErr || !conv) return json({ error: cErr?.message || 'Could not create conversation.' }, 500);

    if (initialMessage) {
      await supabase.from('support_messages').insert({
        conversation_id: conv.id, sender_type: 'guest', sender_name: name, content: initialMessage,
      });
    }

    if (!isOnline) {
      const offlineMsg = bh?.offline_message ||
        `Thanks for reaching out! Our ${dept?.name || 'support'} team responds within ${slaOnlineMin} minutes during business hours, and within ${slaOfflineHr} hours otherwise.`;
      await supabase.from('support_messages').insert({
        conversation_id: conv.id, sender_type: 'system', sender_name: 'KOB Support', content: offlineMsg,
      });
    }

    // Try hybrid auto-assign: pick a least-loaded online agent in the department
    if (departmentId) {
      const { data: candidates } = await supabase
        .from('support_agent_departments')
        .select('agent_id, support_agents!inner(id, is_active, last_seen_at, max_concurrent_chats)')
        .eq('department_id', departmentId);
      const cutoff = new Date(Date.now() - 90_000).toISOString();
      const eligible = (candidates || []).filter((c: any) =>
        c.support_agents?.is_active && c.support_agents?.last_seen_at && c.support_agents.last_seen_at >= cutoff
      );
      if (eligible.length) {
        // Pick one with fewest open chats
        const ids = eligible.map((c: any) => c.agent_id);
        const { data: loads } = await supabase
          .from('support_conversations')
          .select('assigned_agent_id')
          .in('assigned_agent_id', ids)
          .eq('status', 'open');
        const counts: Record<string, number> = {};
        ids.forEach((id: string) => (counts[id] = 0));
        (loads || []).forEach((r: any) => { counts[r.assigned_agent_id] = (counts[r.assigned_agent_id] || 0) + 1; });
        const winner = ids.sort((a, b) => counts[a] - counts[b])[0];
        await supabase.from('support_conversations').update({ assigned_agent_id: winner }).eq('id', conv.id);
        await supabase.from('support_conversation_events').insert({
          conversation_id: conv.id, event_type: 'assigned',
          actor_name: 'System (auto-route)', to_agent_id: winner, to_department_id: departmentId,
          reason: 'Auto-assigned on chat creation',
        });
      }
    }

    // Email notifications: guest acknowledgment + agent alerts.
    // Use EdgeRuntime.waitUntil so the runtime keeps the worker alive until the
    // dispatch finishes, without blocking the HTTP response to the caller.
    const dispatchEmails = (async () => {
      try {
        // 1) Confirmation to the guest
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'support-ticket-created',
            recipientEmail: email,
            idempotencyKey: `support-ticket-${conv.id}`,
            templateData: {
              name,
              subject: subject || 'Support request',
              department: dept?.name || 'Support',
              ticketId: conv.id.slice(0, 8).toUpperCase(),
            },
          },
        });

        // 2) Notify agents — assigned agent if any, else department / supervisors / all-active
        const { data: assignedConv } = await supabase
          .from('support_conversations')
          .select('assigned_agent_id')
          .eq('id', conv.id).maybeSingle();

        let agentEmails: string[] = [];
        if (assignedConv?.assigned_agent_id) {
          const { data: a } = await supabase
            .from('support_agents')
            .select('display_name, user_id')
            .eq('id', assignedConv.assigned_agent_id).maybeSingle();
          if (a?.user_id) {
            const { data: p } = await supabase.from('profiles').select('email').eq('id', a.user_id).maybeSingle();
            if (p?.email) agentEmails = [p.email];
          }
        } else {
          // Fallback chain mirrors notify_support_new_conversation
          const tryFetch = async (q: any) => {
            const { data } = await q;
            return (data || []).map((r: any) => r.user_id).filter(Boolean);
          };
          let userIds: string[] = departmentId
            ? await tryFetch(supabase.from('support_agent_departments')
                .select('agent:support_agents!inner(user_id, is_active)')
                .eq('department_id', departmentId)
                .then((res: any) => ({ data: (res.data || []).map((r: any) => r.agent).filter((a: any) => a?.is_active) })))
            : [];
          if (!userIds.length) {
            const { data } = await supabase.from('support_agents')
              .select('user_id').eq('is_active', true).eq('is_supervisor', true);
            userIds = (data || []).map((r: any) => r.user_id).filter(Boolean);
          }
          if (!userIds.length) {
            const { data } = await supabase.from('support_agents')
              .select('user_id').eq('is_active', true);
            userIds = (data || []).map((r: any) => r.user_id).filter(Boolean);
          }
          if (userIds.length) {
            const { data: profs } = await supabase
              .from('profiles').select('email').in('id', userIds);
            agentEmails = (profs || []).map((p: any) => p.email).filter(Boolean);
          }
        }

        for (const agentEmail of agentEmails) {
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'chat-assigned',
              recipientEmail: agentEmail,
              idempotencyKey: `support-agent-new-${conv.id}-${agentEmail}`,
              templateData: {
                customerName: name,
                subject: subject || 'New support chat',
                department: dept?.name || 'Support',
                ticketId: conv.id.slice(0, 8).toUpperCase(),
                messagePreview: initialMessage?.slice(0, 200) || '',
              },
            },
          });
        }
      } catch (e) {
        console.warn('support-start: email dispatch failed', e);
      }
    })();

    return json({
      conversation_id: conv.id,
      guest_token: conv.guest_token,
      department: dept ? { id: dept.id, name: dept.name } : null,
      sla: {
        online: isOnline,
        response_due_at: new Date(responseDue).toISOString(),
        escalation_due_at: new Date(escalationDue).toISOString(),
      },
    });
  } catch (e: any) {
    return json({ error: e?.message || 'Unexpected error' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
