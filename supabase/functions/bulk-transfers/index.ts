import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkTransferRow {
  source_account: string;
  destination_account: string;
  amount: number;
  description?: string;
  currency?: string;
}

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

    const { csv_data } = await req.json();

    if (!csv_data) {
      return new Response(JSON.stringify({ error: 'CSV data is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing bulk transfers for user: ${user.id}`);

    // Parse CSV data
    const rows = parseCSV(csv_data);
    const totalRows = rows.length;

    const results = {
      total: totalRows,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string; data: any }>,
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Validate row data
        if (!row.source_account || !row.destination_account || !row.amount) {
          throw new Error('Missing required fields: source_account, destination_account, or amount');
        }

        const amount = parseFloat(row.amount.toString());
        if (isNaN(amount) || amount <= 0) {
          throw new Error('Invalid amount');
        }

        // Verify source account belongs to user
        const { data: sourceAccount, error: accountError } = await supabase
          .from('accounts')
          .select('id')
          .eq('account_id', row.source_account)
          .eq('user_id', user.id)
          .single();

        if (accountError || !sourceAccount) {
          throw new Error('Invalid source account or unauthorized access');
        }

        // Verify destination account exists
        const { data: destAccount, error: destError } = await supabase
          .from('accounts')
          .select('id')
          .eq('account_id', row.destination_account)
          .single();

        if (destError || !destAccount) {
          throw new Error('Invalid destination account');
        }

        // Check balance
        const { data: balance } = await supabase
          .from('account_balances')
          .select('amount')
          .eq('account_id', sourceAccount.id)
          .eq('balance_type', 'InterimAvailable')
          .single();

        if (!balance || parseFloat(balance.amount) < amount) {
          throw new Error('Insufficient funds');
        }

        // Create transaction reference
        const transactionRef = `TXN-${Date.now()}-${i}`;

        // Create transaction record
        const { error: txnError } = await supabase
          .from('transactions')
          .insert({
            account_id: sourceAccount.id,
            institution_id: sourceAccount.institution_id || '00000000-0000-0000-0000-000000000000',
            user_id: user.id,
            amount: amount,
            currency: row.currency || 'XAF',
            credit_debit_indicator: 'Debit',
            status: 'Booked',
            transaction_type: 'Transfer',
            booking_datetime: new Date().toISOString(),
            value_datetime: new Date().toISOString(),
            transaction_information: row.description || `Bulk transfer to ${row.destination_account}`,
            merchant_details: {
              transaction_ref: transactionRef,
              destination_account: row.destination_account,
            },
          });

        if (txnError) {
          throw new Error(`Failed to create transaction: ${txnError.message}`);
        }

        // Update source balance
        await supabase.rpc('update_account_balance', {
          p_account_id: sourceAccount.id,
          p_amount: -amount,
        });

        results.successful++;
        console.log(`Row ${i + 1}: Transfer successful - ${transactionRef}`);

      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error.message,
          data: row,
        });
        console.error(`Row ${i + 1}: Transfer failed -`, error.message);
      }
    }

    // Log bulk operation
    await supabase
      .from('security_audit_logs')
      .insert({
        user_id: user.id,
        event_type: 'bulk_transfer_processed',
        event_category: 'transaction',
        metadata: {
          total_rows: totalRows,
          successful: results.successful,
          failed: results.failed,
        },
      });

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Bulk transfer error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// CSV Parser
function parseCSV(csv: string): BulkTransferRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: BulkTransferRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    rows.push(row as BulkTransferRow);
  }

  return rows;
}
