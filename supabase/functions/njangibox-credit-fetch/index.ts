import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

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
    const njangiboxApiKey = Deno.env.get('NJANGIBOX_API_KEY');
    const njangiboxApiSecret = Deno.env.get('NJANGIBOX_API_SECRET');
    const njangiboxBaseUrl = Deno.env.get('NJANGIBOX_BASE_URL') || 'https://njangibox.com/api/v1/ccs';

    if (!njangiboxApiKey || !njangiboxApiSecret) {
      return new Response(
        JSON.stringify({ error: 'NjangiBox API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { user_id, fetch_type = 'score' } = body;

    console.log('Fetching external credit data from NjangiBox for user:', user_id);

    // Check cache first
    const { data: cachedData } = await supabase
      .from('external_credit_data_cache')
      .select('*')
      .eq('user_id', user_id)
      .eq('bureau_name', 'njangibox')
      .eq('data_type', fetch_type)
      .eq('is_stale', false)
      .gte('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (cachedData) {
      console.log('Returning cached NjangiBox data');
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          external_score: cachedData.parsed_data?.score,
          bureau_name: 'njangibox',
          report_data: cachedData.parsed_data,
          fetched_at: cachedData.fetched_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's verified identity data
    const { data: kycData } = await supabase
      .from('kyc_verifications')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'approved')
      .single();

    if (!kycData) {
      throw new Error('User KYC verification required for external credit check');
    }

    // Call NjangiBox API
    const njangiboxResponse = await fetch(`${njangiboxBaseUrl}/check`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${njangiboxApiKey}`,
        'Content-Type': 'application/json',
        'X-API-Secret': njangiboxApiSecret,
      },
      body: JSON.stringify({
        national_id: kycData.id_number,
        full_name: kycData.full_name,
        date_of_birth: kycData.date_of_birth,
        phone_number: kycData.phone_number,
        purpose: 'credit_assessment',
        request_type: fetch_type,
      }),
    });

    if (!njangiboxResponse.ok) {
      const errorText = await njangiboxResponse.text();
      console.error('NjangiBox API error:', errorText);
      throw new Error(`NjangiBox API request failed: ${njangiboxResponse.status}`);
    }

    const externalData = await njangiboxResponse.json();

    // Parse and normalize the response
    const parsedData = {
      score: externalData.credit_score || externalData.score,
      report_summary: externalData.report_summary,
      risk_category: externalData.risk_category,
      bureau_reference: externalData.reference_id,
    };

    // Cache the result (expires in 30 days)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await supabase.from('external_credit_data_cache').insert({
      user_id,
      bureau_name: 'njangibox',
      data_type: fetch_type,
      raw_data: externalData,
      parsed_data: parsedData,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      is_stale: false,
    });

    console.log('NjangiBox data fetched and cached successfully');

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        external_score: parsedData.score,
        bureau_name: 'njangibox',
        report_data: parsedData,
        fetched_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching NjangiBox credit data:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to fetch external credit data', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
