// nium-request-name-correction
// Submits a beneficiary-name correction request (user) OR decides it (admin)
// with maker-checker validation: two different admins must act (propose +
// confirm) before profiles.full_name is updated and affected global accounts
// are closed for re-issue. Customer in-app notifications are emitted on
// submit, maker-proposal, approval, and rejection.
//
// COMPLIANCE CHECK: name updates only land in profiles.full_name AFTER admin
// approval — never from free-text on the client. Affected Nium global accounts
// are marked `closed_pending_reissue` so the user can regenerate them with the
// corrected verified name (PoP + KYC-name lock still apply on re-issue).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { sendManagedEmail, getUserName, getUserEmail } from '../_shared/send-managed-email.ts';

// Helpers: build the audit-friendly variable bundle for the lifecycle emails.
async function resolveInstitutionName(admin: ReturnType<typeof createClient>, userId: string): Promise<string> {
  try {
    const { data: p } = await admin.from('profiles').select('institution_id').eq('id', userId).maybeSingle();
    const iid = (p as any)?.institution_id;
    if (!iid) return 'Kang Open Banking';
    const { data: inst } = await admin.from('institutions').select('name').eq('id', iid).maybeSingle();
    return (inst as any)?.name || 'Kang Open Banking';
  } catch { return 'Kang Open Banking'; }
}

function shortId(uuid: string): string {
  return uuid.slice(0, 8).toUpperCase();
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const SubmitSchema = z.object({
  action: z.literal('submit'),
  requested_full_name: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(10).max(500),
  document_type: z.enum(['national_id', 'passport', 'drivers_license']),
  document_number: z.string().trim().max(64).optional(),
  document_front_url: z.string().trim().min(1).max(1024),
  document_back_url: z.string().trim().max(1024).optional(),
  selfie_url: z.string().trim().max(1024).optional(),
});

const DecideSchema = z.object({
  action: z.literal('decide'),
  request_id: z.string().uuid(),
  // 'maker' records the proposed decision; 'checker' finalises it.
  // COMPLIANCE CHECK: checker MUST differ from maker (DB trigger + app check).
  stage: z.enum(['maker', 'checker']).default('checker'),
  decision: z.enum(['approved', 'rejected']),
  decision_note: z.string().trim().max(500).optional(),
});

const BodySchema = z.discriminatedUnion('action', [SubmitSchema, DecideSchema]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function notify(
  admin: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  message: string,
  metadata: Record<string, unknown>,
  idempotencyKey: string,
) {
  try {
    await admin.from('app_notifications').insert({
      user_id: userId,
      type: 'kyc',
      icon: 'kyc',
      title,
      message,
      metadata,
      idempotency_key: idempotencyKey,
    });
  } catch (_e) {
    // best-effort: never block the workflow on a notification failure
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const user = userData.user;

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!parsed.success) {
    return json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── SUBMIT ────────────────────────────────────────────────────────────────
  if (parsed.data.action === 'submit') {
    const p = parsed.data;

    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profErr) return json({ error: 'profile_lookup_failed' }, 500);

    const currentName = profile?.full_name?.trim() ?? '';
    if (currentName && currentName.toLowerCase() === p.requested_full_name.toLowerCase()) {
      return json({ error: 'name_unchanged' }, 400);
    }

    const { data: openReq } = await admin
      .from('nium_name_correction_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (openReq) return json({ error: 'request_already_pending', request_id: openReq.id }, 409);

    const { data: accts } = await admin
      .from('nium_global_accounts')
      .select('id')
      .eq('user_id', user.id)
      .neq('status', 'closed');
    const affected = (accts ?? []).map((a) => a.id);

    const { data: inserted, error: insErr } = await admin
      .from('nium_name_correction_requests')
      .insert({
        user_id: user.id,
        current_full_name: currentName,
        requested_full_name: p.requested_full_name,
        reason: p.reason,
        document_type: p.document_type,
        document_number: p.document_number ?? null,
        document_front_url: p.document_front_url,
        document_back_url: p.document_back_url ?? null,
        selfie_url: p.selfie_url ?? null,
        affected_account_ids: affected,
      })
      .select('id, status, created_at')
      .single();
    if (insErr) return json({ error: 'insert_failed', message: insErr.message }, 500);

    await notify(
      admin,
      user.id,
      'Name correction submitted',
      'We received your beneficiary name correction request and your documents are now under review. We will notify you once a decision is made.',
      { request_id: inserted.id, kind: 'nium_name_correction', stage: 'submitted' },
      `nium-name-correction-submitted-${inserted.id}`,
    );

    // Managed-pipeline email (branded, queued, retried, suppression-aware).
    const customerName = await getUserName(admin, user.id);
    const institutionName = await resolveInstitutionName(admin, user.id);
    await sendManagedEmail(admin, {
      email_key: 'nium_name_correction_submitted',
      recipient_user_id: user.id,
      variables: {
        customer_name: customerName,
        request_id: inserted.id,
        request_id_short: shortId(inserted.id),
        submitted_at: new Date(inserted.created_at as string).toISOString(),
        current_full_name: currentName || '—',
        requested_full_name: p.requested_full_name,
        document_type: p.document_type,
        institution_name: institutionName,
      },
    });


    return json({ ok: true, request: inserted }, 201);
  }

  // ── DECIDE (RBAC-gated) ───────────────────────────────────────────────────
  // COMPLIANCE CHECK: strict RBAC — only `compliance_officer` (or admin) may
  // act as MAKER; only `admin` may act as CHECKER (approve/reject).
  const d = parsed.data;
  const [{ data: isAdmin }, { data: isCompliance }] = await Promise.all([
    admin.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
    admin.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' }),
  ]);

  if (d.stage === 'maker' && !isAdmin && !isCompliance) {
    return json({ error: 'forbidden_maker_role_required' }, 403);
  }
  if (d.stage === 'checker' && !isAdmin) {
    // COMPLIANCE CHECK: only admin checkers can finalize approve/reject
    return json({ error: 'forbidden_checker_admin_only' }, 403);
  }

  const { data: reqRow, error: fetchErr } = await admin
    .from('nium_name_correction_requests')
    .select('*')
    .eq('id', d.request_id)
    .single();
  if (fetchErr || !reqRow) return json({ error: 'request_not_found' }, 404);
  if (reqRow.status !== 'pending') return json({ error: 'request_not_pending' }, 409);


  // ── MAKER STAGE: record proposal, no state change yet ──────────────────────
  if (d.stage === 'maker') {
    if (reqRow.maker_id) {
      return json({ error: 'maker_already_recorded', maker_id: reqRow.maker_id }, 409);
    }
    const { error: makerErr } = await admin
      .from('nium_name_correction_requests')
      .update({
        maker_id: user.id,
        maker_at: new Date().toISOString(),
        maker_decision: d.decision,
        maker_note: d.decision_note ?? null,
      })
      .eq('id', d.request_id);
    if (makerErr) return json({ error: 'maker_update_failed', message: makerErr.message }, 500);

    await notify(
      admin,
      reqRow.user_id,
      'Name correction under review',
      `A compliance reviewer has assessed your request and proposed: ${d.decision}. A second reviewer will confirm shortly.`,
      { request_id: reqRow.id, kind: 'nium_name_correction', stage: 'maker', proposed: d.decision },
      `nium-name-correction-maker-${reqRow.id}`,
    );
    return json({ ok: true, status: 'pending', stage: 'maker_recorded', proposed: d.decision });
  }

  // ── CHECKER STAGE: enforce maker-checker, then finalise ───────────────────
  if (!reqRow.maker_id) {
    return json({ error: 'maker_required_first' }, 409);
  }
  if (reqRow.maker_id === user.id) {
    // COMPLIANCE CHECK: checker must differ from maker
    return json({ error: 'maker_checker_violation' }, 403);
  }
  if (reqRow.maker_decision && reqRow.maker_decision !== d.decision) {
    return json(
      { error: 'maker_checker_disagreement', maker_decision: reqRow.maker_decision },
      409,
    );
  }

  if (d.decision === 'rejected') {
    const { error: updErr } = await admin
      .from('nium_name_correction_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        decision_note: d.decision_note ?? null,
      })
      .eq('id', d.request_id);
    if (updErr) return json({ error: 'update_failed', message: updErr.message }, 500);

    await notify(
      admin,
      reqRow.user_id,
      'Name correction rejected',
      d.decision_note
        ? `Your request was not approved. Reviewer note: ${d.decision_note}`
        : 'Your name correction request was not approved. Please submit a new request with clearer government-issued documents.',
      { request_id: reqRow.id, kind: 'nium_name_correction', stage: 'rejected' },
      `nium-name-correction-rejected-${reqRow.id}`,
    );
    return json({ ok: true, status: 'rejected' });
  }

  // APPROVAL flow
  const newName = reqRow.requested_full_name as string;

  await admin
    .from('kyc_verifications')
    .update({ status: 'superseded', updated_at: new Date().toISOString() })
    .eq('user_id', reqRow.user_id)
    .in('status', ['pending', 'approved']);

  const { data: kycRow, error: kycErr } = await admin
    .from('kyc_verifications')
    .insert({
      user_id: reqRow.user_id,
      verification_type: 'name_correction',
      status: 'approved',
      document_type: reqRow.document_type,
      document_number: reqRow.document_number,
      document_front_url: reqRow.document_front_url,
      document_back_url: reqRow.document_back_url,
      selfie_url: reqRow.selfie_url,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      metadata: {
        source: 'nium_name_correction',
        previous_full_name: reqRow.current_full_name,
        new_full_name: newName,
        correction_request_id: reqRow.id,
        maker_id: reqRow.maker_id,
        checker_id: user.id,
      },
    })
    .select('id')
    .single();
  if (kycErr) return json({ error: 'kyc_insert_failed', message: kycErr.message }, 500);

  const { error: profUpdErr } = await admin
    .from('profiles')
    .update({ full_name: newName, updated_at: new Date().toISOString() })
    .eq('id', reqRow.user_id);
  if (profUpdErr) return json({ error: 'profile_update_failed' }, 500);

  const affected = (reqRow.affected_account_ids ?? []) as string[];
  if (affected.length) {
    await admin
      .from('nium_global_accounts')
      .update({ status: 'closed_pending_reissue', updated_at: new Date().toISOString() })
      .in('id', affected);
  }

  await admin
    .from('nium_name_correction_requests')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      decision_note: d.decision_note ?? null,
      kyc_verification_id: kycRow.id,
    })
    .eq('id', d.request_id);

  await notify(
    admin,
    reqRow.user_id,
    'Name correction approved',
    `Your beneficiary name was updated to "${newName}". Affected global receiving accounts have been closed for re-issue with the corrected verified name.`,
    {
      request_id: reqRow.id,
      kind: 'nium_name_correction',
      stage: 'approved',
      new_full_name: newName,
      closed_account_ids: affected,
    },
    `nium-name-correction-approved-${reqRow.id}`,
  );

  return json({
    ok: true,
    status: 'approved',
    kyc_verification_id: kycRow.id,
    closed_account_ids: affected,
  });
});
