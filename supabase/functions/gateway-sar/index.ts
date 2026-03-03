import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateUserRole } from "../_shared/role-middleware.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `https://api.kangopenbanking.com/errors/${type}`, title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Admin-only for SAR management
  const roleResult = await validateUserRole(req, ['admin']);
  if (!roleResult.valid) {
    return rfc7807('unauthorized', 'Unauthorized', roleResult.error === 'Missing authorization header' ? 401 : 403, roleResult.error!);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const sarId = pathParts[1] || null;
  const action = pathParts[2] || null;

  try {
    // POST / — File new SAR
    if (req.method === 'POST' && !sarId) {
      return await createSar(supabase, roleResult, req);
    }

    // GET / — List SARs
    if (req.method === 'GET' && !sarId) {
      return await listSars(supabase, url);
    }

    // GET /{id} — Get SAR details
    if (req.method === 'GET' && sarId && !action) {
      return await getSar(supabase, sarId);
    }

    // PATCH /{id} — Update SAR
    if (req.method === 'PATCH' && sarId && !action) {
      return await updateSar(supabase, roleResult, sarId, req);
    }

    // POST /{id}/submit — Submit draft SAR
    if (req.method === 'POST' && sarId && action === 'submit') {
      return await transitionSar(supabase, roleResult, sarId, 'draft', 'submitted');
    }

    // POST /{id}/review — Mark as under review
    if (req.method === 'POST' && sarId && action === 'review') {
      return await transitionSar(supabase, roleResult, sarId, 'submitted', 'under_review');
    }

    // POST /{id}/escalate — Escalate SAR
    if (req.method === 'POST' && sarId && action === 'escalate') {
      return await escalateSar(supabase, roleResult, sarId, req);
    }

    // POST /{id}/close — Close SAR
    if (req.method === 'POST' && sarId && action === 'close') {
      return await closeSar(supabase, roleResult, sarId, req);
    }

    // GET /{id}/events — SAR event history
    if (req.method === 'GET' && sarId && action === 'events') {
      return await getSarEvents(supabase, sarId);
    }

    // POST /{id}/note — Add note to SAR
    if (req.method === 'POST' && sarId && action === 'note') {
      return await addNote(supabase, roleResult, sarId, req);
    }

    // GET /stats — SAR dashboard stats
    if (req.method === 'GET' && pathParts[0] === 'gateway-sar' && pathParts[1] === 'stats') {
      return await getSarStats(supabase);
    }

    return rfc7807('not_found', 'Not Found', 404, `Route not matched: ${req.method} ${url.pathname}`);
  } catch (err: any) {
    console.error('[gateway-sar] Error:', err);
    return rfc7807('internal_error', 'Internal Server Error', 500, err.message || 'Unexpected error');
  }
});

// ─── Create SAR ───
async function createSar(supabase: any, roleResult: any, req: Request) {
  const body = await req.json();
  const {
    subject_name, subject_type, subject_user_id, subject_merchant_id,
    activity_type, severity = 'medium', summary, detailed_narrative,
    suspicious_transactions, supporting_evidence, risk_indicators,
    amount_involved, currency = 'XAF', activity_start_date, activity_end_date,
    metadata,
  } = body;

  if (!subject_name || !subject_type || !activity_type || !summary) {
    return rfc7807('validation_error', 'Validation Error', 400, 'subject_name, subject_type, activity_type, and summary are required');
  }

  const reportNumber = `SAR-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

  const { data: sar, error } = await supabase.from('suspicious_activity_reports').insert({
    report_number: reportNumber,
    subject_user_id, subject_merchant_id, subject_name, subject_type,
    activity_type, severity, status: 'draft', summary, detailed_narrative,
    suspicious_transactions: suspicious_transactions || [],
    supporting_evidence: supporting_evidence || [],
    risk_indicators: risk_indicators || [],
    amount_involved, currency, activity_start_date, activity_end_date,
    filed_by: roleResult.userId, metadata: metadata || {},
  }).select().single();

  if (error) throw error;

  // Record SAR event
  await supabase.from('sar_events').insert({
    sar_id: sar.id, event_type: 'created', performed_by: roleResult.userId,
    new_status: 'draft', notes: `SAR ${reportNumber} filed`,
  });

  await supabase.from('audit_logs').insert({
    action_type: 'sar_created', entity_type: 'sar', entity_id: sar.id,
    performed_by: roleResult.userId, details: { report_number: reportNumber, activity_type, severity },
  });

  return json(sar, 201);
}

// ─── List SARs ───
async function listSars(supabase: any, url: URL) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const status = url.searchParams.get('status');
  const severity = url.searchParams.get('severity');
  const activityType = url.searchParams.get('activity_type');

  let query = supabase.from('suspicious_activity_reports').select('*', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (severity) query = query.eq('severity', severity);
  if (activityType) query = query.eq('activity_type', activityType);

  query = query.order('filed_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count } = await query;
  return json({ reports: data || [], pagination: { total: count, limit, offset } });
}

// ─── Get SAR ───
async function getSar(supabase: any, sarId: string) {
  const { data: sar } = await supabase.from('suspicious_activity_reports').select('*').eq('id', sarId).single();
  if (!sar) return rfc7807('not_found', 'Not Found', 404, 'SAR not found');

  // Include event count
  const { count: eventCount } = await supabase
    .from('sar_events')
    .select('*', { count: 'exact', head: true })
    .eq('sar_id', sarId);

  return json({ ...sar, event_count: eventCount });
}

// ─── Update SAR ───
async function updateSar(supabase: any, roleResult: any, sarId: string, req: Request) {
  const { data: existing } = await supabase
    .from('suspicious_activity_reports').select('status').eq('id', sarId).single();
  if (!existing) return rfc7807('not_found', 'Not Found', 404, 'SAR not found');
  if (!['draft', 'submitted'].includes(existing.status)) {
    return rfc7807('invalid_state', 'Invalid State', 409, 'Only draft or submitted SARs can be updated');
  }

  const body = await req.json();
  const allowed = [
    'summary', 'detailed_narrative', 'suspicious_transactions', 'supporting_evidence',
    'risk_indicators', 'amount_involved', 'currency', 'activity_start_date', 'activity_end_date',
    'severity', 'metadata',
  ];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return rfc7807('validation_error', 'Validation Error', 400, 'No valid fields to update');
  }

  const { data: sar, error } = await supabase
    .from('suspicious_activity_reports')
    .update(updates)
    .eq('id', sarId)
    .select()
    .single();

  if (error) throw error;
  return json(sar);
}

// ─── Transition SAR Status ───
async function transitionSar(supabase: any, roleResult: any, sarId: string, fromStatus: string, toStatus: string) {
  const { data: sar } = await supabase
    .from('suspicious_activity_reports').select('id, status').eq('id', sarId).single();
  if (!sar) return rfc7807('not_found', 'Not Found', 404, 'SAR not found');
  if (sar.status !== fromStatus) {
    return rfc7807('invalid_state', 'Invalid State', 409, `SAR must be in '${fromStatus}' status, currently '${sar.status}'`);
  }

  const updateData: any = { status: toStatus };
  if (toStatus === 'under_review') {
    updateData.reviewed_by = roleResult.userId;
    updateData.reviewed_at = new Date().toISOString();
  }

  await supabase.from('suspicious_activity_reports').update(updateData).eq('id', sarId);

  await supabase.from('sar_events').insert({
    sar_id: sarId, event_type: toStatus === 'submitted' ? 'submitted' : 'reviewed',
    performed_by: roleResult.userId, previous_status: fromStatus, new_status: toStatus,
  });

  return json({ sar_id: sarId, status: toStatus });
}

// ─── Escalate SAR ───
async function escalateSar(supabase: any, roleResult: any, sarId: string, req: Request) {
  const { data: sar } = await supabase
    .from('suspicious_activity_reports').select('id, status').eq('id', sarId).single();
  if (!sar) return rfc7807('not_found', 'Not Found', 404, 'SAR not found');
  if (!['submitted', 'under_review'].includes(sar.status)) {
    return rfc7807('invalid_state', 'Invalid State', 409, 'Only submitted or under_review SARs can be escalated');
  }

  const body = await req.json();
  const { escalated_to, notes } = body;
  if (!escalated_to) return rfc7807('validation_error', 'Validation Error', 400, 'escalated_to is required');

  await supabase.from('suspicious_activity_reports').update({
    status: 'escalated', escalated_to, escalated_at: new Date().toISOString(),
  }).eq('id', sarId);

  await supabase.from('sar_events').insert({
    sar_id: sarId, event_type: 'escalated', performed_by: roleResult.userId,
    previous_status: sar.status, new_status: 'escalated',
    notes: notes || `Escalated to ${escalated_to}`,
  });

  return json({ sar_id: sarId, status: 'escalated', escalated_to });
}

// ─── Close SAR ───
async function closeSar(supabase: any, roleResult: any, sarId: string, req: Request) {
  const { data: sar } = await supabase
    .from('suspicious_activity_reports').select('id, status').eq('id', sarId).single();
  if (!sar) return rfc7807('not_found', 'Not Found', 404, 'SAR not found');
  if (sar.status === 'draft') {
    return rfc7807('invalid_state', 'Invalid State', 409, 'Cannot close a draft SAR, submit it first');
  }

  const body = await req.json();
  const { action_taken = true, closure_notes, regulatory_reference } = body;
  if (!closure_notes) return rfc7807('validation_error', 'Validation Error', 400, 'closure_notes required');

  const closureStatus = action_taken ? 'closed_action_taken' : 'closed_no_action';

  await supabase.from('suspicious_activity_reports').update({
    status: closureStatus, closed_at: new Date().toISOString(),
    closure_notes, regulatory_reference,
  }).eq('id', sarId);

  await supabase.from('sar_events').insert({
    sar_id: sarId, event_type: 'closed', performed_by: roleResult.userId,
    previous_status: sar.status, new_status: closureStatus, notes: closure_notes,
  });

  return json({ sar_id: sarId, status: closureStatus, closed_at: new Date().toISOString() });
}

// ─── SAR Events ───
async function getSarEvents(supabase: any, sarId: string) {
  const { data: sar } = await supabase
    .from('suspicious_activity_reports').select('id').eq('id', sarId).single();
  if (!sar) return rfc7807('not_found', 'Not Found', 404, 'SAR not found');

  const { data: events } = await supabase
    .from('sar_events')
    .select('*')
    .eq('sar_id', sarId)
    .order('created_at', { ascending: true });

  return json({ sar_id: sarId, events: events || [] });
}

// ─── Add Note ───
async function addNote(supabase: any, roleResult: any, sarId: string, req: Request) {
  const { data: sar } = await supabase
    .from('suspicious_activity_reports').select('id').eq('id', sarId).single();
  if (!sar) return rfc7807('not_found', 'Not Found', 404, 'SAR not found');

  const body = await req.json();
  if (!body.notes) return rfc7807('validation_error', 'Validation Error', 400, 'notes field is required');

  const { data: event, error } = await supabase.from('sar_events').insert({
    sar_id: sarId, event_type: 'note_added', performed_by: roleResult.userId,
    notes: body.notes, metadata: body.metadata || {},
  }).select().single();

  if (error) throw error;
  return json(event, 201);
}

// ─── SAR Stats ───
async function getSarStats(supabase: any) {
  const { data: all } = await supabase
    .from('suspicious_activity_reports')
    .select('status, severity, activity_type, amount_involved');

  const stats = {
    total: (all || []).length,
    by_status: {} as Record<string, number>,
    by_severity: {} as Record<string, number>,
    by_activity_type: {} as Record<string, number>,
    total_amount_involved: 0,
  };

  for (const sar of all || []) {
    stats.by_status[sar.status] = (stats.by_status[sar.status] || 0) + 1;
    stats.by_severity[sar.severity] = (stats.by_severity[sar.severity] || 0) + 1;
    stats.by_activity_type[sar.activity_type] = (stats.by_activity_type[sar.activity_type] || 0) + 1;
    stats.total_amount_involved += Number(sar.amount_involved || 0);
  }

  return json(stats);
}
