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

    const { bank_connection_id, file_name, file_data, file_type } = await req.json();

    if (!bank_connection_id || !file_data) {
      return new Response(JSON.stringify({ error: 'Bank connection ID and file data are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing bank transaction import for ${file_name}`);

    // Create import log record
    const { data: importLog, error: logError } = await supabase
      .from('bank_transaction_imports')
      .insert({
        bank_connection_id,
        file_name: file_name || 'manual_import',
        file_type: file_type || 'CSV',
        file_size: JSON.stringify(file_data).length,
        status: 'processing',
        imported_by: user.id,
        import_data: { raw_data: file_data }
      })
      .select()
      .single();

    if (logError) {
      throw new Error(`Failed to create import log: ${logError.message}`);
    }

    // Parse and process file based on type
    const processResult = await processTransactionFile(file_data, file_type, supabase, user.id);

    // Update import log with results
    await supabase
      .from('bank_transaction_imports')
      .update({
        total_records: processResult.totalRecords,
        successful_imports: processResult.successCount,
        failed_imports: processResult.failureCount,
        duplicate_records: processResult.duplicateCount,
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_details: processResult.errors
      })
      .eq('id', importLog.id);

    return new Response(JSON.stringify({
      success: true,
      import_id: importLog.id,
      summary: {
        total_records: processResult.totalRecords,
        successful_imports: processResult.successCount,
        failed_imports: processResult.failureCount,
        duplicate_records: processResult.duplicateCount
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Process transaction file based on format
async function processTransactionFile(fileData: any, fileType: string, supabase: any, userId: string) {
  let totalRecords = 0;
  let successCount = 0;
  let failureCount = 0;
  let duplicateCount = 0;
  const errors: any[] = [];

  try {
    let transactions: any[] = [];

    // Parse based on file type
    switch (fileType) {
      case 'CSV':
        transactions = parseCSV(fileData);
        break;
      case 'MT940':
        transactions = parseMT940(fileData);
        break;
      case 'CAMT053':
        transactions = parseCAMT053(fileData);
        break;
      case 'JSON':
        transactions = Array.isArray(fileData) ? fileData : [fileData];
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    totalRecords = transactions.length;

    // Process each transaction
    for (const txn of transactions) {
      try {
        // Check for duplicates
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('transaction_id', txn.transaction_id)
          .single();

        if (existing) {
          duplicateCount++;
          continue;
        }

        // Insert transaction
        const { error: insertError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            account_id: txn.account_id,
            institution_id: txn.institution_id || '00000000-0000-0000-0000-000000000000',
            credit_debit_indicator: txn.credit_debit_indicator,
            status: txn.status || 'Booked',
            transaction_type: txn.transaction_type || 'import',
            booking_datetime: txn.booking_date,
            value_datetime: txn.value_date,
            amount: txn.amount,
            currency: txn.currency || 'XAF',
            transaction_information: txn.description,
            merchant_details: { transaction_ref: txn.transaction_id },
          });

        if (insertError) {
          failureCount++;
          errors.push({ transaction: txn.transaction_id, error: insertError.message });
        } else {
          successCount++;
        }
      } catch (error: any) {
        failureCount++;
        errors.push({ transaction: txn.transaction_id || 'unknown', error: error.message });
      }
    }

  } catch (error: any) {
    throw new Error(`File processing failed: ${error.message}`);
  }

  return {
    totalRecords,
    successCount,
    failureCount,
    duplicateCount,
    errors: errors.length > 0 ? errors : null
  };
}

// CSV parser
function parseCSV(data: string): any[] {
  // Simple CSV parsing - in production use a robust CSV parser
  const lines = data.split('\n');
  const headers = lines[0].split(',');
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',');
    const txn: any = {};
    
    headers.forEach((header, index) => {
      txn[header.trim()] = values[index]?.trim();
    });
    
    transactions.push(txn);
  }

  return transactions;
}

// MT940 Parser
function parseMT940(data: string): any[] {
  const transactions: any[] = [];
  const lines = data.split('\n').map(line => line.trim());
  
  let currentTransaction: any = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Transaction line :61:
    if (line.startsWith(':61:')) {
      if (currentTransaction.reference) {
        transactions.push(currentTransaction);
      }
      
      const content = line.substring(4);
      const dateMatch = content.match(/^(\d{6})(\d{4})?(C|D)(\d+,\d+)/);
      
      if (dateMatch) {
        const [_, valueDate, bookDate, dcMark, amount] = dateMatch;
        
        const parseDate = (yymmdd: string) => {
          const yy = yymmdd.substring(0, 2);
          const mm = yymmdd.substring(2, 4);
          const dd = yymmdd.substring(4, 6);
          const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
          return `${year}-${mm}-${dd}T00:00:00Z`;
        };
        
        currentTransaction = {
          value_date: parseDate(valueDate),
          booking_date: bookDate ? parseDate(valueDate.substring(0, 4) + bookDate) : parseDate(valueDate),
          credit_debit_indicator: dcMark === 'C' ? 'Credit' : 'Debit',
          amount: parseFloat(amount.replace(',', '.')),
          reference: content.substring(dateMatch[0].length).trim() || `MT940-${Date.now()}-${i}`,
        };
      }
    }
    
    // Transaction information :86:
    if (line.startsWith(':86:')) {
      if (currentTransaction) {
        currentTransaction.description = line.substring(4);
      }
    }
  }
  
  if (currentTransaction.reference) {
    transactions.push(currentTransaction);
  }
  
  return transactions.map(txn => ({
    transaction_reference: txn.reference,
    amount: txn.amount,
    currency: 'XAF',
    credit_debit_indicator: txn.credit_debit_indicator,
    booking_date: txn.booking_date,
    value_date: txn.value_date,
    transaction_information: txn.description || 'MT940 Import',
  }));
}

// CAMT053 Parser
function parseCAMT053(data: string): any[] {
  const transactions: any[] = [];
  
  try {
    const entryRegex = /<Ntry>(.*?)<\/Ntry>/gs;
    const entries = data.match(entryRegex);
    
    if (!entries) return [];
    
    entries.forEach((entry, index) => {
      const amtMatch = entry.match(/<Amt[^>]*>([^<]+)<\/Amt>/);
      const amount = amtMatch ? parseFloat(amtMatch[1]) : 0;
      
      const cdtDbtIndMatch = entry.match(/<CdtDbtInd>([^<]+)<\/CdtDbtInd>/);
      const creditDebitIndicator = cdtDbtIndMatch && cdtDbtIndMatch[1] === 'CRDT' ? 'Credit' : 'Debit';
      
      const bookDtMatch = entry.match(/<BookgDt>.*?<Dt>([^<]+)<\/Dt>.*?<\/BookgDt>/s);
      const bookingDate = bookDtMatch ? bookDtMatch[1] + 'T00:00:00Z' : new Date().toISOString();
      
      const valDtMatch = entry.match(/<ValDt>.*?<Dt>([^<]+)<\/Dt>.*?<\/ValDt>/s);
      const valueDate = valDtMatch ? valDtMatch[1] + 'T00:00:00Z' : bookingDate;
      
      const refMatch = entry.match(/<AcctSvcrRef>([^<]+)<\/AcctSvcrRef>/);
      const reference = refMatch ? refMatch[1] : `CAMT-${Date.now()}-${index}`;
      
      const addtlInfMatch = entry.match(/<AddtlNtryInf>([^<]+)<\/AddtlNtryInf>/);
      const description = addtlInfMatch ? addtlInfMatch[1] : 'CAMT.053 Import';
      
      const ccyMatch = entry.match(/<Amt[^>]*Ccy="([^"]+)"/);
      const currency = ccyMatch ? ccyMatch[1] : 'XAF';
      
      transactions.push({
        transaction_reference: reference,
        amount,
        currency,
        credit_debit_indicator: creditDebitIndicator,
        booking_date: bookingDate,
        value_date: valueDate,
        transaction_information: description,
      });
    });
  } catch (error) {
    console.error('CAMT053 parsing error:', error);
  }
  
  return transactions;
}
