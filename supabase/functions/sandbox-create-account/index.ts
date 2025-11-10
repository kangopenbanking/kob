import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { company_name, website, description } = await req.json();

    // Check if user already has a sandbox account
    const { data: existing } = await supabase
      .from('developer_sandbox_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Sandbox account already exists' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create sandbox account
    const { data: account, error: createError } = await supabase
      .from('developer_sandbox_accounts')
      .insert([{
        user_id: user.id,
        company_name,
        website,
        description,
        status: 'active', // Auto-approve for now
        tier: 'free',
      }])
      .select()
      .single();

    if (createError) throw createError;

    console.log('Created sandbox account:', account.id);

    return new Response(JSON.stringify({ account }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (error) {
    console.error('Error creating sandbox account:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create sandbox account',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});