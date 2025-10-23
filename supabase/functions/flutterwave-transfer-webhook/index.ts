import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-verif-hash',
};

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
    
    // Handle transfer events
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
        throw new Error(`Failed to update transaction: ${updateError.message}`);
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
          },
        });

      console.log(`Transaction ${transactionRef} updated to ${updateStatus}`);
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
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
