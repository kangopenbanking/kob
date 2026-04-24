// Public endpoint — guests post messages using their guest_token.
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
    const body = await req.json().catch(() => ({}));
    const guestToken = String(body.guest_token || '');
    const content = String(body.content || '').trim().slice(0, 4000);
    if (!guestToken || !content) return json({ error: 'guest_token and content are required.' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: conv } = await supabase
      .from('support_conversations')
      .select('id, status, guest_name, department_id')
      .eq('guest_token', guestToken)
      .maybeSingle();
    if (!conv) return json({ error: 'Conversation not found.' }, 404);
    if (conv.status === 'closed') return json({ error: 'This conversation is closed.' }, 409);

    await supabase.from('support_messages').insert({
      conversation_id: conv.id, sender_type: 'guest', sender_name: conv.guest_name, content,
    });

    const [{ data: bh }, { data: agentsOnline }, { data: lastSys }, { data: dept }] = await Promise.all([
      supabase.from('support_business_hours').select('*').eq('id', 1).maybeSingle(),
      supabase.from('support_agents').select('id').eq('is_active', true)
        .gte('last_seen_at', new Date(Date.now() - 90_000).toISOString()),
      supabase.from('support_messages').select('created_at')
        .eq('conversation_id', conv.id).eq('sender_type', 'system')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      conv.department_id
        ? supabase.from('support_departments').select('name, sla_online_minutes, sla_offline_hours').eq('id', conv.department_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const inHours = isInHours(bh);
    const anyOnline = (agentsOnline?.length || 0) > 0;
    const recentSystem = lastSys ? (Date.now() - new Date(lastSys.created_at).getTime()) < 30 * 60_000 : false;

    if ((!inHours || !anyOnline) && !recentSystem) {
      const slaOn = dept?.sla_online_minutes ?? 15;
      const slaOff = dept?.sla_offline_hours ?? 24;
      const offlineMsg = bh?.offline_message ||
        `Thanks for your message! Our ${dept?.name || 'support'} team responds within ${slaOn} minutes during business hours, and within ${slaOff} hours otherwise.`;
      await supabase.from('support_messages').insert({
        conversation_id: conv.id, sender_type: 'system', sender_name: 'KOB Support', content: offlineMsg,
      });
    }

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message || 'Unexpected error' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
