import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POSTIQ_FALLBACK_URL = 'https://uuxlcrvlljzoufjzmzid.supabase.co/functions/v1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { postiq_code } = await req.json();

    if (!postiq_code) {
      return new Response(
        JSON.stringify({ error: 'PostiQ code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Looking up PostiQ code:', postiq_code);

    const baseUrl = Deno.env.get('POSTIQ_BASE_URL') || POSTIQ_FALLBACK_URL;
    const fullUrl = `${baseUrl}/api-lookup-postcode`;
    console.log('Calling PostiQ API at:', fullUrl);

    const postiqResponse = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': Deno.env.get('POSTIQ_API_KEY')!,
        'X-API-Secret': Deno.env.get('POSTIQ_API_SECRET')!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ postiq_code })
    });

    const responseText = await postiqResponse.text();
    console.log('PostiQ API response status:', postiqResponse.status);

    // Guard against HTML responses
    if (responseText.trim().toLowerCase().startsWith('<!doctype') || 
        responseText.trim().startsWith('<html')) {
      console.error('PostiQ API returned HTML instead of JSON');
      throw new Error('PostiQ API error: Service returned HTML instead of JSON. The API might be down or authentication failed.');
    }

    let postiqData;
    try {
      postiqData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse PostiQ response as JSON:', parseError);
      throw new Error(`Invalid JSON response from PostiQ API: ${responseText.substring(0, 200)}`);
    }

    if (!postiqResponse.ok) {
      console.error('PostiQ API error:', postiqResponse.status, postiqData);
      throw new Error(postiqData.error || 'PostiQ API error');
    }

    if (!postiqData.success) {
      throw new Error(postiqData.error || 'Failed to lookup PostiQ code');
    }

    // Log API usage
    await supabase.from('postiq_api_usage').insert({
      user_id: user.id,
      endpoint: '/api-lookup-postcode',
      method: 'POST',
      status_code: postiqResponse.status,
      credits_consumed: 1,
      request_data: { postiq_code },
      response_data: postiqData,
      ip_address: req.headers.get('x-forwarded-for') || null
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: postiqData.data
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error looking up PostiQ code:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to lookup PostiQ code', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
