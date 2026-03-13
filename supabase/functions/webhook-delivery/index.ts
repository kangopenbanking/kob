import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyCronAuth } from "../_shared/cron-auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Helper function to create HMAC signature
async function createHmacSignature(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing pending webhook deliveries...');

    // Get pending webhook deliveries
    const { data: pendingDeliveries, error: fetchError } = await supabase
      .from('webhook_deliveries')
      .select(`
        *,
        webhooks:webhook_id (
          webhook_url,
          secret,
          is_active
        )
      `)
      .eq('status', 'pending')
      .lt('attempt_count', 3)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching pending deliveries:', fetchError);
      throw fetchError;
    }

    if (!pendingDeliveries || pendingDeliveries.length === 0) {
      console.log('No pending webhook deliveries found');
      return new Response(
        JSON.stringify({ message: 'No pending deliveries', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingDeliveries.length} pending deliveries`);
    let successCount = 0;
    let failureCount = 0;

    // Process each delivery
    for (const delivery of pendingDeliveries) {
      const webhook = delivery.webhooks;
      
      if (!webhook || !webhook.is_active) {
        console.log(`Webhook ${delivery.webhook_id} is inactive or not found`);
        continue;
      }

      try {
        // Create HMAC signature for verification
        const payload = JSON.stringify({
          event_type: delivery.event_type,
          event_data: delivery.event_data,
          delivery_id: delivery.id,
          timestamp: new Date().toISOString()
        });

        const signature = await createHmacSignature(webhook.secret, payload);

        // Send webhook request
        const webhookResponse = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Event-Type': delivery.event_type,
            'User-Agent': 'KangOpenBanking-Webhooks/1.0'
          },
          body: payload,
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        const responseBody = await webhookResponse.text();
        const statusCode = webhookResponse.status;

        if (statusCode >= 200 && statusCode < 300) {
          // Success
          await supabase
            .from('webhook_deliveries')
            .update({
              status: 'delivered',
              http_status: statusCode,
              response_body: responseBody.substring(0, 1000), // Limit response size
              delivered_at: new Date().toISOString()
            })
            .eq('id', delivery.id);

          // Update webhook last_triggered_at
          await supabase
            .from('webhooks')
            .update({
              last_triggered_at: new Date().toISOString(),
              failure_count: 0,
              last_failure_at: null,
              last_failure_reason: null
            })
            .eq('id', delivery.webhook_id);

          successCount++;
          console.log(`Successfully delivered webhook ${delivery.id} to ${webhook.webhook_url}`);
        } else {
          // Failure
          const errorMessage = `HTTP ${statusCode}: ${sanitizeErrorMessage(responseBody, 200)}`;
          
          await supabase
            .from('webhook_deliveries')
            .update({
              status: 'failed',
              http_status: statusCode,
              response_body: sanitizeErrorMessage(responseBody, 500),
              attempt_count: delivery.attempt_count + 1
            })
            .eq('id', delivery.id);

          // Update webhook failure info
          await supabase
            .from('webhooks')
            .update({
              failure_count: (await supabase
                .from('webhooks')
                .select('failure_count')
                .eq('id', delivery.webhook_id)
                .single()).data?.failure_count + 1 || 1,
              last_failure_at: new Date().toISOString(),
              last_failure_reason: sanitizeErrorMessage(errorMessage, 500)
            })
            .eq('id', delivery.webhook_id);

          failureCount++;
          console.error(`Failed to deliver webhook ${delivery.id}: ${errorMessage}`);
        }
      } catch (error) {
        const rawError = error instanceof Error ? error.message : 'Unknown error';
        const errorMessage = sanitizeErrorMessage(rawError, 200);
        
        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'failed',
            response_body: errorMessage,
            attempt_count: delivery.attempt_count + 1
          })
          .eq('id', delivery.id);

        await supabase
          .from('webhooks')
          .update({
            failure_count: (await supabase
              .from('webhooks')
              .select('failure_count')
              .eq('id', delivery.webhook_id)
              .single()).data?.failure_count + 1 || 1,
            last_failure_at: new Date().toISOString(),
            last_failure_reason: errorMessage
          })
          .eq('id', delivery.webhook_id);

        failureCount++;
        console.error(`Exception delivering webhook ${delivery.id}:`, error);
      }
    }

    console.log(`Webhook delivery complete: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Webhook delivery complete',
        processed: pendingDeliveries.length,
        succeeded: successCount,
        failed: failureCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in webhook-delivery:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'WEBHOOK_DELIVERY_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});