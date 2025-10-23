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

    const { full_name, date_of_birth, nationality, document_number } = await req.json();

    // Screen against sanctions lists
    // In production, integrate with:
    // 1. OFAC SDN List (US): https://sanctionslistservice.ofac.treas.gov/
    // 2. EU Consolidated List: https://webgate.ec.europa.eu/fsd/fsf
    // 3. UN Security Council List: https://www.un.org/securitycouncil/sanctions/
    // 4. Commercial APIs: ComplyAdvantage, Refinitiv World-Check
    
    const screeningResult = await screenAgainstLists(full_name, date_of_birth, nationality);
    
    // Insert screening record
    const { data: screening, error: screeningError } = await supabase
      .from('sanctions_screening')
      .insert({
        user_id: user.id,
        screening_type: 'automated',
        screening_status: screeningResult.status,
        screening_date: new Date().toISOString(),
        lists_checked: ['OFAC', 'EU', 'UN'],
        match_score: screeningResult.score,
        matched_entities: screeningResult.matches,
        requires_manual_review: screeningResult.score > 70
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
        requires_review: screening.requires_manual_review,
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
