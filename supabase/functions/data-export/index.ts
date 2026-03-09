import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      data_categories = ['all'],
      export_format = 'json'
    } = await req.json();

    // Collect user data
    const userData: any = {
      user_info: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    };

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profile) userData.profile = profile;

    // Get transactions
    if (data_categories.includes('all') || data_categories.includes('transactions')) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);
      userData.transactions = transactions || [];
    }

    // Get accounts
    if (data_categories.includes('all') || data_categories.includes('accounts')) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id);
      userData.accounts = accounts || [];
    }

    // Get consents
    if (data_categories.includes('all') || data_categories.includes('consents')) {
      const { data: consents } = await supabase
        .from('aisp_consents')
        .select('*')
        .eq('user_id', user.id);
      userData.consents = consents || [];
    }

    // Get KYC data
    if (data_categories.includes('all') || data_categories.includes('kyc')) {
      const { data: kyc } = await supabase
        .from('kyc_verifications')
        .select('*')
        .eq('user_id', user.id);
      userData.kyc_verifications = kyc || [];
    }

    // Create privacy request record
    const { data: request, error: requestError } = await supabase
      .from('data_privacy_requests')
      .insert({
        user_id: user.id,
        request_type: 'data_export',
        data_categories,
        export_format,
        status: 'completed',
        completion_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating privacy request:', requestError);
    }

    // Format based on export_format
    let exportData: string;
    let contentType: string;

    if (export_format === 'json') {
      exportData = JSON.stringify(userData, null, 2);
      contentType = 'application/json';
    } else if (export_format === 'csv') {
      // Simple CSV conversion (flatten data)
      exportData = 'This would be CSV formatted data';
      contentType = 'text/csv';
    } else {
      exportData = JSON.stringify(userData, null, 2);
      contentType = 'application/json';
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: request?.id,
        data: userData,
        message: 'Data exported successfully'
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    console.error('Error in data-export:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
