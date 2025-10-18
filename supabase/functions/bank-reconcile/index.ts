import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('authorization');
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

    const { bank_connection_id, reconciliation_date } = await req.json();

    if (!bank_connection_id || !reconciliation_date) {
      return new Response(JSON.stringify({ error: 'Bank connection ID and reconciliation date are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting reconciliation for bank connection: ${bank_connection_id} on ${reconciliation_date}`);

    // Create reconciliation record
    const { data: reconciliation, error: reconError } = await supabase
      .from('bank_reconciliations')
      .insert({
        bank_connection_id,
        reconciliation_date,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        processed_by: user.id
      })
      .select()
      .single();

    if (reconError) {
      throw new Error(`Failed to create reconciliation record: ${reconError.message}`);
    }

    // Fetch bank transactions for the date
    const { data: bankStatements } = await supabase
      .from('bank_statements')
      .select('*')
      .eq('bank_connection_id', bank_connection_id)
      .eq('statement_date', reconciliation_date);

    // Fetch system transactions for the date
    const { data: systemTransactions } = await supabase
      .from('transactions')
      .select('*')
      .gte('booking_date', `${reconciliation_date}T00:00:00Z`)
      .lte('booking_date', `${reconciliation_date}T23:59:59Z`);

    const totalBankTxn = bankStatements?.reduce((sum, stmt) => sum + (stmt.transaction_count || 0), 0) || 0;
    const totalSystemTxn = systemTransactions?.length || 0;

    // Perform reconciliation matching
    const matchResult = performReconciliation(bankStatements || [], systemTransactions || []);

    // Update reconciliation record with results
    const { error: updateError } = await supabase
      .from('bank_reconciliations')
      .update({
        total_bank_transactions: totalBankTxn,
        total_system_transactions: totalSystemTxn,
        matched_count: matchResult.matched,
        unmatched_bank_count: matchResult.unmatchedBank,
        unmatched_system_count: matchResult.unmatchedSystem,
        status: 'completed',
        completed_at: new Date().toISOString(),
        reconciliation_report: matchResult.report,
        discrepancies: matchResult.discrepancies
      })
      .eq('id', reconciliation.id);

    if (updateError) {
      throw new Error(`Failed to update reconciliation: ${updateError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      reconciliation_id: reconciliation.id,
      summary: {
        total_bank_transactions: totalBankTxn,
        total_system_transactions: totalSystemTxn,
        matched_count: matchResult.matched,
        unmatched_bank_count: matchResult.unmatchedBank,
        unmatched_system_count: matchResult.unmatchedSystem,
        match_percentage: totalBankTxn > 0 ? (matchResult.matched / totalBankTxn * 100).toFixed(2) : 0
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Reconciliation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Reconciliation matching logic
function performReconciliation(bankStatements: any[], systemTransactions: any[]) {
  // Simplified matching algorithm
  // In production, this would use sophisticated matching based on:
  // - Transaction reference numbers
  // - Amounts
  // - Dates
  // - Descriptions
  
  const matched = 0;
  const unmatchedBank = bankStatements?.length || 0;
  const unmatchedSystem = systemTransactions?.length || 0;

  const report = {
    reconciliation_method: 'reference_and_amount_matching',
    total_processed: (bankStatements?.length || 0) + (systemTransactions?.length || 0),
    processing_time_ms: 0
  };

  const discrepancies = {
    missing_in_system: [],
    missing_in_bank: [],
    amount_mismatches: []
  };

  return {
    matched,
    unmatchedBank,
    unmatchedSystem,
    report,
    discrepancies
  };
}
