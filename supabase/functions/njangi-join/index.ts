import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

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

    const { group_id } = await req.json();
    if (!group_id) throw new Error('group_id required');

    // Check group exists and has room
    const { data: group } = await supabase
      .from('njangi_groups')
      .select('*, njangi_members(count)')
      .eq('id', group_id)
      .single();

    if (!group) throw new Error('Group not found');
    if (group.status !== 'forming' && group.status !== 'active') throw new Error('Group is not accepting members');

    const memberCount = group.njangi_members?.[0]?.count || 0;
    if (memberCount >= group.max_members) throw new Error('Group is full');

    // Check not already a member
    const { data: existing } = await supabase
      .from('njangi_members')
      .select('id')
      .eq('group_id', group_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) throw new Error('Already a member');

    const { data: member, error: memberErr } = await supabase
      .from('njangi_members')
      .insert({ group_id, user_id: user.id, status: 'active' })
      .select()
      .single();

    if (memberErr) throw memberErr;

    return new Response(JSON.stringify({ member }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
