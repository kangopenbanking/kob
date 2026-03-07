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
    const flutterwaveSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify webhook signature
    const signature = req.headers.get('verif-hash');
    if (!signature) {
      console.error('Missing verif-hash header');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    
    // Verify signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(flutterwaveSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(JSON.stringify(payload))
    );
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Flutterwave webhook received:', payload);

    const { event, data } = payload;

    // --- Webhook deduplication via webhook_inbox ---
    const webhookId = data?.id?.toString() || data?.flw_ref || data?.reference || crypto.randomUUID();
    const inboxKey = `flutterwave:${event}:${webhookId}`;

    const { data: existingWebhook } = await supabase
      .from('webhook_inbox')
      .select('id, is_processed')
      .eq('source', 'flutterwave')
      .eq('event_id', inboxKey)
      .single();

    if (existingWebhook?.is_processed) {
      console.log(`Duplicate webhook skipped: ${inboxKey}`);
      return new Response(JSON.stringify({ success: true, message: 'Already processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record in webhook_inbox
    const { data: inboxRecord } = await supabase.from('webhook_inbox').upsert({
      source: 'flutterwave',
      event_id: inboxKey,
      payload,
      signature,
      is_processed: false,
    }, { onConflict: 'source,event_id' }).select('id').single();
    
    // Handle transfer and charge events
    if (event === 'transfer.completed' || event === 'charge.completed') {
      const transactionRef = data.reference || data.tx_ref;
      const status = data.status?.toLowerCase();
      
      let updateStatus = 'pending';
      if (status === 'successful' || status === 'success') {
        updateStatus = 'completed';
      } else if (status === 'failed') {
        updateStatus = 'failed';
      }

      // Update bank transfer transaction
      const { error: updateError } = await supabase
        .from('bank_transfer_transactions')
        .update({
          status: updateStatus,
          flutterwave_ref: data.id || data.flw_ref,
          metadata: data,
          completed_at: updateStatus === 'completed' ? new Date().toISOString() : null,
          error_message: data.complete_message || data.message,
          updated_at: new Date().toISOString(),
        })
        .eq('transaction_ref', transactionRef);

      if (updateError) {
        console.error('Error updating transaction:', updateError);
        throw new Error('Failed to update transaction');
      }

      // Check if this is a settlement transaction
      const settlementId = data.meta?.settlement_id;
      if (settlementId) {
        console.log('Updating settlement transaction:', settlementId);
        
        const { error: settlementError } = await supabase
          .from('settlement_transactions')
          .update({
            settlement_status: updateStatus,
            flutterwave_transfer_ref: data.id || data.flw_ref,
            completed_at: updateStatus === 'completed' ? new Date().toISOString() : null,
            error_message: updateStatus === 'failed' ? (data.complete_message || data.message) : null,
            metadata: { ...data },
            updated_at: new Date().toISOString(),
          })
          .eq('id', settlementId);

        if (settlementError) {
          console.error('Error updating settlement:', settlementError);
        }
      }

      // Log the webhook event
      await supabase
        .from('security_audit_logs')
        .insert({
          event_type: 'webhook_received',
          event_category: 'payment',
          metadata: {
            webhook_event: event,
            transaction_ref: transactionRef,
            status: updateStatus,
            provider: 'flutterwave',
            settlement_id: settlementId || null,
          },
        });

      console.log(`Transaction ${transactionRef} updated to ${updateStatus}`);

      // If this is a completed mobile money charge for bank deposit, trigger auto-credit
      if (event === 'charge.completed' && updateStatus === 'completed') {
        const { data: mobileTransaction } = await supabase
          .from('mobile_money_transactions')
          .select('*, destination_account_id, is_bank_deposit')
          .eq('transaction_ref', transactionRef)
          .single();

        if (mobileTransaction?.is_bank_deposit && mobileTransaction.destination_account_id) {
          console.log('Triggering auto-credit for bank deposit:', transactionRef);
          
          // Call the verify function to trigger auto-crediting
          await supabase.functions.invoke('mobile-money-verify', {
            body: { transaction_ref: transactionRef }
          });
        }
      }
    }

    // Mark webhook as processed
    if (inboxRecord?.id) {
      await supabase.from('webhook_inbox').update({
        is_processed: true,
        processed_at: new Date().toISOString()
      }).eq('id', inboxRecord.id);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook processed successfully' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // Log full details server-side for debugging
    console.error('[FLUTTERWAVE-WEBHOOK] Error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      webhook_type: 'flutterwave_transfer',
      timestamp: new Date().toISOString()
    });
    
    // Return generic error to external webhook caller
    return new Response(JSON.stringify({ 
      received: false,
      message: 'Processing error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
