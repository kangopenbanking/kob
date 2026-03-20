// KOB Interbank Dispatch Worker — Outbox pattern processor
// Polls event_outbox for pending events and dispatches to bank connectors
// Supports: https_push, file, message_queue (placeholder)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyCronAuth } from '../_shared/cron-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Allow cron, service_role, or admin auth
    const cronCheck = verifyCronAuth(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!cronCheck.authorized) {
      // Check for admin auth
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
      .lt('retries', 7) // max_retries default
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
        // Mark as failed with backoff
        const newRetries = (event.retries || 0) + 1;
        const backoffMs = Math.min(Math.pow(2, newRetries) * 1000, 3600000); // Max 1 hour
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

      // Consume body to prevent resource leak
      const responseText = await response.text();

      if (!response.ok) {
        // Update error count
        await supabase.from('interbank_endpoints').update({
          error_count: (endpoint.error_count || 0) + 1,
        }).eq('id', endpoint.id);
        throw new Error(`HTTP ${response.status}: ${responseText.slice(0, 200)}`);
      }

      // Update last_seen
      await supabase.from('interbank_endpoints').update({
        last_seen_at: new Date().toISOString(),
      }).eq('id', endpoint.id);

      break;
    }

    case 'file': {
      // File mode: mark as awaiting_bank_processing
      // In production, would write to storage bucket
      console.log('File mode: instruction file would be generated for', creditorParticipantId);
      break;
    }

    case 'message_queue': {
      // Placeholder for future queue integration
      console.log('Message queue mode: would publish to', endpoint.queue_name);
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
