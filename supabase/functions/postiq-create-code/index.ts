import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreatePostiQRequest {
  latitude: number;
  longitude: number;
  precision?: 'exact' | 'approximate';
  region?: string;
  district?: string;
  sector?: string;
  area_name?: string;
  road_name?: string;
  house_number?: number | string;
}

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

    // Check rate limit (5 verifications per day)
    const { data: rateLimitCheck } = await supabase.rpc('check_postiq_rate_limit', {
      p_user_id: user.id
    });

    if (!rateLimitCheck) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          details: 'Maximum 5 PostiQ verifications per day'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreatePostiQRequest = await req.json();
    const { latitude, longitude, precision = 'exact', ...addressDetails } = body;

    // Validate coordinates
    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: 'Latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return new Response(
        JSON.stringify({ error: 'Invalid coordinates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating PostiQ code for coordinates:', { latitude, longitude });

    // Call PostiQ API
    const postiqResponse = await fetch(
      `${Deno.env.get('POSTIQ_BASE_URL')}/api-create-postcode`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': Deno.env.get('POSTIQ_API_KEY')!,
          'X-API-Secret': Deno.env.get('POSTIQ_API_SECRET')!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          latitude,
          longitude,
          precision,
          ...addressDetails
        })
      }
    );

    // Check content type before parsing
    const contentType = postiqResponse.headers.get('content-type') || '';
    console.log('PostiQ API response status:', postiqResponse.status);
    console.log('PostiQ API content-type:', contentType);

    // Read response as text first
    const responseText = await postiqResponse.text();
    console.log('PostiQ API response (first 500 chars):', responseText.substring(0, 500));

    // Check if response is HTML (error page)
    if (responseText.trim().toLowerCase().startsWith('<!doctype') || 
        responseText.trim().startsWith('<html')) {
      console.error('PostiQ API returned HTML instead of JSON');
      throw new Error('PostiQ API error: Service returned HTML instead of JSON. The API might be down or authentication failed.');
    }

    // Try to parse as JSON
    let postiqData;
    try {
      postiqData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse PostiQ response as JSON:', parseError);
      throw new Error(`Invalid JSON response from PostiQ API: ${responseText.substring(0, 200)}`);
    }

    if (!postiqResponse.ok) {
      console.error('PostiQ API error:', postiqResponse.status, postiqData);
      throw new Error(postiqData.error || postiqData.message || 'PostiQ API error');
    }

    if (!postiqData.success) {
      throw new Error(postiqData.error || 'Failed to create PostiQ code');
    }

    console.log('PostiQ code created:', postiqData.data.postiq_code);

    // Store verification in database
    const { data: verification, error: dbError } = await supabase
      .from('postiq_address_verifications')
      .insert({
        user_id: user.id,
        postiq_code: postiqData.data.postiq_code,
        latitude: postiqData.data.latitude,
        longitude: postiqData.data.longitude,
        precision: postiqData.data.precision,
        full_address: postiqData.data.full_address,
        region: addressDetails.region,
        district: addressDetails.district,
        sector: addressDetails.sector,
        area_name: addressDetails.area_name,
        road_name: addressDetails.road_name,
        house_number: addressDetails.house_number?.toString(),
        verification_method: 'gps',
        credits_consumed: postiqData.credits_consumed || 1
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    // Log API usage
    await supabase.from('postiq_api_usage').insert({
      user_id: user.id,
      endpoint: '/api-create-postcode',
      method: 'POST',
      status_code: postiqResponse.status,
      credits_consumed: postiqData.credits_consumed || 1,
      request_data: body,
      response_data: postiqData,
      ip_address: req.headers.get('x-forwarded-for') || null
    });

    // Trigger credit score recalculation
    console.log('Triggering credit score recalculation for user:', user.id);
    const { error: scoreError } = await supabase.functions.invoke('credit-score-calculate', {
      body: { 
        user_id: user.id,
        trigger_event: 'postiq_verification'
      }
    });

    if (scoreError) {
      console.error('Error triggering score recalculation:', scoreError);
    }

    // Create audit log
    await supabase.rpc('log_audit_event', {
      _action_type: 'postiq_verification',
      _entity_type: 'address',
      _entity_id: verification.id,
      _details: {
        postiq_code: postiqData.data.postiq_code,
        address: postiqData.data.full_address
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          verification_id: verification.id,
          postiq_code: postiqData.data.postiq_code,
          full_address: postiqData.data.full_address,
          latitude: postiqData.data.latitude,
          longitude: postiqData.data.longitude,
          credit_score_boost: 50,
          message: 'Address verified successfully! Your credit score will increase by 50 points.'
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating PostiQ code:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to create PostiQ code', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
