import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

const FINAL_STATUSES = ['succeeded', 'failed', 'cancelled', 'expired'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authError } = await supabase.auth.getUser(token);
    if (authError || !claims?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { id, account_id } = body;

    if (!id) return new Response(JSON.stringify({ error: 'missing_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: intent } = await supabase.from('funding_intents').select('*').eq('id', id).eq('user_id', claims.user.id).single();
    if (!intent) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (FINAL_STATUSES.includes(intent.status)) {
      return new Response(JSON.stringify({ error: 'already_final', message: `Intent is already ${intent.status}` }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await supabase.from('funding_intents').update({ status: 'cancelled' }).eq('id', id);
    await supabase.from('funding_events').insert({
      funding_intent_id: id, event_type: 'cancelled', payload: { previous_status: intent.status },
    });

    return new Response(JSON.stringify({ id, status: 'cancelled' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Cancel funding intent error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
