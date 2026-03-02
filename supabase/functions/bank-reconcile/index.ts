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
      .gte('booking_datetime', `${reconciliation_date}T00:00:00Z`)
      .lte('booking_datetime', `${reconciliation_date}T23:59:59Z`);

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

// Reconciliation matching logic with real algorithms
function performReconciliation(bankStatements: any[], systemTransactions: any[]) {
  const startTime = Date.now();
  
  let matched = 0;
  const unmatchedBank: any[] = [];
  const unmatchedSystem: any[] = [];
  const matchedPairs: any[] = [];
  const amountMismatches: any[] = [];

  // Create maps for efficient lookup
  const systemTxnMap = new Map();
  systemTransactions?.forEach(txn => {
    const key = txn.transaction_reference;
    if (!systemTxnMap.has(key)) {
      systemTxnMap.set(key, []);
    }
    systemTxnMap.get(key).push(txn);
  });

  const matchedSystemIds = new Set();

  // Match bank statements to system transactions
  bankStatements?.forEach(bankStmt => {
    let isMatched = false;

    // Method 1: Exact reference match
    if (bankStmt.transaction_ref) {
      const sysTxns = systemTxnMap.get(bankStmt.transaction_ref);
      if (sysTxns && sysTxns.length > 0) {
        const sysTxn = sysTxns.find((t: any) => !matchedSystemIds.has(t.id));
        if (sysTxn) {
          // Check amount match
          if (Math.abs(parseFloat(bankStmt.amount || 0) - parseFloat(sysTxn.amount || 0)) < 0.01) {
            matched++;
            matchedSystemIds.add(sysTxn.id);
            matchedPairs.push({ bank: bankStmt, system: sysTxn, method: 'exact_reference' });
            isMatched = true;
          } else {
            amountMismatches.push({
              bank_amount: bankStmt.amount,
              system_amount: sysTxn.amount,
              reference: bankStmt.transaction_ref,
            });
          }
        }
      }
    }

    // Method 2: Amount + Date matching (within 24 hours)
    if (!isMatched && bankStmt.transaction_date) {
      const bankDate = new Date(bankStmt.transaction_date);
      const bankAmount = parseFloat(bankStmt.amount || 0);

      for (const sysTxn of systemTransactions || []) {
        if (matchedSystemIds.has(sysTxn.id)) continue;

        const sysDate = new Date(sysTxn.booking_datetime);
        const sysAmount = parseFloat(sysTxn.amount || 0);
        
        // Check if within 24 hours and amount matches
        const timeDiff = Math.abs(bankDate.getTime() - sysDate.getTime());
        const hoursApart = timeDiff / (1000 * 60 * 60);
        
        if (hoursApart <= 24 && Math.abs(bankAmount - sysAmount) < 0.01) {
          matched++;
          matchedSystemIds.add(sysTxn.id);
          matchedPairs.push({ bank: bankStmt, system: sysTxn, method: 'amount_date_match' });
          isMatched = true;
          break;
        }
      }
    }

    // Method 3: Fuzzy description matching (Levenshtein distance)
    if (!isMatched && bankStmt.description) {
      const bankDesc = (bankStmt.description || '').toLowerCase();
      const bankAmount = parseFloat(bankStmt.amount || 0);

      for (const sysTxn of systemTransactions || []) {
        if (matchedSystemIds.has(sysTxn.id)) continue;

        const sysDesc = (sysTxn.transaction_information || '').toLowerCase();
        const sysAmount = parseFloat(sysTxn.amount || 0);
        
        // Calculate similarity (simple word overlap)
        const bankWords = new Set(bankDesc.split(/\s+/));
        const sysWords = new Set(sysDesc.split(/\s+/));
        const intersection = new Set([...bankWords].filter(x => sysWords.has(x)));
        const similarity = intersection.size / Math.max(bankWords.size, sysWords.size);
        
        // Match if high similarity and amount matches
        if (similarity > 0.6 && Math.abs(bankAmount - sysAmount) < 0.01) {
          matched++;
          matchedSystemIds.add(sysTxn.id);
          matchedPairs.push({ bank: bankStmt, system: sysTxn, method: 'fuzzy_description' });
          isMatched = true;
          break;
        }
      }
    }

    if (!isMatched) {
      unmatchedBank.push(bankStmt);
    }
  });

  // Find unmatched system transactions
  systemTransactions?.forEach(sysTxn => {
    if (!matchedSystemIds.has(sysTxn.id)) {
      unmatchedSystem.push(sysTxn);
    }
  });

  const processingTime = Date.now() - startTime;

  const report = {
    reconciliation_method: 'multi_method_matching',
    methods_used: ['exact_reference', 'amount_date_match', 'fuzzy_description'],
    total_processed: (bankStatements?.length || 0) + (systemTransactions?.length || 0),
    processing_time_ms: processingTime,
    matched_pairs: matchedPairs.length,
  };

  const discrepancies = {
    missing_in_system: unmatchedBank,
    missing_in_bank: unmatchedSystem,
    amount_mismatches: amountMismatches,
  };

  return {
    matched,
    unmatchedBank: unmatchedBank.length,
    unmatchedSystem: unmatchedSystem.length,
    report,
    discrepancies,
  };
}
