import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error('Unauthorized');

    const { name, contribution_amount, frequency, payout_method, late_interest_rate, max_members, institution_id } = await req.json();
    if (!name || !contribution_amount) throw new Error('name and contribution_amount required');

    const { data: group, error: groupErr } = await supabase
      .from('njangi_groups')
      .insert({
        name,
        institution_id: institution_id || null,
        creator_id: user.id,
        contribution_amount,
        frequency: frequency || 'monthly',
        payout_method: payout_method || 'random',
        late_interest_rate: late_interest_rate || 0,
        max_members: max_members || 5,
        status: 'forming',
        current_cycle: 1,
      })
      .select()
      .single();

    if (groupErr) throw groupErr;

    // Creator auto-joins
    await supabase.from('njangi_members').insert({
      group_id: group.id,
      user_id: user.id,
      status: 'active',
    });

    return new Response(JSON.stringify({ group }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('njangi-create error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
