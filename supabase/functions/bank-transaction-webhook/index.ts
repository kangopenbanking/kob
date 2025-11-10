import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify HMAC signature for security
    const signature = req.headers.get('x-webhook-signature');
    const body = await req.text();
    
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature (banks will provide their secret)
    const { bank_connection_id } = JSON.parse(body);
    const { data: connection } = await supabase
      .from('bank_connections')
      .select('connection_config')
      .eq('id', bank_connection_id)
      .single();

    if (!connection) {
      return new Response(
        JSON.stringify({ error: 'Invalid bank connection' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const secret = connection.connection_config?.webhook_secret;
    if (!secret) {
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify HMAC using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(body);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse transaction data
    const payload = JSON.parse(body);
    const { transactions } = payload;

    if (!transactions || !Array.isArray(transactions)) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction data format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process transactions
    const importResults = {
      total: transactions.length,
      successful: 0,
      failed: 0,
      duplicates: 0,
      errors: [] as string[]
    };

    for (const txn of transactions) {
      try {
        // Check for duplicates
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('transaction_id', txn.transaction_id)
          .single();

        if (existing) {
          importResults.duplicates++;
          continue;
        }

        // Insert transaction
        const { error: insertError } = await supabase
          .from('transactions')
          .insert({
            account_id: txn.account_id,
            transaction_id: txn.transaction_id,
            amount: txn.amount,
            currency: txn.currency || 'XAF',
            transaction_type: txn.transaction_type,
            status: txn.status || 'completed',
            description: txn.description,
            booking_date: txn.booking_date,
            value_date: txn.value_date,
            creditor_name: txn.creditor_name,
            debtor_name: txn.debtor_name,
            merchant_category_code: txn.merchant_category_code,
            metadata: txn.metadata || {}
          });

        if (insertError) {
          importResults.failed++;
          importResults.errors.push(`Transaction ${txn.transaction_id}: ${insertError.message}`);
        } else {
          importResults.successful++;
        }
      } catch (error) {
        importResults.failed++;
        importResults.errors.push(`Transaction ${txn.transaction_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Update bank connection sync status
    await supabase
      .from('bank_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: importResults.failed > 0 ? 'partial' : 'success',
        sync_error_message: importResults.errors.length > 0 ? importResults.errors.join('; ') : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', bank_connection_id);

    console.log('Bank transaction webhook processed:', importResults);

    return new Response(
      JSON.stringify({
        success: true,
        results: importResults
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Bank transaction webhook error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});