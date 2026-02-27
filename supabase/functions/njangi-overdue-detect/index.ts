import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];

    const { data: overdue, error } = await supabase
      .from('njangi_contributions')
      .select('*, njangi_groups(name)')
      .eq('status', 'pending')
      .lt('due_date', today);

    if (error) throw error;

    let processed = 0;
    for (const contrib of (overdue || [])) {
      await supabase
        .from('njangi_contributions')
        .update({ status: 'missed' })
        .eq('id', contrib.id);

      await supabase.from('credit_events').insert({
        user_id: contrib.user_id,
        event_type: 'NJANGI_CONTRIBUTION_MISSED',
        value_numeric: contrib.amount,
        description: `Missed njangi contribution - ${contrib.njangi_groups?.name || 'Unknown'} cycle ${contrib.cycle_number}`,
        event_time: new Date().toISOString(),
      });

      try {
        await supabase.functions.invoke('credit-score-engine', {
          body: { user_id: contrib.user_id },
        });
      } catch (e) { console.error('Score recompute failed:', e); }

      processed++;
    }

    console.log(`njangi-overdue-detect: processed ${processed} missed contributions`);
    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
