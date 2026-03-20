// KOB Interbank Dispatch Worker — Outbox pattern processor
// Polls event_outbox for pending events and dispatches to bank connectors
// Supports: https_push, file, message_queue (Kafka + RabbitMQ)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyCronAuth } from '../_shared/cron-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const cronCheck = verifyCronAuth(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!cronCheck.authorized) {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        if (token !== supabaseServiceKey) {
          const { data: { user }, error } = await supabase.auth.getUser(token);
          if (error || !user) return cronCheck.response!;
          const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
          if (!isAdmin) return cronCheck.response!;
        }
      } else {
        return cronCheck.response!;
      }
    }

    // Fetch pending/failed events ready for processing
    const { data: events, error } = await supabase
      .from('event_outbox')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('next_retry_at', new Date().toISOString())
      .lt('retries', 7)
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      return jsonResp({ error: error.message }, 500);
    }

    if (!events || events.length === 0) {
      return jsonResp({ success: true, processed: 0, message: 'No pending events' });
    }

    const results: any[] = [];

    for (const event of events) {
      try {
        const result = await processEvent(supabase, event);
        results.push({ event_id: event.id, ...result });
      } catch (err: any) {
        const newRetries = (event.retries || 0) + 1;
        const backoffMs = Math.min(Math.pow(2, newRetries) * 1000, 3600000);
        const nextRetry = new Date(Date.now() + backoffMs).toISOString();
        const newStatus = newRetries >= (event.max_retries || 7) ? 'dead_letter' : 'failed';

        await supabase.from('event_outbox').update({
          status: newStatus,
          retries: newRetries,
          next_retry_at: nextRetry,
          error_message: err.message || 'Unknown error',
        }).eq('id', event.id);

        results.push({ event_id: event.id, success: false, error: err.message, status: newStatus });
      }
    }

    return jsonResp({ success: true, processed: results.length, results });
  } catch (error: any) {
    console.error('interbank-dispatch-worker error:', error);
    return jsonResp({ error: error.message || 'Internal server error' }, 500);
  }
});

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function processEvent(supabase: any, event: any): Promise<{ success: boolean; delivery_mode?: string }> {
  const payload = event.payload;
  const creditorParticipantId = payload.creditor_participant_id;

  if (!creditorParticipantId) {
    throw new Error('Missing creditor_participant_id in event payload');
  }

  // Look up endpoint for the creditor participant
  const { data: endpoint } = await supabase
    .from('interbank_endpoints')
    .select('*')
    .eq('participant_id', creditorParticipantId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!endpoint) {
    throw new Error(`No active endpoint found for participant ${creditorParticipantId}`);
  }

  const deliveryMode = endpoint.delivery_mode;

  switch (deliveryMode) {
    case 'https_push': {
      if (!endpoint.base_url) throw new Error('No base_url configured for https_push endpoint');

      const response = await fetch(`${endpoint.base_url}/connector/instructions/pacs008`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: payload.xml || JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        await supabase.from('interbank_endpoints').update({
          error_count: (endpoint.error_count || 0) + 1,
        }).eq('id', endpoint.id);
        throw new Error(`HTTP ${response.status}: ${responseText.slice(0, 200)}`);
      }

      await supabase.from('interbank_endpoints').update({
        last_seen_at: new Date().toISOString(),
      }).eq('id', endpoint.id);

      break;
    }

    case 'file': {
      // File mode: mark as awaiting_bank_processing
      console.log('File mode: instruction file would be generated for', creditorParticipantId);
      break;
    }

    case 'message_queue': {
      // ─── Production Broker Delivery ───
      // Look up MQ channel for this participant's bank
      const bankId = endpoint.bank_id || creditorParticipantId;
      const { data: mqChannel } = await supabase
        .from('bank_mq_channels')
        .select('*')
        .eq('bank_id', bankId)
        .eq('is_active', true)
        .in('broker_type', ['kafka', 'rabbitmq'])
        .in('direction', ['outbound', 'bidirectional'])
        .limit(1)
        .maybeSingle();

      if (!mqChannel) {
        // Fallback: check for any active outbound channel (webhook/realtime)
        const { data: fallbackChannel } = await supabase
          .from('bank_mq_channels')
          .select('*')
          .eq('bank_id', bankId)
          .eq('is_active', true)
          .in('direction', ['outbound', 'bidirectional'])
          .limit(1)
          .maybeSingle();

        if (!fallbackChannel) {
          throw new Error(`No active MQ channel found for bank ${bankId}`);
        }

        // Use webhook fallback
        if (fallbackChannel.channel_type === 'webhook' && fallbackChannel.webhook_url) {
          const webhookResp = await fetch(fallbackChannel.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_id: event.id,
              event_type: event.event_type,
              payload,
              timestamp: new Date().toISOString(),
            }),
          });
          const webhookText = await webhookResp.text();
          if (!webhookResp.ok) {
            throw new Error(`Webhook delivery failed [${webhookResp.status}]: ${webhookText.slice(0, 200)}`);
          }
          break;
        }

        throw new Error(`No broker or webhook channel available for bank ${bankId}`);
      }

      // Deliver via broker
      const brokerPayload = {
        event_id: event.id,
        event_type: event.event_type,
        message_type: 'interbank.payment.instruction',
        bank_id: bankId,
        payload,
        correlation_id: event.correlation_id || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };

      const brokerResult = await deliverViaBroker(mqChannel, brokerPayload);

      // Log broker delivery
      await supabase.from('broker_delivery_log').insert({
        channel_id: mqChannel.id,
        broker_type: mqChannel.broker_type,
        broker_endpoint: mqChannel.broker_type === 'kafka'
          ? mqChannel.broker_config_encrypted?.rest_proxy_url
          : mqChannel.broker_config_encrypted?.management_url,
        topic_or_queue: brokerResult.topic_or_queue,
        request_payload: brokerPayload,
        response_status: brokerResult.status_code,
        response_body: brokerResult.response_body,
        latency_ms: brokerResult.latency_ms,
        success: brokerResult.delivered,
        error_message: brokerResult.error,
      });

      if (!brokerResult.delivered) {
        throw new Error(brokerResult.error || `Broker delivery failed for ${mqChannel.broker_type}`);
      }

      break;
    }

    default:
      throw new Error(`Unsupported delivery mode: ${deliveryMode}`);
  }

  // Mark as delivered
  await supabase.from('event_outbox').update({
    status: 'delivered',
    processed_at: new Date().toISOString(),
  }).eq('id', event.id);

  return { success: true, delivery_mode: deliveryMode };
}

// ─── Broker Delivery Functions ───

interface BrokerResult {
  delivered: boolean;
  status_code?: number;
  topic_or_queue?: string;
  latency_ms?: number;
  response_body?: string;
  error?: string;
}

async function deliverViaBroker(channel: any, messagePayload: any): Promise<BrokerResult> {
  switch (channel.broker_type) {
    case 'kafka':
      return deliverViaKafka(channel, messagePayload);
    case 'rabbitmq':
      return deliverViaRabbitMQ(channel, messagePayload);
    default:
      throw new Error(`Unsupported broker_type: ${channel.broker_type}`);
  }
}

async function deliverViaKafka(channel: any, messagePayload: any): Promise<BrokerResult> {
  const config = channel.broker_config_encrypted || {};
  const restProxyUrl = config.rest_proxy_url;
  if (!restProxyUrl) throw new Error('Kafka REST Proxy URL not configured');

  const topic = channel.broker_topic || config.topic;
  if (!topic) throw new Error('Kafka topic not configured');

  const headers: Record<string, string> = {
    'Content-Type': 'application/vnd.kafka.json.v2+json',
    'Accept': 'application/vnd.kafka.v2+json',
  };

  if (config.api_key && config.api_secret) {
    headers['Authorization'] = 'Basic ' + btoa(`${config.api_key}:${config.api_secret}`);
  } else if (config.auth_token) {
    headers['Authorization'] = `Bearer ${config.auth_token}`;
  }

  const kafkaPayload = {
    records: [{
      key: { type: 'STRING', data: messagePayload.event_id || messagePayload.correlation_id || crypto.randomUUID() },
      value: { type: 'JSON', data: JSON.stringify(messagePayload) },
    }],
  };

  const start = Date.now();
  const response = await fetch(`${restProxyUrl}/topics/${topic}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(kafkaPayload),
  });
  const latency = Date.now() - start;
  const responseText = await response.text();

  return {
    delivered: response.ok,
    status_code: response.status,
    topic_or_queue: topic,
    latency_ms: latency,
    response_body: responseText.slice(0, 500),
    error: response.ok ? undefined : `Kafka produce failed [${response.status}]: ${responseText.slice(0, 200)}`,
  };
}

async function deliverViaRabbitMQ(channel: any, messagePayload: any): Promise<BrokerResult> {
  const config = channel.broker_config_encrypted || {};
  const managementUrl = config.management_url;
  if (!managementUrl) throw new Error('RabbitMQ management_url not configured');

  const exchange = config.exchange || 'amq.direct';
  const routingKey = channel.broker_queue || config.routing_key || 'kob.default';
  const vhost = encodeURIComponent(config.vhost || '/');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.username && config.password) {
    headers['Authorization'] = 'Basic ' + btoa(`${config.username}:${config.password}`);
  } else if (config.auth_token) {
    headers['Authorization'] = `Bearer ${config.auth_token}`;
  }

  const rabbitPayload = {
    properties: {
      delivery_mode: 2,
      content_type: 'application/json',
      message_id: messagePayload.event_id || crypto.randomUUID(),
      correlation_id: messagePayload.correlation_id,
      timestamp: Math.floor(Date.now() / 1000),
      headers: {
        'x-kob-event-type': messagePayload.event_type || 'unknown',
        'x-kob-bank-id': messagePayload.bank_id || '',
      },
    },
    routing_key: routingKey,
    payload: JSON.stringify(messagePayload),
    payload_encoding: 'string',
  };

  const start = Date.now();
  const response = await fetch(`${managementUrl}/api/exchanges/${vhost}/${encodeURIComponent(exchange)}/publish`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rabbitPayload),
  });
  const latency = Date.now() - start;
  const responseText = await response.text();

  let routed = false;
  try {
    const parsed = JSON.parse(responseText);
    routed = parsed.routed === true;
  } catch { /* ignore */ }

  return {
    delivered: response.ok && routed,
    status_code: response.status,
    topic_or_queue: `${exchange}/${routingKey}`,
    latency_ms: latency,
    response_body: responseText.slice(0, 500),
    error: (!response.ok || !routed) ? `RabbitMQ publish failed [${response.status}]: routed=${routed}` : undefined,
  };
}
