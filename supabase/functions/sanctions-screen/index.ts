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

    const { full_name, date_of_birth, nationality, document_number, entity_type } = await req.json();

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'full_name is required (min 2 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const screeningResult = await screenAgainstLists(full_name, date_of_birth, nationality);

    // Insert screening record (schema-aligned)
    const { data: screening, error: screeningError } = await supabase
      .from('sanctions_screening')
      .insert({
        user_id: user.id,
        entity_type: entity_type || 'individual',
        entity_name: full_name,
        entity_data: { date_of_birth: date_of_birth || null, nationality: nationality || null, document_number: document_number || null },
        screening_status: screeningResult.status,
        screening_provider: 'internal_demo',
        screened_lists: ['OFAC', 'EU', 'UN'],
        match_score: screeningResult.score,
        matches: screeningResult.matches,
        next_screening_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (screeningError) {
      console.error('Error creating sanctions screening:', screeningError);
      return new Response(
        JSON.stringify({ error: 'Failed to create screening record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If high-risk, create alert
    if (screeningResult.status !== 'clear') {
      await supabase.from('transaction_monitoring_alerts').insert({
        alert_type: 'sanctions_screening',
        severity: screeningResult.score > 90 ? 'critical' : 'high',
        description: `Potential sanctions match detected for user ${user.id}`,
        metadata: { 
          screening_id: screening.id, 
          matches: screeningResult.matches,
          full_name,
          nationality 
        },
        status: 'open'
      });
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      _user_id: user.id,
      _event_type: 'sanctions_screening',
      _event_category: 'compliance',
      _metadata: { 
        screening_id: screening.id, 
        status: screeningResult.status,
        score: screeningResult.score 
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        screening_id: screening.id,
        status: screeningResult.status,
        requires_review: screeningResult.score > 70,
        match_score: screeningResult.score
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in sanctions-screen:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function screenAgainstLists(
  name: string, 
  dob: string, 
  nationality: string
): Promise<{ status: string; score: number; matches: any[] }> {
  // Simplified implementation for demonstration
  // In production: Call real sanctions screening APIs
  
  // Hardcoded high-risk names for demonstration
  const highRiskNames = [
    'VLADIMIR PUTIN',
    'KIM JONG UN',
    'BASHAR AL-ASSAD',
    // Add more sanctioned entities as needed
  ];
  
  const nameLower = name.toLowerCase();
  const nameUpper = name.toUpperCase();
  
  // Check for exact or fuzzy matches
  const hasMatch = highRiskNames.some(risk => {
    const riskLower = risk.toLowerCase();
    // Simple contains check - production should use fuzzy matching
    return nameUpper.includes(risk) || nameLower.includes(riskLower);
  });
  
  // Calculate match score (0-100)
  let score = 0;
  const matches: any[] = [];
  
  if (hasMatch) {
    score = 95; // High confidence match
    matches.push({
      name: 'Sanctioned Entity',
      list: 'OFAC',
      match_type: 'name',
      confidence: 95
    });
  }
  
  // Additional risk factors
  const highRiskCountries = ['KP', 'IR', 'SY']; // North Korea, Iran, Syria
  if (highRiskCountries.includes(nationality)) {
    score += 20;
    matches.push({
      reason: 'High-risk jurisdiction',
      country: nationality,
      confidence: 70
    });
  }
  
  // Determine status based on score
  let status: string;
  if (score === 0) {
    status = 'clear';
  } else if (score < 70) {
    status = 'potential_match';
  } else {
    status = 'confirmed_match';
  }
  
  return {
    status,
    score: Math.min(score, 100),
    matches
  };
}
