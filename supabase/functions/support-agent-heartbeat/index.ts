// Authenticated — admin/agent calls this every 30s to mark themselves online.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: userData } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    const user = userData?.user;
    if (!user) return json({ error: 'Unauthorized' }, 401);

    // Only admins are agents
    const { data: hasAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!hasAdmin) return json({ error: 'Forbidden' }, 403);

    await supabase.from('support_agents').upsert(
      { user_id: user.id, last_seen_at: new Date().toISOString(), is_active: true },
      { onConflict: 'user_id' }
    );

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
