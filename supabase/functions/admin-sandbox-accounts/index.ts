import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const {
        account_holder_name,
        account_type,
        account_subtype,
        currency,
        initial_balance
      } = await req.json();

      // Generate unique account ID
      const account_id = `SAND${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const identification_value = `237${Math.floor(Math.random() * 900000000 + 100000000)}`;

      const adminSupabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: account, error } = await adminSupabase
        .from('sandbox_accounts')
        .insert({
          account_id,
          account_holder_name,
          account_type: account_type || 'Personal',
          account_subtype: account_subtype || 'Current',
          currency: currency || 'XAF',
          identification_value,
          identification_scheme: 'LOCAL_BANK',
          balance: initial_balance || 0,
          created_by: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log(`Sandbox account created: ${account_id} by ${user.email}`);

      return new Response(
        JSON.stringify(account),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET - List sandbox accounts
    const { data: accounts, error } = await supabase
      .from('sandbox_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify(accounts),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-sandbox-accounts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
