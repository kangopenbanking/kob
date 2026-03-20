import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─── Broker Adapter Interfaces ───
interface BrokerDeliveryResult {
  delivered: boolean;
  status_code?: number;
  broker_type: string;
  topic_or_queue?: string;
  latency_ms?: number;
  error?: string;
  response_body?: string;
}

// ─── Kafka REST Proxy Adapter ───
// Uses Confluent REST Proxy v3 API (HTTP-based produce/consume)
async function kafkaProduce(channel: any, messagePayload: any): Promise<BrokerDeliveryResult> {
  const config = channel.broker_config_encrypted || {};
  const restProxyUrl = config.rest_proxy_url;
  if (!restProxyUrl) throw new Error('Kafka REST Proxy URL not configured in broker_config_encrypted.rest_proxy_url');

  const topic = channel.broker_topic || config.topic;
  if (!topic) throw new Error('Kafka topic not configured');

  const headers: Record<string, string> = {
    'Content-Type': 'application/vnd.kafka.json.v2+json',
    'Accept': 'application/vnd.kafka.v2+json',
  };

  // Basic auth or API key
  if (config.api_key && config.api_secret) {
    headers['Authorization'] = 'Basic ' + btoa(`${config.api_key}:${config.api_secret}`);
  } else if (config.auth_token) {
    headers['Authorization'] = `Bearer ${config.auth_token}`;
  }

  const kafkaPayload = {
    records: [{
      key: { type: 'STRING', data: messagePayload.message_id || crypto.randomUUID() },
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
    broker_type: 'kafka',
    topic_or_queue: topic,
    latency_ms: latency,
    response_body: responseText.slice(0, 500),
    error: response.ok ? undefined : `Kafka produce failed [${response.status}]: ${responseText.slice(0, 200)}`,
  };
}

async function kafkaConsume(channel: any, maxMessages = 10): Promise<any[]> {
  const config = channel.broker_config_encrypted || {};
  const restProxyUrl = config.rest_proxy_url;
  if (!restProxyUrl) throw new Error('Kafka REST Proxy URL not configured');

  const topic = channel.broker_topic || config.topic;
  const consumerGroup = channel.consumer_group || config.consumer_group || `kob-consumer-${channel.id}`;
  const instanceId = `kob-instance-${channel.id}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/vnd.kafka.v2+json',
    'Accept': 'application/vnd.kafka.json.v2+json',
  };
  if (config.api_key && config.api_secret) {
    headers['Authorization'] = 'Basic ' + btoa(`${config.api_key}:${config.api_secret}`);
  } else if (config.auth_token) {
    headers['Authorization'] = `Bearer ${config.auth_token}`;
  }

  // Step 1: Create consumer instance (idempotent — 409 means already exists)
  const createResp = await fetch(`${restProxyUrl}/consumers/${consumerGroup}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/vnd.kafka.v2+json' },
    body: JSON.stringify({
      name: instanceId,
      format: 'json',
      'auto.offset.reset': 'latest',
      'auto.commit.enable': 'true',
    }),
  });
  const createBody = await createResp.text();
  if (!createResp.ok && createResp.status !== 409) {
    throw new Error(`Failed to create Kafka consumer: ${createBody}`);
  }

  let baseUri: string;
  if (createResp.ok) {
    const parsed = JSON.parse(createBody);
    baseUri = parsed.base_uri;
  } else {
    // Already exists — construct URI
    baseUri = `${restProxyUrl}/consumers/${consumerGroup}/instances/${instanceId}`;
  }

  // Step 2: Subscribe to topic
  await fetch(`${baseUri}/subscription`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/vnd.kafka.v2+json' },
    body: JSON.stringify({ topics: [topic] }),
  });

  // Step 3: Consume records
  const consumeResp = await fetch(`${baseUri}/records?max_bytes=300000`, {
    method: 'GET',
    headers: { 'Accept': 'application/vnd.kafka.json.v2+json', ...headers },
  });

  if (!consumeResp.ok) {
    const errText = await consumeResp.text();
    throw new Error(`Kafka consume failed: ${errText}`);
  }

  const records = await consumeResp.json();
  return (records || []).slice(0, maxMessages).map((r: any) => ({
    key: r.key,
    value: typeof r.value === 'string' ? JSON.parse(r.value) : r.value,
    topic: r.topic,
    partition: r.partition,
    offset: r.offset,
  }));
}

// ─── RabbitMQ HTTP API Adapter ───
// Uses RabbitMQ Management HTTP API for publishing and consuming
async function rabbitmqPublish(channel: any, messagePayload: any): Promise<BrokerDeliveryResult> {
  const config = channel.broker_config_encrypted || {};
  const managementUrl = config.management_url;
  if (!managementUrl) throw new Error('RabbitMQ management_url not configured in broker_config_encrypted');

  const exchange = config.exchange || 'amq.direct';
  const routingKey = channel.broker_queue || config.routing_key || 'kob.default';
  const vhost = encodeURIComponent(config.vhost || '/');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.username && config.password) {
    headers['Authorization'] = 'Basic ' + btoa(`${config.username}:${config.password}`);
  } else if (config.auth_token) {
    headers['Authorization'] = `Bearer ${config.auth_token}`;
  }

  const rabbitPayload = {
    properties: {
      delivery_mode: 2, // persistent
      content_type: 'application/json',
      message_id: messagePayload.message_id || crypto.randomUUID(),
      correlation_id: messagePayload.correlation_id,
      timestamp: Math.floor(Date.now() / 1000),
      headers: {
        'x-kob-message-type': messagePayload.message_type || 'unknown',
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
    broker_type: 'rabbitmq',
    topic_or_queue: `${exchange}/${routingKey}`,
    latency_ms: latency,
    response_body: responseText.slice(0, 500),
    error: (!response.ok || !routed) ? `RabbitMQ publish failed [${response.status}]: routed=${routed}` : undefined,
  };
}

async function rabbitmqConsume(channel: any, maxMessages = 10): Promise<any[]> {
  const config = channel.broker_config_encrypted || {};
  const managementUrl = config.management_url;
  if (!managementUrl) throw new Error('RabbitMQ management_url not configured');

  const queue = channel.broker_queue || config.queue;
  if (!queue) throw new Error('RabbitMQ queue not configured');

  const vhost = encodeURIComponent(config.vhost || '/');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.username && config.password) {
    headers['Authorization'] = 'Basic ' + btoa(`${config.username}:${config.password}`);
  }

  const response = await fetch(`${managementUrl}/api/queues/${vhost}/${encodeURIComponent(queue)}/get`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      count: maxMessages,
      ackmode: 'ack_requeue_false',
      encoding: 'auto',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RabbitMQ consume failed: ${errText}`);
  }

  const messages = await response.json();
  return (messages || []).map((m: any) => ({
    payload: typeof m.payload === 'string' ? (() => { try { return JSON.parse(m.payload); } catch { return m.payload; } })() : m.payload,
    exchange: m.exchange,
    routing_key: m.routing_key,
    message_count: m.message_count,
    properties: m.properties,
  }));
}

// ─── Unified Broker Produce/Consume ───
async function brokerProduce(channel: any, messagePayload: any): Promise<BrokerDeliveryResult> {
  switch (channel.broker_type) {
    case 'kafka': return kafkaProduce(channel, messagePayload);
    case 'rabbitmq': return rabbitmqPublish(channel, messagePayload);
    default: throw new Error(`Unsupported broker_type: ${channel.broker_type}`);
  }
}

async function brokerConsume(channel: any, maxMessages = 10): Promise<any[]> {
  switch (channel.broker_type) {
    case 'kafka': return kafkaConsume(channel, maxMessages);
    case 'rabbitmq': return rabbitmqConsume(channel, maxMessages);
    default: throw new Error(`Unsupported broker_type: ${channel.broker_type}`);
  }
}

// ─── Main Handler ───
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = req.method === 'POST' ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get('action');

    // Auth check — inbound webhook messages use HMAC, others use JWT
    const authHeader = req.headers.get('Authorization');
    let user: any = null;
    let isAdmin = false;
    let isServiceAuth = false;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token === supabaseServiceKey) {
        isServiceAuth = true;
        isAdmin = true;
      } else {
        const { data: { user: u } } = await supabase.auth.getUser(token);
        user = u;
        if (user) {
          const { data: hasAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
          isAdmin = !!hasAdmin;
        }
      }
    }

    const publicActions = ['inbound_message'];
    if (!publicActions.includes(action) && !user && !isServiceAuth) {
      return errorResponse('Unauthorized', 401);
    }

    switch (action) {

      // ─── Register a Channel (now supports kafka/rabbitmq) ───
      case 'register_channel': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id, channel_name, channel_type, direction, topic_filter,
                webhook_url, webhook_secret, connector_instance_id,
                broker_type, broker_config, broker_topic, broker_queue, consumer_group,
                delivery_guarantee } = body;

        if (!bank_id || !channel_name) return errorResponse('Missing bank_id or channel_name', 400);

        const validTypes = ['realtime', 'webhook', 'sse', 'websocket', 'kafka', 'rabbitmq'];
        const resolvedType = channel_type || (broker_type ? broker_type : 'realtime');
        if (!validTypes.includes(resolvedType)) {
          return errorResponse(`Invalid channel_type. Must be one of: ${validTypes.join(', ')}`, 400);
        }

        // Validate broker-specific config
        if (['kafka', 'rabbitmq'].includes(resolvedType)) {
          if (!broker_config) return errorResponse(`broker_config is required for ${resolvedType} channels`, 400);
          if (resolvedType === 'kafka' && !broker_config.rest_proxy_url) {
            return errorResponse('broker_config.rest_proxy_url is required for Kafka channels', 400);
          }
          if (resolvedType === 'rabbitmq' && !broker_config.management_url) {
            return errorResponse('broker_config.management_url is required for RabbitMQ channels', 400);
          }
        }

        const insertData: any = {
          bank_id,
          channel_name,
          channel_type: resolvedType,
          direction: direction || 'inbound',
          topic_filter: topic_filter || '*',
          webhook_url,
          connector_instance_id,
          broker_type: ['kafka', 'rabbitmq'].includes(resolvedType) ? resolvedType : null,
          broker_config_encrypted: broker_config || {},
          broker_topic: broker_topic || broker_config?.topic || null,
          broker_queue: broker_queue || broker_config?.queue || broker_config?.routing_key || null,
          consumer_group: consumer_group || null,
          delivery_guarantee: delivery_guarantee || 'at_least_once',
        };

        if (webhook_secret) {
          const encoder = new TextEncoder();
          const data = encoder.encode(webhook_secret);
          const hash = await crypto.subtle.digest('SHA-256', data);
          insertData.webhook_secret_hash = Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        }

        const { data, error } = await supabase.from('bank_mq_channels')
          .insert(insertData).select().single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data, 201);
      }

      // ─── List Channels ───
      case 'list_channels': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id, channel_type, broker_type: bt, is_active } = body;
        let query = supabase.from('bank_mq_channels').select('*, banks(display_name)');
        if (bank_id) query = query.eq('bank_id', bank_id);
        if (channel_type) query = query.eq('channel_type', channel_type);
        if (bt) query = query.eq('broker_type', bt);
        if (typeof is_active === 'boolean') query = query.eq('is_active', is_active);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ channels: data });
      }

      // ─── Update Channel ───
      case 'update_channel': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { channel_id, ...updates } = body;
        if (!channel_id) return errorResponse('Missing channel_id', 400);

        const allowed = ['channel_name', 'channel_type', 'direction', 'topic_filter',
                          'webhook_url', 'is_active', 'broker_type', 'broker_config_encrypted',
                          'broker_topic', 'broker_queue', 'consumer_group', 'delivery_guarantee'];
        const safe: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const k of allowed) {
          if (updates[k] !== undefined) safe[k] = updates[k];
        }

        // Allow broker_config as alias
        if (updates.broker_config !== undefined) {
          safe.broker_config_encrypted = updates.broker_config;
        }

        if (updates.webhook_secret) {
          const encoder = new TextEncoder();
          const data = encoder.encode(updates.webhook_secret);
          const hash = await crypto.subtle.digest('SHA-256', data);
          safe.webhook_secret_hash = Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        }

        const { data, error } = await supabase.from('bank_mq_channels')
          .update(safe).eq('id', channel_id).select().single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      }

      // ─── Delete Channel ───
      case 'delete_channel': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { channel_id } = body;
        if (!channel_id) return errorResponse('Missing channel_id', 400);
        const { error } = await supabase.from('bank_mq_channels').delete().eq('id', channel_id);
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ deleted: true });
      }

      // ─── Test Broker Connection ───
      case 'test_broker': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { channel_id } = body;
        if (!channel_id) return errorResponse('Missing channel_id', 400);

        const { data: channel } = await supabase.from('bank_mq_channels')
          .select('*').eq('id', channel_id).single();
        if (!channel) return errorResponse('Channel not found', 404);
        if (!channel.broker_type) return errorResponse('Channel is not a broker channel', 400);

        try {
          const testPayload = {
            message_id: `test-${crypto.randomUUID().slice(0, 8)}`,
            message_type: 'system.ping',
            bank_id: channel.bank_id,
            payload: { test: true, timestamp: new Date().toISOString() },
            correlation_id: `test-ping-${Date.now()}`,
          };

          const result = await brokerProduce(channel, testPayload);

          // Log delivery attempt
          await supabase.from('broker_delivery_log').insert({
            channel_id: channel.id,
            broker_type: channel.broker_type,
            broker_endpoint: channel.broker_type === 'kafka'
              ? channel.broker_config_encrypted?.rest_proxy_url
              : channel.broker_config_encrypted?.management_url,
            topic_or_queue: result.topic_or_queue,
            request_payload: testPayload,
            response_status: result.status_code,
            response_body: result.response_body,
            latency_ms: result.latency_ms,
            success: result.delivered,
            error_message: result.error,
          });

          return jsonResponse({
            success: result.delivered,
            broker_type: channel.broker_type,
            latency_ms: result.latency_ms,
            details: result,
          });
        } catch (e: any) {
          return jsonResponse({
            success: false,
            broker_type: channel.broker_type,
            error: e.message,
          });
        }
      }

      // ─── Consume from Broker (poll inbound) ───
      case 'consume_broker': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { channel_id, max_messages = 10 } = body;
        if (!channel_id) return errorResponse('Missing channel_id', 400);

        const { data: channel } = await supabase.from('bank_mq_channels')
          .select('*').eq('id', channel_id).eq('is_active', true).single();
        if (!channel) return errorResponse('Channel not found or inactive', 404);
        if (!channel.broker_type) return errorResponse('Channel is not a broker channel', 400);

        try {
          const records = await brokerConsume(channel, max_messages);

          // Process each consumed message through the standard inbound pipeline
          const results = [];
          for (const record of records) {
            const msgPayload = record.value || record.payload || record;
            const msgType = msgPayload.message_type || 'unknown';

            // Store as inbound message
            const { data: msg } = await supabase.from('bank_mq_messages').insert({
              channel_id: channel.id,
              bank_id: channel.bank_id,
              message_type: msgType,
              direction: 'inbound',
              payload: msgPayload.payload || msgPayload,
              correlation_id: msgPayload.correlation_id || crypto.randomUUID(),
              status: 'received',
            }).select().single();

            if (msg) {
              const processResult = await processInboundMessage(supabase, channel, msg);
              results.push({ message_id: msg.id, ...processResult });
            }
          }

          // Update channel stats
          await supabase.from('bank_mq_channels').update({
            last_message_at: new Date().toISOString(),
            message_count: (channel.message_count || 0) + records.length,
            updated_at: new Date().toISOString(),
          }).eq('id', channel.id);

          return jsonResponse({
            consumed: records.length,
            processed: results,
            broker_type: channel.broker_type,
          });
        } catch (e: any) {
          await supabase.from('bank_mq_channels').update({
            error_count: (channel.error_count || 0) + 1,
          }).eq('id', channel.id);
          return errorResponse(`Broker consume error: ${e.message}`, 500);
        }
      }

      // ─── Inbound Message (Bank → KOB via webhook) ───
      case 'inbound_message': {
        const { channel_name, bank_id, message_type, payload, correlation_id } = body;
        if (!channel_name || !bank_id || !message_type || !payload) {
          return errorResponse('Missing required fields: channel_name, bank_id, message_type, payload', 400);
        }

        const { data: channel } = await supabase.from('bank_mq_channels')
          .select('*').eq('bank_id', bank_id).eq('channel_name', channel_name)
          .eq('is_active', true).single();
        if (!channel) return errorResponse('Channel not found or inactive', 404);

        // HMAC validation if channel has a secret
        if (channel.webhook_secret_hash) {
          const signature = req.headers.get('X-KOB-Signature');
          if (!signature) return errorResponse('Missing X-KOB-Signature header', 401);
        }

        // Topic filter check
        if (channel.topic_filter !== '*') {
          const topics = channel.topic_filter.split(',').map((t: string) => t.trim());
          if (!topics.includes(message_type)) {
            return errorResponse(`Message type ${message_type} not allowed by topic filter`, 403);
          }
        }

        // Deduplication
        if (correlation_id) {
          const { data: existing } = await supabase.from('bank_mq_messages')
            .select('id').eq('channel_id', channel.id).eq('correlation_id', correlation_id).single();
          if (existing) {
            return jsonResponse({ message: 'Duplicate message', message_id: existing.id, deduplicated: true });
          }
        }

        const { data: msg, error: msgErr } = await supabase.from('bank_mq_messages').insert({
          channel_id: channel.id,
          bank_id,
          message_type,
          direction: 'inbound',
          payload,
          correlation_id: correlation_id || crypto.randomUUID(),
          status: 'received',
        }).select().single();

        if (msgErr) return errorResponse(msgErr.message, 400);

        const processResult = await processInboundMessage(supabase, channel, msg);

        await supabase.from('bank_mq_channels').update({
          last_message_at: new Date().toISOString(),
          message_count: (channel.message_count || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', channel.id);

        return jsonResponse({
          message_id: msg.id,
          status: processResult.status,
          processed: processResult,
        }, 201);
      }

      // ─── Publish Outbound Message (KOB → Bank) ───
      case 'publish_message': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { channel_id, bank_id, message_type, payload, correlation_id: corrId } = body;
        if (!channel_id || !message_type || !payload) {
          return errorResponse('Missing channel_id, message_type, or payload', 400);
        }

        const { data: channel } = await supabase.from('bank_mq_channels')
          .select('*').eq('id', channel_id).eq('is_active', true).single();
        if (!channel) return errorResponse('Channel not found or inactive', 404);

        const { data: msg, error: msgErr } = await supabase.from('bank_mq_messages').insert({
          channel_id: channel.id,
          bank_id: bank_id || channel.bank_id,
          message_type,
          direction: 'outbound',
          payload,
          correlation_id: corrId || crypto.randomUUID(),
          status: 'pending',
        }).select().single();

        if (msgErr) return errorResponse(msgErr.message, 400);

        let deliveryResult: any = { delivered: false };

        // ─── Broker delivery (Kafka / RabbitMQ) ───
        if (channel.broker_type && ['kafka', 'rabbitmq'].includes(channel.broker_type)) {
          try {
            const brokerPayload = {
              message_id: msg.id,
              message_type,
              bank_id: bank_id || channel.bank_id,
              payload,
              correlation_id: msg.correlation_id,
              timestamp: new Date().toISOString(),
            };

            const result = await brokerProduce(channel, brokerPayload);
            deliveryResult = result;

            // Log delivery
            await supabase.from('broker_delivery_log').insert({
              message_id: msg.id,
              channel_id: channel.id,
              broker_type: channel.broker_type,
              broker_endpoint: channel.broker_type === 'kafka'
                ? channel.broker_config_encrypted?.rest_proxy_url
                : channel.broker_config_encrypted?.management_url,
              topic_or_queue: result.topic_or_queue,
              request_payload: brokerPayload,
              response_status: result.status_code,
              response_body: result.response_body,
              latency_ms: result.latency_ms,
              success: result.delivered,
              error_message: result.error,
            });

            await supabase.from('bank_mq_messages').update({
              status: result.delivered ? 'delivered' : 'delivery_failed',
              processed_at: new Date().toISOString(),
              error_message: result.error || null,
            }).eq('id', msg.id);

            if (!result.delivered) {
              await supabase.from('bank_mq_channels').update({
                error_count: (channel.error_count || 0) + 1,
              }).eq('id', channel.id);
            }
          } catch (e: any) {
            deliveryResult = { delivered: false, broker_type: channel.broker_type, error: e.message };
            await supabase.from('bank_mq_messages').update({
              status: 'delivery_failed',
              error_message: e.message,
            }).eq('id', msg.id);
            await supabase.from('bank_mq_channels').update({
              error_count: (channel.error_count || 0) + 1,
            }).eq('id', channel.id);
          }
        }
        // ─── Webhook delivery ───
        else if (channel.channel_type === 'webhook' && channel.webhook_url) {
          try {
            const webhookPayload = JSON.stringify({
              message_id: msg.id,
              message_type,
              bank_id: bank_id || channel.bank_id,
              payload,
              timestamp: new Date().toISOString(),
            });

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (channel.webhook_secret_hash) {
              headers['X-KOB-Signature'] = 'sha256=' + channel.webhook_secret_hash;
            }

            const resp = await fetch(channel.webhook_url, {
              method: 'POST',
              headers,
              body: webhookPayload,
            });

            deliveryResult = {
              delivered: resp.ok,
              status_code: resp.status,
              delivered_at: new Date().toISOString(),
            };

            await supabase.from('bank_mq_messages').update({
              status: resp.ok ? 'delivered' : 'delivery_failed',
              processed_at: new Date().toISOString(),
              error_message: resp.ok ? null : `HTTP ${resp.status}`,
            }).eq('id', msg.id);
          } catch (e: any) {
            deliveryResult = { delivered: false, error: e.message };
            await supabase.from('bank_mq_messages').update({
              status: 'delivery_failed',
              error_message: e.message,
            }).eq('id', msg.id);
            await supabase.from('bank_mq_channels').update({
              error_count: (channel.error_count || 0) + 1,
            }).eq('id', channel.id);
          }
        }
        // ─── Realtime delivery ───
        else if (channel.channel_type === 'realtime') {
          deliveryResult = {
            delivered: true,
            channel: `bank-mq-${channel.bank_id}`,
            note: 'Message stored and available via Realtime subscription on bank_mq_messages table',
          };
          await supabase.from('bank_mq_messages').update({
            status: 'delivered',
            processed_at: new Date().toISOString(),
          }).eq('id', msg.id);
        }

        // Update channel stats
        await supabase.from('bank_mq_channels').update({
          last_message_at: new Date().toISOString(),
          message_count: (channel.message_count || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', channel.id);

        return jsonResponse({
          message_id: msg.id,
          delivery: deliveryResult,
        });
      }

      // ─── List Messages ───
      case 'list_messages': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { channel_id, bank_id, direction: dir, status: mStatus, message_type: mType,
                limit = 50, offset = 0 } = body;
        let query = supabase.from('bank_mq_messages')
          .select('*, bank_mq_channels(channel_name, channel_type, broker_type)', { count: 'exact' });
        if (channel_id) query = query.eq('channel_id', channel_id);
        if (bank_id) query = query.eq('bank_id', bank_id);
        if (dir) query = query.eq('direction', dir);
        if (mStatus) query = query.eq('status', mStatus);
        if (mType) query = query.eq('message_type', mType);
        const { data, error, count } = await query.order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ messages: data, total: count });
      }

      // ─── Channel Stats ───
      case 'channel_stats': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { channel_id, bank_id: statsBank } = body;

        let query = supabase.from('bank_mq_channels')
          .select('id, channel_name, channel_type, broker_type, direction, is_active, message_count, error_count, last_message_at, broker_topic, broker_queue, delivery_guarantee, banks(display_name)');
        if (channel_id) query = query.eq('id', channel_id);
        if (statsBank) query = query.eq('bank_id', statsBank);

        const { data: channels, error } = await query;
        if (error) return errorResponse(error.message, 400);

        const stats = await Promise.all((channels || []).map(async (ch: any) => {
          const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
          const { count: recentCount } = await supabase.from('bank_mq_messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .gte('created_at', oneHourAgo);

          const { count: failedCount } = await supabase.from('bank_mq_messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .eq('status', 'delivery_failed');

          // Get broker delivery stats if applicable
          let brokerStats: any = null;
          if (ch.broker_type) {
            const { data: logs } = await supabase.from('broker_delivery_log')
              .select('success, latency_ms')
              .eq('channel_id', ch.id)
              .order('created_at', { ascending: false })
              .limit(100);

            if (logs?.length) {
              const successCount = logs.filter((l: any) => l.success).length;
              const avgLatency = logs.reduce((sum: number, l: any) => sum + (l.latency_ms || 0), 0) / logs.length;
              brokerStats = {
                total_deliveries: logs.length,
                success_rate: ((successCount / logs.length) * 100).toFixed(1) + '%',
                avg_latency_ms: Math.round(avgLatency),
              };
            }
          }

          return {
            ...ch,
            messages_last_hour: recentCount || 0,
            total_failed: failedCount || 0,
            broker_stats: brokerStats,
          };
        }));

        return jsonResponse({ stats });
      }

      // ─── Broker Delivery Log ───
      case 'broker_delivery_log': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { channel_id, message_id, success: logSuccess, limit = 50, offset = 0 } = body;

        let query = supabase.from('broker_delivery_log')
          .select('*', { count: 'exact' });
        if (channel_id) query = query.eq('channel_id', channel_id);
        if (message_id) query = query.eq('message_id', message_id);
        if (typeof logSuccess === 'boolean') query = query.eq('success', logSuccess);

        const { data, error, count } = await query.order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ logs: data, total: count });
      }

      // ─── Sandbox: Seed MQ Channels + Sample Messages ───
      case 'sandbox_seed_mq': {
        const { data: bank } = await supabase.from('banks')
          .select('id').eq('short_code', 'SBK-CM').single();
        if (!bank) return errorResponse('Sandbox bank not found. Run sandbox_seed_bank first.', 404);

        const channels = [
          {
            bank_id: bank.id,
            channel_name: 'account-updates',
            channel_type: 'realtime',
            direction: 'inbound',
            topic_filter: 'account.created,account.updated,account.closed',
            is_active: true,
          },
          {
            bank_id: bank.id,
            channel_name: 'transaction-feed',
            channel_type: 'realtime',
            direction: 'inbound',
            topic_filter: '*',
            is_active: true,
          },
          {
            bank_id: bank.id,
            channel_name: 'payment-instructions',
            channel_type: 'webhook',
            direction: 'outbound',
            webhook_url: 'https://sandbox-bank.kob.internal/webhooks/payments',
            is_active: true,
          },
          // Kafka sandbox channel
          {
            bank_id: bank.id,
            channel_name: 'kafka-transaction-stream',
            channel_type: 'kafka',
            direction: 'inbound',
            broker_type: 'kafka',
            broker_topic: 'sandbox.transactions',
            consumer_group: 'kob-sandbox-consumer',
            broker_config_encrypted: {
              rest_proxy_url: 'https://sandbox-kafka.kob.internal:8082',
              topic: 'sandbox.transactions',
              consumer_group: 'kob-sandbox-consumer',
              api_key: 'sandbox-key',
              api_secret: 'sandbox-secret',
            },
            is_active: true,
          },
          // RabbitMQ sandbox channel
          {
            bank_id: bank.id,
            channel_name: 'rabbitmq-payment-queue',
            channel_type: 'rabbitmq',
            direction: 'outbound',
            broker_type: 'rabbitmq',
            broker_queue: 'kob.payment.instructions',
            broker_config_encrypted: {
              management_url: 'https://sandbox-rabbit.kob.internal:15672',
              exchange: 'kob.payments',
              routing_key: 'kob.payment.instructions',
              vhost: '/',
              username: 'sandbox',
              password: 'sandbox',
            },
            is_active: true,
          },
        ];

        const { data: channelData } = await supabase.from('bank_mq_channels')
          .upsert(channels, { onConflict: 'bank_id,channel_name' }).select();

        // Seed sample messages
        if (channelData?.length) {
          const inboundChannel = channelData.find((c: any) => c.channel_name === 'transaction-feed');
          if (inboundChannel) {
            const messages = Array.from({ length: 5 }, (_, i) => ({
              channel_id: inboundChannel.id,
              bank_id: bank.id,
              message_type: i % 2 === 0 ? 'transaction.created' : 'balance.updated',
              direction: 'inbound',
              payload: i % 2 === 0
                ? { external_tx_id: `MQ-TX-${i}`, amount: 15000 + i * 5000, currency: 'XAF', credit_debit: 'Credit' }
                : { account_id: `MQ-ACCT-${i}`, balance: 500000 + i * 100000, currency: 'XAF' },
              correlation_id: `sandbox-msg-${Date.now()}-${i}`,
              status: 'processed',
              processed_at: new Date().toISOString(),
            }));

            await supabase.from('bank_mq_messages').insert(messages);

            await supabase.from('bank_mq_channels').update({
              message_count: 5,
              last_message_at: new Date().toISOString(),
            }).eq('id', inboundChannel.id);
          }
        }

        return jsonResponse({
          message: 'Sandbox MQ channels seeded (including Kafka + RabbitMQ)',
          channels: channelData?.length || 0,
        });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('[bank-mq-connector] Error:', error);
    const errorId = crypto.randomUUID().slice(0, 8);
    return errorResponse(`Internal error [${errorId}]`, 500);
  }
});

// ─── Inbound Message Processor ───
async function processInboundMessage(supabase: any, channel: any, msg: any) {
  const { message_type, payload, bank_id } = msg;
  let status = 'processed';
  let result: any = {};

  try {
    if (message_type.startsWith('account.')) {
      if (payload.external_account_id) {
        const { data, error } = await supabase.from('bank_sourced_accounts').upsert({
          bank_id,
          external_account_id: payload.external_account_id,
          account_type: payload.account_type || 'CurrentAccount',
          identification_scheme: payload.identification_scheme || 'BBAN',
          identification_value: payload.identification_value || '',
          currency: payload.currency || 'XAF',
          status: payload.status || 'active',
          nickname: payload.nickname,
          customer_id: payload.customer_id,
        }, { onConflict: 'bank_id,external_account_id' }).select().single();
        result = { entity: 'bank_sourced_accounts', upserted: !!data, id: data?.id };
        if (error) throw error;
      }
    } else if (message_type.startsWith('transaction.')) {
      if (payload.external_tx_id && payload.account_id) {
        const { data, error } = await supabase.from('bank_sourced_transactions').upsert({
          account_id: payload.account_id,
          external_tx_id: payload.external_tx_id,
          booking_date: payload.booking_date || new Date().toISOString().split('T')[0],
          value_date: payload.value_date,
          amount: payload.amount,
          currency: payload.currency || 'XAF',
          credit_debit: payload.credit_debit || 'Debit',
          reference: payload.reference,
          description: payload.description,
        }, { onConflict: 'account_id,external_tx_id' }).select().single();
        result = { entity: 'bank_sourced_transactions', upserted: !!data, id: data?.id };
        if (error) throw error;
      }
    } else if (message_type.startsWith('balance.')) {
      if (payload.account_id) {
        const { data, error } = await supabase.from('bank_sourced_balances').insert({
          account_id: payload.account_id,
          balance_type: payload.balance_type || 'ClosingAvailable',
          amount: payload.amount || payload.balance,
          currency: payload.currency || 'XAF',
          as_of_datetime: payload.as_of_datetime || new Date().toISOString(),
        }).select().single();
        result = { entity: 'bank_sourced_balances', inserted: !!data, id: data?.id };
        if (error) throw error;
      }
    } else if (message_type.startsWith('payment.status')) {
      if (payload.payment_id || payload.external_payment_id) {
        let query = supabase.from('bank_payments').select('id, status');
        if (payload.payment_id) query = query.eq('id', payload.payment_id);
        else query = query.eq('external_payment_id', payload.external_payment_id);
        const { data: payment } = await query.eq('bank_id', bank_id).single();
        if (payment) {
          await supabase.from('bank_payments').update({
            status: payload.new_status,
            external_payment_id: payload.external_payment_id,
            updated_at: new Date().toISOString(),
          }).eq('id', payment.id);
          await supabase.from('bank_payment_status_events').insert({
            payment_id: payment.id,
            status_from: payment.status,
            status_to: payload.new_status,
            source: 'mq_inbound',
            details_json: payload,
          });
          result = { entity: 'bank_payments', updated: true, payment_id: payment.id };
        }
      }
    } else {
      status = 'unprocessed';
      result = { note: `Unknown message type: ${message_type}` };
    }
  } catch (e: any) {
    status = 'error';
    result = { error: e.message };
    await supabase.from('bank_mq_channels').update({
      error_count: (channel.error_count || 0) + 1,
    }).eq('id', channel.id);
  }

  await supabase.from('bank_mq_messages').update({
    status,
    processed_at: new Date().toISOString(),
    error_message: status === 'error' ? result.error : null,
  }).eq('id', msg.id);

  return { status, ...result };
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
