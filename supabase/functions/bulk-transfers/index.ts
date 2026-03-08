import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { corsHeaders } from "../_shared/cors.ts";

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

        if (row.source_account === row.destination_account) {
          throw new Error('Cannot transfer to the same account');
        }

        const txCurrency = row.currency || 'XAF';

        // Verify source account belongs to user
        const { data: sourceAccount, error: accountError } = await supabase
          .from('accounts')
          .select('id, account_holder_name, user_id, institution_id')
          .eq('account_id', row.source_account)
          .eq('user_id', user.id)
          .single();

        if (accountError || !sourceAccount) {
          throw new Error('Invalid source account or unauthorized access');
        }

        // Verify destination account exists
        const { data: destAccount, error: destError } = await supabase
          .from('accounts')
          .select('id, account_holder_name, user_id, institution_id')
          .eq('account_id', row.destination_account)
          .eq('is_active', true)
          .single();

        if (destError || !destAccount) {
          throw new Error('Invalid destination account');
        }

        // Check source balance — try InterimAvailable then ClosingAvailable, filter by Credit indicator
        let sourceBalance: any = null;
        const { data: interimBal } = await supabase
          .from('account_balances')
          .select('id, amount, balance_type')
          .eq('account_id', sourceAccount.id)
          .eq('balance_type', 'InterimAvailable')
          .eq('credit_debit_indicator', 'Credit')
          .maybeSingle();

        if (interimBal) {
          sourceBalance = interimBal;
        } else {
          const { data: closingBal } = await supabase
            .from('account_balances')
            .select('id, amount, balance_type')
            .eq('account_id', sourceAccount.id)
            .eq('balance_type', 'ClosingAvailable')
            .eq('credit_debit_indicator', 'Credit')
            .maybeSingle();
          sourceBalance = closingBal;
        }

        if (!sourceBalance || parseFloat(sourceBalance.amount) < amount) {
          throw new Error('Insufficient funds');
        }

        // Create transaction reference
        const transactionRef = `BULK-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date().toISOString();

        // Determine transfer rail
        let transferRail = 'internal';
        if (sourceAccount.institution_id !== destAccount.institution_id) {
          transferRail = 'domestic_interbank';
        }

        // ═══ C2 FIX: Atomic transfer via PL/pgSQL with row locks ═══
        const { data: atomicResult, error: atomicError } = await supabase.rpc('execute_atomic_transfer', {
          _source_balance_id: sourceBalance.id,
          _dest_account_id: destAccount.id,
          _amount: amount,
          _currency: txCurrency,
        });

        if (atomicError) {
          throw new Error(atomicError.message?.includes('Insufficient funds') ? 'Insufficient funds' : 'Failed to process transfer');
        }

        // ═══ STEP 3: Create debit transaction (sender) ═══
        const txDescription = row.description || `Bulk transfer to ${destAccount.account_holder_name}`;
        await supabase
          .from('transactions')
          .insert({
            account_id: sourceAccount.id,
            institution_id: sourceAccount.institution_id || destAccount.institution_id || '00000000-0000-0000-0000-000000000000',
            user_id: user.id,
            amount: amount,
            currency: txCurrency,
            credit_debit_indicator: 'Debit',
            status: 'Booked',
            transaction_type: 'Transfer',
            booking_datetime: now,
            value_datetime: now,
            transaction_information: txDescription,
            merchant_details: {
              transaction_ref: transactionRef,
              destination_account: row.destination_account,
              destination_account_holder: destAccount.account_holder_name,
              transfer_type: transferRail,
              rail: transferRail,
              bulk_transfer: true,
            },
          });

        // ═══ STEP 4: Create credit transaction (receiver) ═══
        const creditDescription = row.description || `Received from ${sourceAccount.account_holder_name}`;
        await supabase
          .from('transactions')
          .insert({
            account_id: destAccount.id,
            institution_id: destAccount.institution_id || sourceAccount.institution_id || '00000000-0000-0000-0000-000000000000',
            user_id: destAccount.user_id,
            amount: amount,
            currency: txCurrency,
            credit_debit_indicator: 'Credit',
            status: 'Booked',
            transaction_type: 'Transfer',
            booking_datetime: now,
            value_datetime: now,
            transaction_information: creditDescription,
            merchant_details: {
              transaction_ref: `${transactionRef}-CR`,
              source_account: row.source_account,
              source_account_holder: sourceAccount.account_holder_name,
              transfer_type: transferRail,
              rail: transferRail,
              bulk_transfer: true,
            },
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
      .from('audit_logs')
      .insert({
        action_type: 'bulk_transfer_processed',
        entity_type: 'bulk_transfer',
        entity_id: user.id,
        performed_by: user.id,
        details: {
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

// M2 FIX: CSV Parser with proper quoting support
function parseCSV(csv: string): BulkTransferRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows: BulkTransferRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]).map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    rows.push(row as BulkTransferRow);
  }

  return rows;
}

// Parse a single CSV line respecting quoted fields
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
