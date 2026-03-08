import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

import { corsHeaders } from "../_shared/cors.ts";

const POSTIQ_FALLBACK_URL = 'https://uuxlcrvlljzoufjzmzid.supabase.co/functions/v1';

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

    // Use the correct PostiQ API base URL - the env var may contain the wrong domain
    const envUrl = Deno.env.get('POSTIQ_BASE_URL');
    // Only use env var if it points to the correct Supabase-hosted API, not the HTML landing page
    const baseUrl = (envUrl && envUrl.includes('supabase.co')) ? envUrl : POSTIQ_FALLBACK_URL;
    const fullUrl = `${baseUrl}/api-create-postcode`;
    console.log('Calling PostiQ API at:', fullUrl);

    const postiqResponse = await fetch(fullUrl, {
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
    });

    const contentType = postiqResponse.headers.get('content-type') || '';
    console.log('PostiQ API response status:', postiqResponse.status);
    console.log('PostiQ API content-type:', contentType);

    const responseText = await postiqResponse.text();
    console.log('PostiQ API response (first 500 chars):', responseText.substring(0, 500));

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
      throw new Error(postiqData.error || postiqData.message || 'PostiQ API error');
    }

    if (!postiqData.success) {
      throw new Error(postiqData.error || 'Failed to create PostiQ code');
    }

    console.log('PostiQ code created:', postiqData.data.postiq_code);

    // Parse postiq_precision ("lat,lng") into separate values
    let parsedLat = latitude;
    let parsedLng = longitude;
    if (postiqData.data.postiq_precision) {
      const parts = postiqData.data.postiq_precision.split(',');
      if (parts.length === 2) {
        parsedLat = parseFloat(parts[0]);
        parsedLng = parseFloat(parts[1]);
      }
    }

    // Store verification in database
    const { data: verification, error: dbError } = await supabase
      .from('postiq_address_verifications')
      .insert({
        user_id: user.id,
        postiq_code: postiqData.data.postiq_code,
        latitude: parsedLat,
        longitude: parsedLng,
        precision: postiqData.data.postiq_precision || `${latitude},${longitude}`,
        full_address: postiqData.data.full_address,
        region: postiqData.data.region || addressDetails.region,
        district: postiqData.data.district || addressDetails.district,
        sector: postiqData.data.sector || addressDetails.sector,
        area_name: addressDetails.area_name,
        road_name: addressDetails.road_name,
        house_number: addressDetails.house_number?.toString(),
        verification_method: 'gps',
        credits_consumed: 1
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
      credits_consumed: 1,
      request_data: body,
      response_data: postiqData,
      ip_address: req.headers.get('x-forwarded-for') || null
    });

    // Emit credit event for PostiQ verification (event-sourced system)
    console.log('Emitting POSTIQ_VERIFIED credit event for user:', user.id);
    await supabase.from('credit_events').insert({
      user_id: user.id,
      event_type: 'POSTIQ_VERIFIED',
      event_time: new Date().toISOString(),
      value_numeric: 1,
      description: `PostiQ address verified: ${postiqData.data.postiq_code}`,
      metadata: {
        postiq_code: postiqData.data.postiq_code,
        full_address: postiqData.data.full_address,
        verification_id: verification.id,
      },
      source: 'postiq_service',
    });

    // Trigger event-sourced credit score recomputation
    let scoreResult = null;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const scoreRes = await fetch(`${supabaseUrl}/functions/v1/credit-score-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ user_id: user.id }),
      });
      scoreResult = await scoreRes.json();
    } catch (scoreError) {
      console.error('Error triggering score recomputation:', scoreError);
    }

    // Also update legacy system for backward compatibility
    try {
      await supabase.functions.invoke('credit-score-calculate', {
        body: { user_id: user.id, trigger_event: 'postiq_verification' }
      });
    } catch (legacyErr) {
      console.error('Legacy score calc failed (non-blocking):', legacyErr);
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
          latitude: parsedLat,
          longitude: parsedLng,
          credit_score_boost: 50,
          score_delta: scoreResult?.delta || 50,
          new_score: scoreResult?.score || null,
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
