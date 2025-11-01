import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-verif-hash',
};

// Sanitize error messages to prevent sensitive data leakage
function sanitizeErrorMessage(message: string, maxLength: number = 200): string {
  const sanitized = message
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/api[_-]?key["\s:=]+[A-Za-z0-9\-._~+/]+/gi, 'apikey=[REDACTED]')
    .replace(/password["\s:=]+[^,}\s]+/gi, 'password=[REDACTED]')
    .replace(/secret["\s:=]+[^,}\s]+/gi, 'secret=[REDACTED]')
    .replace(/token["\s:=]+[A-Za-z0-9\-._~+/]+=*/gi, 'token=[REDACTED]')
    .replace(/\b\d{13,19}\b/g, '[CARD_NUMBER]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_ADDRESS]');
  
  return sanitized.substring(0, maxLength);
}

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
        const sanitizedError = sanitizeErrorMessage(updateError.message);
        throw new Error(`Failed to update transaction: ${sanitizedError}`);
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

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook processed successfully' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    const errorMessage = sanitizeErrorMessage(error?.message || 'Unknown error');
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
