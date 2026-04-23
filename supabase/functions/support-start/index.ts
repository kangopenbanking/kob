// Public endpoint — no auth required. Creates a guest support conversation.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isOnline(bh: { timezone: string; start_hour: number; end_hour: number; active_days: number[] }) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: bh.timezone || 'UTC',
      hour: 'numeric', hour12: false, weekday: 'short',
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

    if (!name || name.length > 120) return json({ error: 'Name is required.' }, 400);
    if (!EMAIL_RX.test(email) || email.length > 255) return json({ error: 'A valid email is required.' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: conv, error: cErr } = await supabase
      .from('support_conversations')
      .insert({ guest_name: name, guest_email: email, subject, source })
      .select('id, guest_token, last_message_at')
      .single();
    if (cErr || !conv) return json({ error: cErr?.message || 'Could not create conversation.' }, 500);

    if (initialMessage) {
      await supabase.from('support_messages').insert({
        conversation_id: conv.id, sender_type: 'guest', sender_name: name, content: initialMessage,
      });
    }

    // Determine if any agent is online and we're in business hours
    const [{ data: bh }, { data: agentsOnline }] = await Promise.all([
      supabase.from('support_business_hours').select('*').eq('id', 1).maybeSingle(),
      supabase.from('support_agents').select('id').eq('is_active', true)
        .gte('last_seen_at', new Date(Date.now() - 90_000).toISOString()),
    ]);
    const inHours = bh ? isOnline(bh as any) : false;
    const anyOnline = (agentsOnline?.length || 0) > 0;

    if (!inHours || !anyOnline) {
      const offlineMsg = bh?.offline_message ||
        'Thanks for reaching out! Our team responds within 15 minutes during business hours, and within 24 hours otherwise.';
      await supabase.from('support_messages').insert({
        conversation_id: conv.id, sender_type: 'system', sender_name: 'KOB Support', content: offlineMsg,
      });
    }

    return json({ conversation_id: conv.id, guest_token: conv.guest_token });
  } catch (e: any) {
    return json({ error: e?.message || 'Unexpected error' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
