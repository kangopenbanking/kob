// Public endpoint — guest fetches their conversation + messages by guest_token.
// Returns availability and SLA snapshot for the assigned department.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isInHours(bh: any) {
  if (!bh) return false;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: bh.timezone || 'UTC', hour: 'numeric', hour12: false, weekday: 'short',
    });
    const parts = fmt.formatToParts(new Date());
    const hour = parseInt(parts.find((p: any) => p.type === 'hour')?.value || '0', 10);
    const wkMap: Record<string, number> = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6, Sun:7 };
    const wk = wkMap[parts.find((p: any) => p.type === 'weekday')?.value || ''] || 0;
    return bh.active_days.includes(wk) && hour >= bh.start_hour && hour < bh.end_hour;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const guestToken = url.searchParams.get('guest_token') || body.guest_token || '';
    const statusOnly = url.searchParams.get('status_only') === '1' || body.status_only === true;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const [{ data: bh }, { data: agentsOnline }] = await Promise.all([
      supabase.from('support_business_hours').select('*').eq('id', 1).maybeSingle(),
      supabase.from('support_agents').select('id').eq('is_active', true)
        .gte('last_seen_at', new Date(Date.now() - 90_000).toISOString()),
    ]);
    const inHours = isInHours(bh);
    const anyOnline = (agentsOnline?.length || 0) > 0;
    const availability = {
      online: inHours && anyOnline,
      in_business_hours: inHours,
      agents_available: anyOnline,
      sla_online_minutes: 15,
      sla_offline_hours: 24,
    };

    if (statusOnly) return json({ availability });
    if (!guestToken) return json({ error: 'guest_token required.' }, 400);

    const { data: conv } = await supabase
      .from('support_conversations')
      .select('id, guest_name, guest_email, subject, status, created_at, last_message_at, department_id, priority, assigned_agent_id, sla_response_due_at, sla_escalation_due_at, escalated_at, first_response_at')
      .eq('guest_token', guestToken)
      .maybeSingle();
    if (!conv) return json({ error: 'Not found' }, 404);

    const [{ data: messages }, { data: dept }] = await Promise.all([
      supabase.from('support_messages')
        .select('id, sender_type, sender_name, content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true }),
      conv.department_id
        ? supabase.from('support_departments').select('id, name, sla_online_minutes, sla_offline_hours').eq('id', conv.department_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return json({
      conversation: conv,
      messages: messages || [],
      department: dept || null,
      availability,
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
