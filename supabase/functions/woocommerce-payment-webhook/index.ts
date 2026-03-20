import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { corsHeaders } from "../_shared/cors.ts";

interface WebhookPayload {
  event_type: 'payment.completed' | 'payment.failed' | 'payment.refunded';
  transaction_ref: string;
  woocommerce_order_id: string;
  merchant_api_key: string;
  payment_method: 'mobile_money' | 'card' | 'bank_transfer';
  amount: number;
  currency: string;
  status: 'completed' | 'failed' | 'refunded';
  customer_email?: string;
  customer_phone?: string;
  kob_transaction_id?: string;
  error_message?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

async function updateWooCommerceOrderStatus(
  storeUrl: string,
  orderId: string,
  status: 'processing' | 'completed' | 'failed' | 'refunded',
  note: string,
  wcConsumerKey?: string,
  wcConsumerSecret?: string,
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add Basic auth if WooCommerce REST API credentials are available
    if (wcConsumerKey && wcConsumerSecret) {
      const credentials = btoa(`${wcConsumerKey}:${wcConsumerSecret}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(`${storeUrl}/wp-json/wc/v3/orders/${orderId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        status,
        customer_note: note
      })
    });

    if (!response.ok) {
      console.error(`Failed to update WooCommerce order: ${response.statusText}`);
    } else {
      console.log(`WooCommerce order ${orderId} updated to status: ${status}`);
    }
  } catch (error) {
    console.error('Error updating WooCommerce order:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Webhook received');

    // Get webhook signature
    const signature = req.headers.get('x-webhook-signature');
    if (!signature) {
      console.error('Missing webhook signature');
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const rawPayload = await req.text();
    const payload: WebhookPayload = JSON.parse(rawPayload);
    
    console.log(`Processing webhook event: ${payload.event_type}, Order ID: ${payload.woocommerce_order_id}`);

    // Hash API key to look up merchant
    const encoder = new TextEncoder();
    const apiKeyHash = await crypto.subtle.digest('SHA-256', encoder.encode(payload.merchant_api_key));
    const apiKeyHashHex = Array.from(new Uint8Array(apiKeyHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Find merchant by API key hash
    const { data: merchant, error: merchantError } = await supabaseClient
      .from('woocommerce_merchants')
      .select('id, store_name, store_url, admin_email, api_key_hash, status, user_id')
      .eq('api_key_hash', apiKeyHashHex)
      .single();

    if (merchantError || !merchant) {
      console.error('Merchant not found for API key');
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature using server-side HMAC (no plaintext secret read)
    const { data: hmacResult } = await supabaseClient.rpc('compute_woo_webhook_hmac', {
      p_merchant_id: merchant.id,
      p_payload: rawPayload,
    });
    const isValid = hmacResult && signature === hmacResult;
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate transaction
    const { data: existingTx } = await supabaseClient
      .from('woocommerce_transactions')
      .select('id')
      .eq('transaction_ref', payload.transaction_ref)
      .single();

    if (existingTx) {
      console.log('Duplicate webhook received, ignoring');
      return new Response(
        JSON.stringify({ success: true, message: 'Duplicate webhook' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert transaction record
    const { error: txError } = await supabaseClient
      .from('woocommerce_transactions')
      .insert({
        merchant_id: merchant.id,
        woocommerce_order_id: payload.woocommerce_order_id,
        transaction_ref: payload.transaction_ref,
        payment_method: payload.payment_method,
        amount: payload.amount,
        currency: payload.currency,
        customer_email: payload.customer_email,
        customer_phone: payload.customer_phone,
        status: payload.status,
        kob_transaction_id: payload.kob_transaction_id,
        error_message: payload.error_message,
        metadata: payload.metadata || {}
      });

    if (txError) {
      console.error('Error inserting transaction:', txError);
      throw txError;
    }

    console.log(`Transaction recorded: ${payload.transaction_ref}`);

    // Map status for WooCommerce
    let wcStatus: 'processing' | 'completed' | 'failed' | 'refunded';
    let wcNote: string;

    switch (payload.status) {
      case 'completed':
        wcStatus = 'processing';
        wcNote = `Payment completed via ${payload.payment_method}. Transaction ref: ${payload.transaction_ref}`;
        break;
      case 'failed':
        wcStatus = 'failed';
        wcNote = `Payment failed: ${payload.error_message || 'Unknown error'}. Transaction ref: ${payload.transaction_ref}`;
        break;
      case 'refunded':
        wcStatus = 'refunded';
        wcNote = `Payment refunded. Transaction ref: ${payload.transaction_ref}`;
        break;
      default:
        wcStatus = 'processing';
        wcNote = `Payment status: ${payload.status}. Transaction ref: ${payload.transaction_ref}`;
    }

    // Fetch WooCommerce REST API credentials from merchant_integrations if available
    let wcConsumerKey: string | undefined;
    let wcConsumerSecret: string | undefined;
    const { data: integration } = await supabaseClient
      .from('merchant_integrations')
      .select('config')
      .eq('merchant_id', merchant.id)
      .eq('integration_type', 'woocommerce')
      .eq('is_active', true)
      .maybeSingle();

    if (integration?.config) {
      const config = integration.config as Record<string, any>;
      wcConsumerKey = config.consumer_key;
      wcConsumerSecret = config.consumer_secret;
    }

    // Update WooCommerce order (asynchronous, don't block response)
    updateWooCommerceOrderStatus(
      merchant.store_url,
      payload.woocommerce_order_id,
      wcStatus,
      wcNote,
      wcConsumerKey,
      wcConsumerSecret,
    ).catch(err => console.error('Failed to update WooCommerce order:', err));

    // Create app_notification for merchant
    const notifType = payload.status === 'completed' ? 'success' : payload.status === 'failed' ? 'warning' : 'info';
    const notifTitle = payload.status === 'completed'
      ? 'WooCommerce Payment Received'
      : payload.status === 'failed'
      ? 'WooCommerce Payment Failed'
      : 'WooCommerce Payment Refunded';
    const formattedAmount = new Intl.NumberFormat('en-CM', { style: 'currency', currency: payload.currency || 'XAF' }).format(payload.amount);
    const notifMessage = payload.status === 'completed'
      ? `${formattedAmount} payment received for order #${payload.woocommerce_order_id} via ${payload.payment_method}.`
      : payload.status === 'failed'
      ? `Payment of ${formattedAmount} failed for order #${payload.woocommerce_order_id}. ${payload.error_message || ''}`
      : `${formattedAmount} refunded for order #${payload.woocommerce_order_id}.`;

    await supabaseClient.from('app_notifications').insert({
      user_id: merchant.user_id,
      type: notifType,
      title: notifTitle,
      message: notifMessage,
      icon: 'shopping_cart',
      metadata: {
        woocommerce_order_id: payload.woocommerce_order_id,
        transaction_ref: payload.transaction_ref,
        amount: payload.amount,
        currency: payload.currency,
        payment_method: payload.payment_method,
        status: payload.status,
      }
    });

    // Send managed email to merchant for payment events
    const emailKeyMap: Record<string, string> = {
      completed: 'woo_payment_completed',
      failed: 'woo_payment_failed',
      refunded: 'woo_refund_processed',
    };
    const emailKey = emailKeyMap[payload.status];
    if (emailKey) {
      supabaseClient.functions.invoke('managed-send-email', {
        body: {
          email_key: emailKey,
          recipient_email: merchant.admin_email,
          variables: {
            store_name: merchant.store_name,
            order_id: payload.woocommerce_order_id,
            amount: formattedAmount,
            currency: payload.currency,
            payment_method: payload.payment_method,
            transaction_ref: payload.transaction_ref,
            error_message: payload.error_message || 'N/A',
          },
        },
      }).catch(err => console.error('Failed to send WooCommerce email:', err));
    }

    // Update last sync time
    await supabaseClient
      .from('woocommerce_merchants')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', merchant.id);

    console.log('Webhook processed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Webhook processed',
        transaction_ref: payload.transaction_ref
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in woocommerce-payment-webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
