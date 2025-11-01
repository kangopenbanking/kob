import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting automated settlement processing...');

    // Get all institutions with KOB facilitation enabled
    const { data: institutions, error: instError } = await supabase
      .from('institutions')
      .select('*')
      .eq('use_kob_flutterwave', true)
      .eq('is_active', true);

    if (instError) {
      throw instError;
    }

    console.log(`Found ${institutions?.length || 0} institutions to process`);

    const results = [];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayOfMonth = today.getDate();

    for (const institution of institutions || []) {
      try {
        let shouldSettle = false;
        let periodStart: Date;
        let periodEnd: Date = new Date();

        // Determine if settlement should run based on frequency
        switch (institution.settlement_frequency) {
          case 'daily':
            shouldSettle = true;
            periodStart = new Date(today.setDate(today.getDate() - 1));
            break;
          
          case 'weekly':
            // Settle on Mondays (day 1)
            shouldSettle = dayOfWeek === 1;
            periodStart = new Date(today.setDate(today.getDate() - 7));
            break;
          
          case 'monthly':
            // Settle on the 1st of each month
            shouldSettle = dayOfMonth === 1;
            periodStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            periodEnd = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
          
          default:
            shouldSettle = false;
        }

        if (!shouldSettle) {
          console.log(`Skipping ${institution.institution_name} - not settlement day`);
          continue;
        }

        // Calculate settlement balance
        const { data: settlementData, error: calcError } = await supabase.rpc(
          'calculate_settlement_balance',
          {
            _institution_id: institution.id,
            _period_start: periodStart.toISOString(),
            _period_end: periodEnd.toISOString(),
          }
        );

        if (calcError) {
          console.error(`Failed to calculate for ${institution.institution_name}:`, calcError);
          results.push({
            institution_id: institution.id,
            institution_name: institution.institution_name,
            status: 'error',
            error: calcError.message,
          });
          continue;
        }

        const netAmount = settlementData.net_settlement_amount;

        // Check if meets minimum threshold
        if (netAmount < (institution.minimum_settlement_amount || 0)) {
          console.log(`${institution.institution_name}: Below minimum threshold (${netAmount} < ${institution.minimum_settlement_amount})`);
          results.push({
            institution_id: institution.id,
            institution_name: institution.institution_name,
            status: 'skipped',
            reason: 'below_minimum_threshold',
            net_amount: netAmount,
            minimum_required: institution.minimum_settlement_amount,
          });
          continue;
        }

        if (netAmount <= 0) {
          console.log(`${institution.institution_name}: No positive balance to settle`);
          results.push({
            institution_id: institution.id,
            institution_name: institution.institution_name,
            status: 'skipped',
            reason: 'no_positive_balance',
          });
          continue;
        }

        // Process settlement by calling settlement-process function
        const settlementResponse = await supabase.functions.invoke('settlement-process', {
          body: {
            institution_id: institution.id,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
          }
        });

        if (settlementResponse.error) {
          console.error(`Settlement failed for ${institution.institution_name}:`, settlementResponse.error);
          results.push({
            institution_id: institution.id,
            institution_name: institution.institution_name,
            status: 'error',
            error: settlementResponse.error.message,
          });
        } else {
          console.log(`Settlement processed for ${institution.institution_name}: ${netAmount}`);
          results.push({
            institution_id: institution.id,
            institution_name: institution.institution_name,
            status: 'success',
            settlement_ref: settlementResponse.data.settlement_ref,
            net_amount: netAmount,
          });
        }

      } catch (error) {
        console.error(`Error processing ${institution.institution_name}:`, error);
        results.push({
          institution_id: institution.id,
          institution_name: institution.institution_name,
          status: 'error',
          error: error.message,
        });
      }
    }

    console.log('Automated settlement processing completed');
    console.log('Results:', JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        processed_at: new Date().toISOString(),
        institutions_checked: institutions?.length || 0,
        results: results,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Automated settlement cron error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});