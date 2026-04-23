// Public endpoint — guest fetches their conversation + messages by guest_token.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const guestToken =
      url.searchParams.get('guest_token') ||
      (await req.json().catch(() => ({}))).guest_token;
    if (!guestToken) return json({ error: 'guest_token required.' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: conv } = await supabase
      .from('support_conversations')
      .select('id, guest_name, guest_email, subject, status, created_at, last_message_at')
      .eq('guest_token', guestToken)
      .maybeSingle();
    if (!conv) return json({ error: 'Not found' }, 404);

    const { data: messages } = await supabase
      .from('support_messages')
      .select('id, sender_type, sender_name, content, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });

    return json({ conversation: conv, messages: messages || [] });
  } catch (e: any) {
    return json({ error: e?.message || 'Unexpected error' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
