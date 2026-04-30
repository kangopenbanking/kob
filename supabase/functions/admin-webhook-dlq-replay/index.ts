// Slice 6 — Admin DLQ Replay
// Allows platform admins to manually replay a webhook that was moved to the DLQ.
// POST { dlq_id: string } -> resets attempt_count and re-enqueues into webhook_inbox.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_authorization' }, 401);

  // Verify caller is admin via has_role()
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'forbidden_admin_only' }, 403);

  let body: { dlq_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body.dlq_id || typeof body.dlq_id !== 'string') {
    return json({ error: 'missing_dlq_id' }, 400);
  }

  const { data: dlqRow, error: getErr } = await admin
    .from('webhook_inbox_dlq')
    .select('*')
    .eq('id', body.dlq_id)
    .single();

  if (getErr || !dlqRow) return json({ error: 'dlq_entry_not_found' }, 404);

  // Re-enqueue into webhook_inbox by resetting flags on original row (if still present)
  // or inserting a fresh row when original was purged.
  let inboxId = dlqRow.original_inbox_id as string | null;
  if (inboxId) {
    const { error: updErr } = await admin.from('webhook_inbox').update({
      is_processed: false,
      processed_at: null,
      processing_error: null,
      attempt_count: 0,
      next_retry_at: new Date().toISOString(),
      failed_permanently_at: null,
      dlq_reason: null,
      status: 'received',
    }).eq('id', inboxId);
    if (updErr) inboxId = null;
  }

  if (!inboxId) {
    const { data: inserted, error: insErr } = await admin.from('webhook_inbox').insert({
      source: dlqRow.source,
      provider: dlqRow.provider,
      event_id: `${dlqRow.event_id ?? crypto.randomUUID()}-replay-${Date.now()}`,
      event_type: dlqRow.event_type,
      payload: dlqRow.payload,
      signature: dlqRow.signature,
      is_processed: false,
      next_retry_at: new Date().toISOString(),
      status: 'received',
    }).select('id').single();
    if (insErr) return json({ error: insErr.message }, 500);
    inboxId = inserted!.id;
  }

  await admin.from('webhook_inbox_dlq').update({
    replayed_at: new Date().toISOString(),
    replay_status: 'enqueued',
  }).eq('id', body.dlq_id);

  await admin.from('audit_logs').insert({
    user_id: user.id,
    action: 'webhook_dlq_replay',
    entity_type: 'webhook_inbox_dlq',
    entity_id: body.dlq_id,
    metadata: { inbox_id: inboxId, source: dlqRow.source, event_id: dlqRow.event_id },
  });

  return json({ ok: true, inbox_id: inboxId, dlq_id: body.dlq_id, status: 'enqueued' });
});
