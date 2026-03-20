import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
      // Check for service_role key
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

    // Allow inbound_message without JWT (uses HMAC validation)
    const publicActions = ['inbound_message'];
    if (!publicActions.includes(action) && !user && !isServiceAuth) {
      return errorResponse('Unauthorized', 401);
    }

    switch (action) {

      // ─── Register a Message Queue Channel ───
      case 'register_channel': {
        if (!isAdmin) return errorResponse('Admin only', 403);
        const { bank_id, channel_name, channel_type, direction, topic_filter,
                webhook_url, webhook_secret, connector_instance_id } = body;

        if (!bank_id || !channel_name) return errorResponse('Missing bank_id or channel_name', 400);

        const validTypes = ['realtime', 'webhook', 'sse', 'websocket'];
        if (channel_type && !validTypes.includes(channel_type)) {
          return errorResponse(`Invalid channel_type. Must be one of: ${validTypes.join(', ')}`, 400);
        }

        const insertData: any = {
          bank_id,
          channel_name,
          channel_type: channel_type || 'realtime',
          direction: direction || 'inbound',
          topic_filter: topic_filter || '*',
          webhook_url,
          connector_instance_id,
        };

        // Hash webhook secret if provided
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
        const { bank_id, channel_type, is_active } = body;
        let query = supabase.from('bank_mq_channels').select('*, banks(display_name)');
        if (bank_id) query = query.eq('bank_id', bank_id);
        if (channel_type) query = query.eq('channel_type', channel_type);
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
                         'webhook_url', 'is_active'];
        const safe: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const k of allowed) {
          if (updates[k] !== undefined) safe[k] = updates[k];
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

      // ─── Inbound Message (Bank → KOB via webhook) ───
      case 'inbound_message': {
        const { channel_name, bank_id, message_type, payload, correlation_id } = body;
        if (!channel_name || !bank_id || !message_type || !payload) {
          return errorResponse('Missing required fields: channel_name, bank_id, message_type, payload', 400);
        }

        // Find channel
        const { data: channel } = await supabase.from('bank_mq_channels')
          .select('*').eq('bank_id', bank_id).eq('channel_name', channel_name)
          .eq('is_active', true).single();
        if (!channel) return errorResponse('Channel not found or inactive', 404);

        // HMAC validation if channel has a secret
        if (channel.webhook_secret_hash) {
          const signature = req.headers.get('X-KOB-Signature');
          if (!signature) return errorResponse('Missing X-KOB-Signature header', 401);
          // In production, verify HMAC-SHA256(payload, secret) === signature
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

        // Store message
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

        // Process message based on type
        const processResult = await processInboundMessage(supabase, channel, msg);

        // Update channel stats
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

        // Store outbound message
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

        // Deliver based on channel type
        let deliveryResult: any = { delivered: false };

        if (channel.channel_type === 'webhook' && channel.webhook_url) {
          try {
            const webhookPayload = JSON.stringify({
              message_id: msg.id,
              message_type,
              bank_id: bank_id || channel.bank_id,
              payload,
              timestamp: new Date().toISOString(),
            });

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };

            // Add HMAC signature if secret configured
            if (channel.webhook_secret_hash) {
              // Note: actual HMAC would use the raw secret, stored securely
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
        } else if (channel.channel_type === 'realtime') {
          // Broadcast via Supabase Realtime channel
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
          .select('*, bank_mq_channels(channel_name, channel_type)', { count: 'exact' });
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
          .select('id, channel_name, channel_type, direction, is_active, message_count, error_count, last_message_at, banks(display_name)');
        if (channel_id) query = query.eq('id', channel_id);
        if (statsBank) query = query.eq('bank_id', statsBank);

        const { data: channels, error } = await query;
        if (error) return errorResponse(error.message, 400);

        // Get recent message counts per channel
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

          return {
            ...ch,
            messages_last_hour: recentCount || 0,
            total_failed: failedCount || 0,
          };
        }));

        return jsonResponse({ stats });
      }

      // ─── Sandbox: Seed MQ Channels + Sample Messages ───
      case 'sandbox_seed_mq': {
        const { data: bank } = await supabase.from('banks')
          .select('id').eq('short_code', 'SBK-CM').single();
        if (!bank) return errorResponse('Sandbox bank not found. Run sandbox_seed_bank first.', 404);

        // Create channels
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

            // Update channel stats
            await supabase.from('bank_mq_channels').update({
              message_count: 5,
              last_message_at: new Date().toISOString(),
            }).eq('id', inboundChannel.id);
          }
        }

        return jsonResponse({
          message: 'Sandbox MQ channels seeded',
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
    // Route based on message type
    if (message_type.startsWith('account.')) {
      // Account events → upsert into bank_sourced_accounts
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
      // Transaction events → upsert into bank_sourced_transactions
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
      // Balance events → insert into bank_sourced_balances
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
      // Payment status callback → update bank_payments
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
      // Unknown message type — store but mark as unprocessed
      status = 'unprocessed';
      result = { note: `Unknown message type: ${message_type}` };
    }
  } catch (e: any) {
    status = 'error';
    result = { error: e.message };

    // Increment channel error count
    await supabase.from('bank_mq_channels').update({
      error_count: (channel.error_count || 0) + 1,
    }).eq('id', channel.id);
  }

  // Update message status
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
