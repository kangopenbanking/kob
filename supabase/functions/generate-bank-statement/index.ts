import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { corsHeaders } from "../_shared/cors.ts";

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

    const { account_id, format, date_from, date_to } = await req.json();

    if (!account_id || !format || !date_from || !date_to) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating ${format} statement for account ${account_id}`);

    // Fetch transactions
    const { data: transactions, error: txnError } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', account_id)
      .gte('booking_datetime', date_from)
      .lte('booking_datetime', date_to)
      .order('booking_datetime', { ascending: true });

    if (txnError) throw txnError;

    // Fetch account details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*, account_balances(*)')
      .eq('id', account_id)
      .single();

    if (accountError) throw accountError;

    let statementContent: string;
    let contentType: string;

    switch (format.toLowerCase()) {
      case 'csv':
        statementContent = generateCSV(transactions, account);
        contentType = 'text/csv';
        break;
      
      case 'mt940':
        statementContent = generateMT940(transactions, account, date_from, date_to);
        contentType = 'text/plain';
        break;
      
      case 'json':
        statementContent = JSON.stringify({
          account: {
            account_id: account.account_id,
            account_holder_name: account.account_holder_name,
            currency: account.currency,
          },
          period: { from: date_from, to: date_to },
          transactions,
        }, null, 2);
        contentType = 'application/json';
        break;
      
      default:
        throw new Error('Unsupported format');
    }

    return new Response(statementContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="statement_${account_id}_${date_from}_${date_to}.${format}"`,
      },
    });

  } catch (error: any) {
    console.error('Statement generation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Generate CSV format
function generateCSV(transactions: any[], account: any): string {
  const header = 'Date,Reference,Description,Debit,Credit,Balance,Currency\n';
  
  const rows = transactions.map(txn => {
    const amount = parseFloat(txn.amount);
    const debit = txn.credit_debit_indicator === 'Debit' ? amount : '';
    const credit = txn.credit_debit_indicator === 'Credit' ? amount : '';
    
    return [
      txn.booking_datetime,
      txn.transaction_reference || txn.id,
      `"${txn.transaction_information || 'N/A'}"`,
      debit,
      credit,
      txn.balance_after?.amount || '',
      txn.currency,
    ].join(',');
  }).join('\n');

  return header + rows;
}

// Generate MT940 format
function generateMT940(transactions: any[], account: any, dateFrom: string, dateTo: string): string {
  const openingBalance = transactions[0]?.balance_after?.amount || 0;
  const closingBalance = transactions[transactions.length - 1]?.balance_after?.amount || 0;
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const yy = date.getFullYear().toString().slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return yy + mm + dd;
  };

  let mt940 = ':20:STMT' + Date.now() + '\n';
  mt940 += ':25:' + account.account_id + '\n';
  mt940 += ':28C:1/1\n';
  mt940 += ':60F:C' + formatDate(dateFrom) + account.currency + openingBalance.toFixed(2).replace('.', ',') + '\n';

  transactions.forEach(txn => {
    const valDate = formatDate(txn.booking_datetime);
    const bookDate = formatDate(txn.booking_datetime);
    const dcMark = txn.credit_debit_indicator === 'Debit' ? 'D' : 'C';
    const amount = parseFloat(txn.amount).toFixed(2).replace('.', ',');
    
    mt940 += ':61:' + valDate + bookDate + dcMark + amount + 'NTRF' + (txn.transaction_reference || '') + '\n';
    mt940 += ':86:' + (txn.transaction_information || 'Transaction') + '\n';
  });

  mt940 += ':62F:C' + formatDate(dateTo) + account.currency + closingBalance.toFixed(2).replace('.', ',') + '\n';
  mt940 += '-';

  return mt940;
}
