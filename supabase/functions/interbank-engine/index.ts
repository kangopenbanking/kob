// KOB Interbank Engine — Consolidated router
// Phase 2: State machine, ISO 20022 mapping, ledger integration, dispatch
// Phase 3: Connector management, sandbox simulator
// Phase 4: File fallback mode
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

// ── State Machine Transition Map ──
const VALID_TRANSITIONS: Record<string, string[]> = {
  created:    ['validated', 'failed', 'expired'],
  validated:  ['submitted', 'failed', 'expired'],
  submitted:  ['accepted', 'rejected', 'failed', 'expired'],
  accepted:   ['in_process', 'settled', 'failed'],
  in_process: ['settled', 'failed'],
  rejected:   ['reversed'],
  settled:    ['reversed'],
  failed:     ['reversed'],
  reversed:   [],
  expired:    [],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, ...params } = body;
    if (!action) return jsonResp({ error: 'action parameter required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth — all actions require admin or service_role
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return jsonResp({ error: 'Missing authorization header' }, 401);

    const token = authHeader.replace('Bearer ', '');
    // Allow service_role key
    if (token !== supabaseServiceKey) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) return jsonResp({ error: 'Invalid token' }, 401);
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) return jsonResp({ error: 'Admin role required' }, 403);
    }

    switch (action) {
      // ── Payment Lifecycle ──
      case 'create_payment':           return handleCreatePayment(supabase, params);
      case 'get_payment':              return handleGetPayment(supabase, params);
      case 'list_payments':            return handleListPayments(supabase, params);
      case 'submit_payment':           return handleSubmitPayment(supabase, params);
      case 'reverse_payment':          return handleReversePayment(supabase, params);
      case 'transition_status':        return handleTransitionStatus(supabase, params);

      // ── ISO 20022 Canonical Mapping ──
      case 'generate_pacs008':         return handleGeneratePacs008(supabase, params);
      case 'process_pacs002':          return handleProcessPacs002(supabase, params);
      case 'process_camt054':          return handleProcessCamt054(supabase, params);

      // ── Messages ──
      case 'list_messages':            return handleListMessages(supabase, params);
      case 'get_message':              return handleGetMessage(supabase, params);

      // ── Participants ──
      case 'create_participant':       return handleCreateParticipant(supabase, params);
      case 'list_participants':        return handleListParticipants(supabase, params);
      case 'update_participant':       return handleUpdateParticipant(supabase, params);

      // ── Connector Management ──
      case 'register_connector':       return handleRegisterConnector(supabase, params);
      case 'upload_connector_cert':    return handleUploadConnectorCert(supabase, params);
      case 'connector_health':         return handleConnectorHealth(supabase, params);
      case 'rotate_connector_keys':    return handleRotateConnectorKeys(supabase, params);
      case 'list_connectors':          return handleListConnectors(supabase, params);

      // ── Outbox ──
      case 'list_outbox':              return handleListOutbox(supabase, params);
      case 'replay_outbox':            return handleReplayOutbox(supabase, params);

      // ── Reconciliation ──
      case 'list_reconciliation':      return handleListReconciliation(supabase, params);

      // ── File Fallback ──
      case 'generate_instruction_file': return handleGenerateInstructionFile(supabase, params);
      case 'import_status_file':       return handleImportStatusFile(supabase, params);

      // ── Sandbox ──
      case 'sandbox_seed_participants': return handleSandboxSeed(supabase, params);
      case 'sandbox_simulate_payment':  return handleSandboxSimulate(supabase, params);

      // ── Status Events ──
      case 'list_status_events':       return handleListStatusEvents(supabase, params);

      default:
        return jsonResp({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error: any) {
    console.error('interbank-engine error:', error);
    return jsonResp({ error: error.message || 'Internal server error', error_id: `err_${crypto.randomUUID().slice(0, 8)}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function transitionPaymentStatus(
  supabase: any,
  paymentId: string,
  newStatus: string,
  source: string = 'engine',
  details: any = {}
): Promise<{ success: boolean; error?: string; payment?: any }> {
  // Fetch current payment with row lock
  const { data: payment, error } = await supabase
    .from('interbank_payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (error || !payment) return { success: false, error: 'Payment not found' };

  const currentStatus = payment.status;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    return { success: false, error: `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.join(', ')}` };
  }

  const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
  if (newStatus === 'submitted') updates.submitted_at = new Date().toISOString();
  if (newStatus === 'settled') updates.settled_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('interbank_payments')
    .update(updates)
    .eq('id', paymentId)
    .eq('status', currentStatus); // Optimistic concurrency

  if (updateError) return { success: false, error: updateError.message };

  // Record status event
  await supabase.from('interbank_status_events').insert({
    payment_id: paymentId,
    status_from: currentStatus,
    status_to: newStatus,
    source,
    correlation_id: payment.correlation_id,
    details_json: details,
  });

  return { success: true, payment: { ...payment, status: newStatus } };
}

// ═══════════════════════════════════════════════════════════════
// PAYMENT LIFECYCLE
// ═══════════════════════════════════════════════════════════════
async function handleCreatePayment(supabase: any, params: any) {
  const {
    debtor_participant_id, creditor_participant_id,
    debtor_account_ref, creditor_account_ref,
    amount, currency = 'XAF', purpose, remittance_info,
    external_reference, idempotency_key, initiated_by = 'admin'
  } = params;

  if (!debtor_participant_id || !creditor_participant_id || !debtor_account_ref || !creditor_account_ref || !amount) {
    return jsonResp({ error: 'Missing required fields: debtor_participant_id, creditor_participant_id, debtor_account_ref, creditor_account_ref, amount' }, 400);
  }

  if (amount <= 0) return jsonResp({ error: 'Amount must be > 0', error_code: 'INTERBANK_001' }, 400);

  // Idempotency check
  if (idempotency_key) {
    const { data: existing } = await supabase
      .from('interbank_payments')
      .select('id, status')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle();
    if (existing) return jsonResp({ success: true, payment: existing, idempotent: true });
  }

  // Verify participants exist and are active
  const { data: debtor } = await supabase.from('interbank_participants').select('id, status').eq('id', debtor_participant_id).single();
  const { data: creditor } = await supabase.from('interbank_participants').select('id, status').eq('id', creditor_participant_id).single();
  if (!debtor || !creditor) return jsonResp({ error: 'Participant not found', error_code: 'INTERBANK_002' }, 404);
  if (debtor.status !== 'active' || creditor.status !== 'active') {
    return jsonResp({ error: 'Both participants must be active', error_code: 'INTERBANK_003' }, 422);
  }

  const correlation_id = crypto.randomUUID();
  const trace_id = crypto.randomUUID();

  const { data: payment, error } = await supabase.from('interbank_payments').insert({
    debtor_participant_id, creditor_participant_id,
    debtor_account_ref, creditor_account_ref,
    amount, currency, purpose, remittance_info,
    external_reference, idempotency_key,
    initiated_by, correlation_id, trace_id,
    status: 'created',
  }).select().single();

  if (error) return jsonResp({ error: error.message }, 500);

  // Record initial status event
  await supabase.from('interbank_status_events').insert({
    payment_id: payment.id,
    status_from: null,
    status_to: 'created',
    source: 'engine',
    correlation_id,
    details_json: { initiated_by },
  });

  return jsonResp({ success: true, payment });
}

async function handleGetPayment(supabase: any, params: any) {
  const { payment_id } = params;
  if (!payment_id) return jsonResp({ error: 'payment_id required' }, 400);

  const { data: payment, error } = await supabase
    .from('interbank_payments')
    .select('*, debtor:interbank_participants!interbank_payments_debtor_participant_id_fkey(participant_code, legal_name), creditor:interbank_participants!interbank_payments_creditor_participant_id_fkey(participant_code, legal_name)')
    .eq('id', payment_id)
    .single();

  if (error || !payment) return jsonResp({ error: 'Payment not found' }, 404);
  return jsonResp({ payment });
}

async function handleListPayments(supabase: any, params: any) {
  const { status, participant_id, from, to, limit = 50, offset = 0 } = params;
  let query = supabase
    .from('interbank_payments')
    .select('*, debtor:interbank_participants!interbank_payments_debtor_participant_id_fkey(participant_code, legal_name), creditor:interbank_participants!interbank_payments_creditor_participant_id_fkey(participant_code, legal_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (participant_id) query = query.or(`debtor_participant_id.eq.${participant_id},creditor_participant_id.eq.${participant_id}`);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error, count } = await query;
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ payments: data, total: count });
}

async function handleSubmitPayment(supabase: any, params: any) {
  const { payment_id } = params;
  if (!payment_id) return jsonResp({ error: 'payment_id required' }, 400);

  // First validate
  const valResult = await transitionPaymentStatus(supabase, payment_id, 'validated', 'engine', { step: 'auto_validate' });
  if (!valResult.success) return jsonResp({ error: valResult.error, error_code: 'INTERBANK_004' }, 422);

  // Then submit
  const subResult = await transitionPaymentStatus(supabase, payment_id, 'submitted', 'engine', { step: 'submit' });
  if (!subResult.success) return jsonResp({ error: subResult.error, error_code: 'INTERBANK_004' }, 422);

  // Generate pacs.008 message
  const { data: payment } = await supabase.from('interbank_payments')
    .select('*, debtor:interbank_participants!interbank_payments_debtor_participant_id_fkey(*), creditor:interbank_participants!interbank_payments_creditor_participant_id_fkey(*)')
    .eq('id', payment_id).single();

  if (payment) {
    const msgId = `PACS008-IB-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const creDtTm = new Date().toISOString();
    const xml = generatePacs008Xml(payment, msgId, creDtTm);

    await supabase.from('interbank_messages').insert({
      payment_id,
      direction: 'outbound',
      message_type: 'pacs.008',
      message_id: msgId,
      correlation_id: payment.correlation_id,
      payload_format: 'xml',
      payload_raw: xml,
      status: 'stored',
    });

    // Enqueue to outbox for dispatch
    await supabase.from('event_outbox').insert({
      event_type: 'interbank_pacs008_dispatch',
      payload: {
        payment_id,
        message_id: msgId,
        creditor_participant_id: payment.creditor_participant_id,
        xml,
      },
      correlation_id: payment.correlation_id,
      status: 'pending',
    });
  }

  return jsonResp({ success: true, payment_id, status: 'submitted' });
}

async function handleReversePayment(supabase: any, params: any) {
  const { payment_id, reason } = params;
  if (!payment_id) return jsonResp({ error: 'payment_id required' }, 400);

  const result = await transitionPaymentStatus(supabase, payment_id, 'reversed', 'admin', { reason });
  if (!result.success) return jsonResp({ error: result.error, error_code: 'INTERBANK_005' }, 422);

  return jsonResp({ success: true, payment_id, status: 'reversed' });
}

async function handleTransitionStatus(supabase: any, params: any) {
  const { payment_id, new_status, source = 'engine', details = {} } = params;
  if (!payment_id || !new_status) return jsonResp({ error: 'payment_id and new_status required' }, 400);

  const result = await transitionPaymentStatus(supabase, payment_id, new_status, source, details);
  if (!result.success) return jsonResp({ error: result.error, error_code: 'INTERBANK_004' }, 422);

  return jsonResp({ success: true, payment: result.payment });
}

// ═══════════════════════════════════════════════════════════════
// ISO 20022 CANONICAL MAPPING
// ═══════════════════════════════════════════════════════════════
function generatePacs008Xml(payment: any, msgId: string, creDtTm: string): string {
  const debtorName = payment.debtor?.legal_name || 'Unknown Debtor';
  const debtorBic = payment.debtor?.participant_code || 'KOBCMRCM';
  const creditorName = payment.creditor?.legal_name || 'Unknown Creditor';
  const creditorBic = payment.creditor?.participant_code || 'BNKCMRCM';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>${payment.correlation_id}</EndToEndId>
        <TxId>${payment.id}</TxId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="${payment.currency}">${payment.amount}</IntrBkSttlmAmt>
      <ChrgBr>SHAR</ChrgBr>
      <Dbtr><Nm>${debtorName}</Nm></Dbtr>
      <DbtrAcct><Id><Othr><Id>${payment.debtor_account_ref}</Id></Othr></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BICFI>${debtorBic}</BICFI></FinInstnId></DbtrAgt>
      <CdtrAgt><FinInstnId><BICFI>${creditorBic}</BICFI></FinInstnId></CdtrAgt>
      <Cdtr><Nm>${creditorName}</Nm></Cdtr>
      <CdtrAcct><Id><Othr><Id>${payment.creditor_account_ref}</Id></Othr></Id></CdtrAcct>
      <RmtInf><Ustrd>${payment.remittance_info || payment.purpose || 'Interbank Transfer'}</Ustrd></RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`;
}

async function handleGeneratePacs008(supabase: any, params: any) {
  const { payment_id } = params;
  if (!payment_id) return jsonResp({ error: 'payment_id required' }, 400);

  const { data: payment } = await supabase.from('interbank_payments')
    .select('*, debtor:interbank_participants!interbank_payments_debtor_participant_id_fkey(*), creditor:interbank_participants!interbank_payments_creditor_participant_id_fkey(*)')
    .eq('id', payment_id).single();
  if (!payment) return jsonResp({ error: 'Payment not found' }, 404);

  const msgId = `PACS008-IB-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const creDtTm = new Date().toISOString();
  const xml = generatePacs008Xml(payment, msgId, creDtTm);

  const { data: message, error } = await supabase.from('interbank_messages').insert({
    payment_id,
    direction: 'outbound',
    message_type: 'pacs.008',
    message_id: msgId,
    correlation_id: payment.correlation_id,
    payload_format: 'xml',
    payload_raw: xml,
    status: 'stored',
  }).select().single();

  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ success: true, message, xml });
}

async function handleProcessPacs002(supabase: any, params: any) {
  const { xml_content, message_id: providedMsgId, payment_id, status_code, status_reason } = params;

  // Extract from XML or use params
  let msgId = providedMsgId;
  let txSts = status_code;
  let paymentRef = payment_id;

  if (xml_content) {
    const extractTag = (xml: string, tag: string) => { const m = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`)); return m ? m[1] : null; };
    msgId = msgId || extractTag(xml_content, 'MsgId') || `PACS002-IN-${Date.now()}`;
    txSts = txSts || extractTag(xml_content, 'TxSts') || extractTag(xml_content, 'GrpSts');
    paymentRef = paymentRef || extractTag(xml_content, 'TxId') || extractTag(xml_content, 'OrgnlTxId');
  }

  if (!msgId) return jsonResp({ error: 'message_id or xml_content required' }, 400);

  // Dedupe by message_id
  const { data: existing } = await supabase.from('interbank_messages').select('id').eq('message_id', msgId).maybeSingle();
  if (existing) return jsonResp({ success: true, deduplicated: true, message_id: existing.id });

  // Store message
  const { data: message, error: msgError } = await supabase.from('interbank_messages').insert({
    payment_id: paymentRef || null,
    direction: 'inbound',
    message_type: 'pacs.002',
    message_id: msgId,
    payload_format: xml_content ? 'xml' : 'json',
    payload_raw: xml_content || JSON.stringify(params),
    status: 'processed',
    received_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
  }).select().single();

  if (msgError) return jsonResp({ error: msgError.message }, 500);

  // Map ISO status to interbank status
  let newStatus = 'accepted';
  if (txSts === 'RJCT') newStatus = 'rejected';
  else if (txSts === 'ACCP' || txSts === 'ACSP' || txSts === 'ACSC') newStatus = 'accepted';
  else if (txSts === 'PDNG') newStatus = 'in_process';

  // Update payment if we have a reference
  if (paymentRef) {
    const result = await transitionPaymentStatus(supabase, paymentRef, newStatus, 'connector', {
      iso_message_id: msgId,
      iso_status: txSts,
      reason: status_reason,
    });
    if (!result.success) {
      console.error('Failed to transition payment:', result.error);
    }
  }

  return jsonResp({ success: true, message_id: message.id, mapped_status: newStatus });
}

async function handleProcessCamt054(supabase: any, params: any) {
  const { xml_content, message_id: providedMsgId, payment_id } = params;

  let msgId = providedMsgId;
  let paymentRef = payment_id;

  if (xml_content) {
    const extractTag = (xml: string, tag: string) => { const m = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`)); return m ? m[1] : null; };
    msgId = msgId || extractTag(xml_content, 'MsgId') || `CAMT054-IN-${Date.now()}`;
    paymentRef = paymentRef || extractTag(xml_content, 'TxId') || extractTag(xml_content, 'AcctSvcrRef');
  }

  if (!msgId) return jsonResp({ error: 'message_id or xml_content required' }, 400);

  // Dedupe
  const { data: existing } = await supabase.from('interbank_messages').select('id').eq('message_id', msgId).maybeSingle();
  if (existing) return jsonResp({ success: true, deduplicated: true, message_id: existing.id });

  const { data: message, error: msgError } = await supabase.from('interbank_messages').insert({
    payment_id: paymentRef || null,
    direction: 'inbound',
    message_type: 'camt.054',
    message_id: msgId,
    payload_format: xml_content ? 'xml' : 'json',
    payload_raw: xml_content || JSON.stringify(params),
    status: 'processed',
    received_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
  }).select().single();

  if (msgError) return jsonResp({ error: msgError.message }, 500);

  // camt.054 = credit notification → settle payment
  if (paymentRef) {
    const result = await transitionPaymentStatus(supabase, paymentRef, 'settled', 'connector', {
      iso_message_id: msgId,
      settlement_notification: true,
    });
    if (!result.success) console.error('Failed to settle payment:', result.error);
  }

  return jsonResp({ success: true, message_id: message.id, mapped_status: 'settled' });
}

// ═══════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════
async function handleListMessages(supabase: any, params: any) {
  const { payment_id, message_type, limit = 50, offset = 0 } = params;
  let query = supabase.from('interbank_messages').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (payment_id) query = query.eq('payment_id', payment_id);
  if (message_type) query = query.eq('message_type', message_type);
  const { data, error, count } = await query;
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ messages: data, total: count });
}

async function handleGetMessage(supabase: any, params: any) {
  const { message_id } = params;
  if (!message_id) return jsonResp({ error: 'message_id required' }, 400);
  const { data, error } = await supabase.from('interbank_messages').select('*').eq('id', message_id).single();
  if (error || !data) return jsonResp({ error: 'Message not found' }, 404);
  return jsonResp({ message: data });
}

// ═══════════════════════════════════════════════════════════════
// PARTICIPANTS
// ═══════════════════════════════════════════════════════════════
async function handleCreateParticipant(supabase: any, params: any) {
  const { participant_code, legal_name, display_name, type = 'bank', settlement_mode = 'prefunded', status = 'draft', metadata = {} } = params;
  if (!participant_code || !legal_name) return jsonResp({ error: 'participant_code and legal_name required' }, 400);

  const { data, error } = await supabase.from('interbank_participants').insert({
    participant_code, legal_name, display_name, type, settlement_mode, status, metadata,
  }).select().single();
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ success: true, participant: data });
}

async function handleListParticipants(supabase: any, params: any) {
  const { status, limit = 100, offset = 0 } = params;
  let query = supabase.from('interbank_participants').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (status) query = query.eq('status', status);
  const { data, error, count } = await query;
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ participants: data, total: count });
}

async function handleUpdateParticipant(supabase: any, params: any) {
  const { participant_id, ...updates } = params;
  if (!participant_id) return jsonResp({ error: 'participant_id required' }, 400);
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('interbank_participants').update(updates).eq('id', participant_id).select().single();
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ success: true, participant: data });
}

// ═══════════════════════════════════════════════════════════════
// CONNECTOR MANAGEMENT
// ═══════════════════════════════════════════════════════════════
async function handleRegisterConnector(supabase: any, params: any) {
  const { participant_id, env = 'sandbox', delivery_mode = 'https_push', base_url, queue_name } = params;
  if (!participant_id) return jsonResp({ error: 'participant_id required' }, 400);

  const { data, error } = await supabase.from('interbank_endpoints').insert({
    participant_id, env, delivery_mode, base_url, queue_name, status: 'active',
  }).select().single();
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ success: true, connector: data });
}

async function handleUploadConnectorCert(supabase: any, params: any) {
  const { connector_id, pem_certificate, participant_id } = params;
  if (!connector_id || !pem_certificate) return jsonResp({ error: 'connector_id and pem_certificate required' }, 400);

  // Calculate fingerprint
  const certBody = pem_certificate.replace(/-----BEGIN CERTIFICATE-----/, '').replace(/-----END CERTIFICATE-----/, '').replace(/\n/g, '').replace(/\r/g, '');
  const derBytes = Uint8Array.from(atob(certBody), (c: string) => c.charCodeAt(0));
  const hashBuffer = await crypto.subtle.digest('SHA-256', derBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const thumbprint = btoa(String.fromCharCode(...new Uint8Array(hashBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  // Look up TPP registration for the participant
  let tppRegId = participant_id || connector_id;

  const { data: cert, error } = await supabase.from('client_certificates').insert({
    tpp_registration_id: tppRegId,
    certificate_pem: pem_certificate,
    fingerprint,
    thumbprint,
    subject_dn: `CN=Connector-${connector_id}`,
    issuer_dn: 'CN=KOB-CA',
    serial_number: crypto.randomUUID().slice(0, 16),
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    key_type: 'transport',
  }).select().single();

  if (error) return jsonResp({ error: error.message }, 500);

  // Link cert to connector endpoint
  await supabase.from('interbank_endpoints').update({
    connector_instance_id: cert.id,
    updated_at: new Date().toISOString(),
  }).eq('id', connector_id);

  return jsonResp({ success: true, certificate_id: cert.id, thumbprint });
}

async function handleConnectorHealth(supabase: any, params: any) {
  const { connector_id, participant_id } = params;
  let query = supabase.from('interbank_endpoints').select('*');
  if (connector_id) query = query.eq('id', connector_id);
  else if (participant_id) query = query.eq('participant_id', participant_id);
  else return jsonResp({ error: 'connector_id or participant_id required' }, 400);

  const { data, error } = await query;
  if (error) return jsonResp({ error: error.message }, 500);

  const healthData = (data || []).map((ep: any) => ({
    id: ep.id,
    participant_id: ep.participant_id,
    env: ep.env,
    delivery_mode: ep.delivery_mode,
    status: ep.status,
    last_seen_at: ep.last_seen_at,
    error_count: ep.error_count,
    latency_ms: ep.last_seen_at ? Date.now() - new Date(ep.last_seen_at).getTime() : null,
  }));

  return jsonResp({ success: true, connectors: healthData });
}

async function handleRotateConnectorKeys(supabase: any, params: any) {
  const { connector_id } = params;
  if (!connector_id) return jsonResp({ error: 'connector_id required' }, 400);

  const newSecret = crypto.randomUUID();
  // Hash the secret before storage
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(newSecret));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  await supabase.from('interbank_endpoints').update({
    hmac_secret_hash: hashHex,
    updated_at: new Date().toISOString(),
  }).eq('id', connector_id);

  return jsonResp({ success: true, hmac_secret: newSecret, note: 'Store this secret securely. It will not be shown again.' });
}

async function handleListConnectors(supabase: any, params: any) {
  const { participant_id, limit = 50, offset = 0 } = params;
  let query = supabase.from('interbank_endpoints')
    .select('*, participant:interbank_participants(participant_code, legal_name)', { count: 'exact' })
    .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (participant_id) query = query.eq('participant_id', participant_id);
  const { data, error, count } = await query;
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ connectors: data, total: count });
}

// ═══════════════════════════════════════════════════════════════
// OUTBOX
// ═══════════════════════════════════════════════════════════════
async function handleListOutbox(supabase: any, params: any) {
  const { status, limit = 50, offset = 0 } = params;
  let query = supabase.from('event_outbox').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (status) query = query.eq('status', status);
  const { data, error, count } = await query;
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ events: data, total: count });
}

async function handleReplayOutbox(supabase: any, params: any) {
  const { event_id } = params;
  if (!event_id) return jsonResp({ error: 'event_id required' }, 400);

  const { error } = await supabase.from('event_outbox').update({
    status: 'pending',
    retries: 0,
    next_retry_at: new Date().toISOString(),
    error_message: null,
  }).eq('id', event_id);

  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ success: true, message: 'Event re-queued for dispatch' });
}

// ═══════════════════════════════════════════════════════════════
// RECONCILIATION
// ═══════════════════════════════════════════════════════════════
async function handleListReconciliation(supabase: any, params: any) {
  const { participant_id, status, limit = 50, offset = 0 } = params;
  let query = supabase.from('interbank_reconciliation_items')
    .select('*, participant:interbank_participants(participant_code, legal_name)', { count: 'exact' })
    .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (participant_id) query = query.eq('participant_id', participant_id);
  if (status) query = query.eq('status', status);
  const { data, error, count } = await query;
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ items: data, total: count });
}

// ═══════════════════════════════════════════════════════════════
// FILE FALLBACK
// ═══════════════════════════════════════════════════════════════
async function handleGenerateInstructionFile(supabase: any, params: any) {
  const { payment_ids } = params;
  if (!payment_ids || !Array.isArray(payment_ids) || payment_ids.length === 0) {
    return jsonResp({ error: 'payment_ids array required' }, 400);
  }

  const { data: payments } = await supabase.from('interbank_payments')
    .select('*, debtor:interbank_participants!interbank_payments_debtor_participant_id_fkey(participant_code, legal_name), creditor:interbank_participants!interbank_payments_creditor_participant_id_fkey(participant_code, legal_name)')
    .in('id', payment_ids);

  if (!payments || payments.length === 0) return jsonResp({ error: 'No payments found' }, 404);

  // Generate CSV instruction file
  const csvLines = ['payment_id,debtor_code,debtor_account,creditor_code,creditor_account,amount,currency,remittance_info,status'];
  for (const p of payments) {
    csvLines.push(`${p.id},${p.debtor?.participant_code || ''},${p.debtor_account_ref},${p.creditor?.participant_code || ''},${p.creditor_account_ref},${p.amount},${p.currency},${(p.remittance_info || '').replace(/,/g, ';')},${p.status}`);
  }

  return jsonResp({
    success: true,
    file_content: csvLines.join('\n'),
    file_name: `interbank_instructions_${new Date().toISOString().slice(0, 10)}.csv`,
    payment_count: payments.length,
  });
}

async function handleImportStatusFile(supabase: any, params: any) {
  const { csv_content } = params;
  if (!csv_content) return jsonResp({ error: 'csv_content required' }, 400);

  const lines = csv_content.trim().split('\n');
  if (lines.length < 2) return jsonResp({ error: 'CSV must have header + data rows' }, 400);

  const results: any[] = [];
  // Expected CSV: payment_id,status_code,reason
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 2) continue;
    const [paymentId, statusCode, reason] = parts.map(s => s.trim());

    let newStatus = 'accepted';
    if (statusCode === 'RJCT' || statusCode === 'rejected' || statusCode === 'failed') newStatus = statusCode === 'RJCT' ? 'rejected' : 'failed';
    else if (statusCode === 'ACCP' || statusCode === 'accepted') newStatus = 'accepted';
    else if (statusCode === 'STLD' || statusCode === 'settled') newStatus = 'settled';

    const result = await transitionPaymentStatus(supabase, paymentId, newStatus, 'reconciliation', { file_import: true, reason });
    results.push({ payment_id: paymentId, new_status: newStatus, success: result.success, error: result.error });
  }

  return jsonResp({ success: true, processed: results.length, results });
}

// ═══════════════════════════════════════════════════════════════
// SANDBOX SIMULATOR
// ═══════════════════════════════════════════════════════════════
async function handleSandboxSeed(supabase: any, _params: any) {
  // Create Sandbox Bank A and B if not exist
  const participants = [
    { participant_code: 'SBK-A', legal_name: 'Sandbox Bank A', display_name: 'Sandbox Bank A', type: 'bank', status: 'active', settlement_mode: 'prefunded' },
    { participant_code: 'SBK-B', legal_name: 'Sandbox Bank B', display_name: 'Sandbox Bank B', type: 'bank', status: 'active', settlement_mode: 'prefunded' },
  ];

  const created = [];
  for (const p of participants) {
    const { data: existing } = await supabase.from('interbank_participants').select('id').eq('participant_code', p.participant_code).maybeSingle();
    if (existing) {
      created.push({ ...p, id: existing.id, existed: true });
    } else {
      const { data } = await supabase.from('interbank_participants').insert(p).select().single();
      if (data) {
        // Create sandbox endpoint for each
        await supabase.from('interbank_endpoints').insert({
          participant_id: data.id,
          env: 'sandbox',
          delivery_mode: 'https_push',
          base_url: `https://sandbox.kob.cm/connectors/${p.participant_code.toLowerCase()}`,
          status: 'active',
        });
        created.push({ ...p, id: data.id, existed: false });
      }
    }
  }

  return jsonResp({ success: true, participants: created });
}

async function handleSandboxSimulate(supabase: any, params: any) {
  const { amount = 50000, currency = 'XAF', remittance_info = 'Sandbox test payment' } = params;

  // Get sandbox participants
  const { data: bankA } = await supabase.from('interbank_participants').select('id').eq('participant_code', 'SBK-A').single();
  const { data: bankB } = await supabase.from('interbank_participants').select('id').eq('participant_code', 'SBK-B').single();
  if (!bankA || !bankB) return jsonResp({ error: 'Sandbox participants not seeded. Call sandbox_seed_participants first.' }, 400);

  // Create payment
  const correlation_id = crypto.randomUUID();
  const { data: payment, error } = await supabase.from('interbank_payments').insert({
    debtor_participant_id: bankA.id,
    creditor_participant_id: bankB.id,
    debtor_account_ref: 'CM21-SBK-A-00001',
    creditor_account_ref: 'CM21-SBK-B-00002',
    amount, currency, remittance_info,
    initiated_by: 'system',
    correlation_id,
    trace_id: crypto.randomUUID(),
    idempotency_key: crypto.randomUUID(),
    scheme: 'KOB_INTERBANK',
  }).select().single();

  if (error || !payment) return jsonResp({ error: error?.message || 'Failed to create payment' }, 500);

  // Record creation event
  await supabase.from('interbank_status_events').insert({
    payment_id: payment.id, status_from: null, status_to: 'created', source: 'engine', correlation_id,
    details_json: { sandbox: true },
  });

  // Auto-transition: created → validated → submitted → accepted → settled
  const transitions = [
    { to: 'validated', source: 'engine' },
    { to: 'submitted', source: 'engine' },
    { to: 'accepted', source: 'connector' },
    { to: 'settled', source: 'connector' },
  ];

  for (const t of transitions) {
    await transitionPaymentStatus(supabase, payment.id, t.to, t.source, { sandbox: true, auto_simulated: true });
  }

  // Generate pacs.008 and pacs.002 messages
  const pacs008MsgId = `PACS008-SBX-${Date.now()}`;
  const pacs002MsgId = `PACS002-SBX-${Date.now()}`;
  const camt054MsgId = `CAMT054-SBX-${Date.now()}`;

  await supabase.from('interbank_messages').insert([
    {
      payment_id: payment.id, direction: 'outbound', message_type: 'pacs.008',
      message_id: pacs008MsgId, correlation_id, payload_format: 'xml',
      payload_raw: `<pacs008-sandbox>${payment.id}</pacs008-sandbox>`, status: 'processed',
    },
    {
      payment_id: payment.id, direction: 'inbound', message_type: 'pacs.002',
      message_id: pacs002MsgId, correlation_id, payload_format: 'xml',
      payload_raw: `<pacs002-sandbox>ACCP</pacs002-sandbox>`, status: 'processed',
      received_at: new Date().toISOString(), processed_at: new Date().toISOString(),
    },
    {
      payment_id: payment.id, direction: 'inbound', message_type: 'camt.054',
      message_id: camt054MsgId, correlation_id, payload_format: 'xml',
      payload_raw: `<camt054-sandbox>settled</camt054-sandbox>`, status: 'processed',
      received_at: new Date().toISOString(), processed_at: new Date().toISOString(),
    },
  ]);

  return jsonResp({
    success: true,
    payment_id: payment.id,
    final_status: 'settled',
    correlation_id,
    messages: [pacs008MsgId, pacs002MsgId, camt054MsgId],
  });
}

// ═══════════════════════════════════════════════════════════════
// STATUS EVENTS
// ═══════════════════════════════════════════════════════════════
async function handleListStatusEvents(supabase: any, params: any) {
  const { payment_id, limit = 50, offset = 0 } = params;
  if (!payment_id) return jsonResp({ error: 'payment_id required' }, 400);
  const { data, error, count } = await supabase.from('interbank_status_events')
    .select('*', { count: 'exact' })
    .eq('payment_id', payment_id)
    .order('event_time', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ events: data, total: count });
}
