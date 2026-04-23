// Public endpoint — guests post messages using their guest_token.
// Auto-injects an offline SLA reply if no agent is online or outside business hours.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isOnline(bh: { timezone: string; start_hour: number; end_hour: number; active_days: number[] }) {
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
    const guestToken = String(body.guest_token || '');
    const content = String(body.content || '').trim().slice(0, 4000);
    if (!guestToken || !content) return json({ error: 'guest_token and content are required.' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: conv } = await supabase
      .from('support_conversations')
      .select('id, status, guest_name, last_message_at')
      .eq('guest_token', guestToken)
      .maybeSingle();
    if (!conv) return json({ error: 'Conversation not found.' }, 404);
    if (conv.status === 'closed') return json({ error: 'This conversation is closed.' }, 409);

    await supabase.from('support_messages').insert({
      conversation_id: conv.id, sender_type: 'guest', sender_name: conv.guest_name, content,
    });

    // Check if we should auto-respond with the offline SLA notice.
    // Only send once per "quiet period" — skip if the most recent system msg is < 30min old.
    const [{ data: bh }, { data: agentsOnline }, { data: lastSys }] = await Promise.all([
      supabase.from('support_business_hours').select('*').eq('id', 1).maybeSingle(),
      supabase.from('support_agents').select('id').eq('is_active', true)
        .gte('last_seen_at', new Date(Date.now() - 90_000).toISOString()),
      supabase.from('support_messages').select('created_at')
        .eq('conversation_id', conv.id).eq('sender_type', 'system')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const inHours = bh ? isOnline(bh as any) : false;
    const anyOnline = (agentsOnline?.length || 0) > 0;
    const recentSystem = lastSys ? (Date.now() - new Date(lastSys.created_at).getTime()) < 30 * 60_000 : false;

    if ((!inHours || !anyOnline) && !recentSystem) {
      const offlineMsg = bh?.offline_message ||
        'Thanks for your message! Our team responds within 15 minutes during business hours, and within 24 hours otherwise.';
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
