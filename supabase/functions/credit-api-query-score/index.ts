import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';
import { corsHeaders } from "../_shared/cors.ts";

async function getJwtKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('JWT_SECRET');
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify API token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.substring(7);

    // Verify JWT with cryptographic signature
    let clientData: any;
    try {
      const jwtKey = await getJwtKey();
      clientData = await verify(token, jwtKey);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { user_identifier, consent_reference, purpose = 'credit_assessment' } = body;

    // Validate user_identifier format to prevent injection
    if (!user_identifier || typeof user_identifier !== 'string') {
      return new Response(
        JSON.stringify({ error: 'user_identifier is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (user_identifier.length > 255 || !/^[a-zA-Z0-9@.+_\-]+$/.test(user_identifier)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user_identifier format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('API credit score query:', { client: clientData.client_id, user_identifier });

    // Check rate limits
    const { data: client } = await supabase
      .from('credit_api_clients')
      .select('*')
      .eq('id', clientData.client_id)
      .single();

    if (!client || !client.is_active) {
      return new Response(
        JSON.stringify({ error: 'API client not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if allowed operation
    if (!client.allowed_operations?.includes('score_query')) {
      return new Response(
        JSON.stringify({ error: 'Operation not allowed for this client' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by identifier using separate parameterized queries (prevents SQL injection)
    const { data: userByEmail } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', user_identifier)
      .limit(1);

    const { data: userByPhone } = !userByEmail?.length
      ? await supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('phone', user_identifier)
          .limit(1)
      : { data: null };

    const user = userByEmail?.[0] || userByPhone?.[0];
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch credit score
    const { data: scoreData } = await supabase.functions.invoke('credit-score-fetch', {
      body: { user_id: user.id, include_report: false }
    });

    if (!scoreData?.score) {
      return new Response(
        JSON.stringify({ error: 'Credit score not available for this user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log inquiry as hard inquiry
    const { data: inquiry } = await supabase.from('credit_inquiries').insert({
      user_id: user.id,
      inquiry_type: 'hard',
      inquirer_type: client.client_type,
      inquirer_name: client.client_name,
      inquirer_id: client.institution_id,
      purpose,
      user_consent_given: !!consent_reference,
      consent_reference,
      score_provided: scoreData.score,
    }).select().single();

    // Log API usage
    const billedAmount = client.cost_per_query || 0;
    await supabase.from('credit_api_usage_logs').insert({
      client_id: client.id,
      operation_type: 'score_query',
      user_id: user.id,
      request_payload: { user_identifier, purpose },
      response_status: 200,
      score_returned: scoreData.score,
      billed_amount: billedAmount,
    });

    // Update client total queries
    await supabase
      .from('credit_api_clients')
      .update({
        total_queries: (client.total_queries || 0) + 1,
        last_query_at: new Date().toISOString(),
      })
      .eq('id', client.id);

    // Create alert for user
    await supabase.from('credit_monitoring_alerts').insert({
      user_id: user.id,
      alert_type: 'new_inquiry',
      severity: 'info',
      title: 'Credit score accessed',
      description: `${client.client_name} accessed your credit score for ${purpose}`,
      alert_data: { inquiry_id: inquiry?.id, client_name: client.client_name, purpose },
    });

    console.log('Credit score query successful:', { score: scoreData.score, inquiry_id: inquiry?.id });

    return new Response(
      JSON.stringify({
        user_id: user.id,
        credit_score: scoreData.score,
        score_range: scoreData.score_range,
        calculated_at: scoreData.calculated_at,
        risk_category: getRiskCategory(scoreData.score),
        inquiry_id: inquiry?.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error querying credit score:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to query credit score' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getRiskCategory(score: number): string {
  if (score >= 740) return 'low';
  if (score >= 670) return 'medium';
  if (score >= 580) return 'medium-high';
  return 'high';
}
