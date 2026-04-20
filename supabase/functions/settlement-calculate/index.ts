import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate user (null-guarded — UK OB compliant)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ Code: '401', Message: 'Unauthorized', Errors: [{ ErrorCode: 'UK.OBIE.Unauthorized', Message: 'Missing or malformed Authorization header' }] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ Code: '401', Message: 'Unauthorized', Errors: [{ ErrorCode: 'UK.OBIE.Unauthorized', Message: 'Invalid or expired token' }] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { period_start, period_end } = await req.json();

    // Get institution details
    const { data: institution, error: instError } = await supabase
      .from('institutions')
      .select('id, institution_name, use_kob_flutterwave, minimum_settlement_amount')
      .eq('user_id', user.id)
      .single();

    if (instError || !institution) {
      throw new Error('Institution not found');
    }

    if (!institution.use_kob_flutterwave) {
      throw new Error('Institution not enabled for KOB facilitated payments');
    }

    // Calculate settlement balance
    const periodStart = period_start || new Date(new Date().setDate(1)).toISOString();
    const periodEnd = period_end || new Date().toISOString();

    const { data: settlementData, error: calcError } = await supabase.rpc(
      'calculate_settlement_balance',
      {
        _institution_id: institution.id,
        _period_start: periodStart,
        _period_end: periodEnd,
      }
    );

    if (calcError) {
      console.error('Settlement calculation error:', calcError);
      throw new Error('Failed to calculate settlement');
    }

    // Check if minimum threshold is met
    const meetsMinimum = settlementData.net_settlement_amount >= (institution.minimum_settlement_amount || 0);

    return new Response(
      JSON.stringify({
        success: true,
        institution_id: institution.id,
        institution_name: institution.institution_name,
        period_start: periodStart,
        period_end: periodEnd,
        ...settlementData,
        minimum_settlement_amount: institution.minimum_settlement_amount || 0,
        meets_minimum_threshold: meetsMinimum,
        can_settle: meetsMinimum && settlementData.net_settlement_amount > 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});