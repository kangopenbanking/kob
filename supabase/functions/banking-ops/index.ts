// Consolidated router for banking operations: withdrawal-policies, staff-authorizations, withdrawal-requests, approvals
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { sendManagedEmail, getAccountRef, getUserName, getUserEmail, getBranchName, emailManagers } from '../_shared/send-managed-email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try { body = await req.json(); } catch { body = {}; }
    const action = body.action;
    if (!action) return error(400, 'action parameter required');

    switch (action) {
      // Withdrawal Policies
      case 'list-withdrawal-policies': return handleListPolicies(req, body);
      case 'create-withdrawal-policy': return handleCreatePolicy(req, body);
      case 'get-withdrawal-policy': return handleGetPolicy(req, body);
      case 'update-withdrawal-policy': return handleUpdatePolicy(req, body);

      // Staff Authorizations
      case 'list-staff-authorizations': return handleListAuthorizations(req, body);
      case 'create-staff-authorization': return handleCreateAuthorization(req, body);
      case 'get-staff-authorization': return handleGetAuthorization(req, body);
      case 'update-staff-authorization': return handleUpdateAuthorization(req, body);

      // Operational Roles
      case 'assign-operational-role': return handleAssignOperationalRole(req, body);
      case 'list-operational-roles': return handleListOperationalRoles(req, body);

      // Withdrawal Requests
      case 'create-withdrawal-request': return handleCreateWithdrawalRequest(req, body);
      case 'list-withdrawal-requests': return handleListWithdrawalRequests(req, body);
      case 'get-withdrawal-request': return handleGetWithdrawalRequest(req, body);
      case 'submit-withdrawal-request': return handleSubmitWithdrawalRequest(req, body);
      case 'cancel-withdrawal-request': return handleCancelWithdrawalRequest(req, body);

      // Approvals
      case 'list-approvals': return handleListApprovals(req, body);
      case 'get-approval': return handleGetApproval(req, body);
      case 'approve': return handleApproveAction(req, body);
      case 'reject': return handleRejectAction(req, body);
      case 'escalate': return handleEscalateAction(req, body);

      // Policy evaluation (internal)
      case 'evaluate-policy': return handleEvaluatePolicy(req, body);

      default: return error(400, `Unknown action: ${action}`);
    }
  } catch (err: any) {
    const msg = err.message || 'internal_error';
    if (msg.includes('authorization') || msg.includes('Unauthorized')) {
      return error(401, msg);
    }
    if (msg.includes('Insufficient permissions')) {
      return error(403, msg);
    }
    console.error('banking-ops error:', err);
    return error(500, 'internal_error');
  }
});

function error(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function ok(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function getAuthenticatedUser(req: Request) {
  const supabase = getServiceClient();
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization header');
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) throw new Error('Unauthorized');
  return user;
}

async function requireInstitutionAccess(supabase: any, userId: string, institutionId: string) {
  const { data: inst } = await supabase.from('institutions').select('user_id').eq('id', institutionId).single();
  if (inst?.user_id === userId) return 'owner';
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  if (roles?.some((r: any) => r.role === 'admin')) return 'admin';
  const { data: staff } = await supabase.from('staff_assignments').select('id').eq('user_id', userId).eq('institution_id', institutionId).eq('is_active', true).maybeSingle();
  if (staff) return 'staff';
  throw new Error('Insufficient permissions for this institution');
}

// High-value threshold for alerts (XAF)
const HIGH_VALUE_THRESHOLD = 1000000;

// ═══════════════════════════════════════════════════════════════════
// WITHDRAWAL POLICIES
// ═══════════════════════════════════════════════════════════════════

async function handleListPolicies(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { institution_id } = body;
  if (!institution_id) return error(400, 'institution_id required');
  await requireInstitutionAccess(supabase, user.id, institution_id);

  const { data, error: e } = await supabase.from('withdrawal_policies').select('*').eq('institution_id', institution_id).order('created_at', { ascending: false });
  if (e) throw e;
  return ok({ policies: data });
}

async function handleCreatePolicy(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { institution_id, branch_id, currency, channel, role_type, single_txn_limit, daily_total_limit, auto_approve_threshold, requires_dual_approval_above, escalation_target_role, can_override_lower_role, effective_from, effective_to } = body;
  if (!institution_id || !role_type || !single_txn_limit || !daily_total_limit) return error(400, 'institution_id, role_type, single_txn_limit, daily_total_limit required');
  
  const accessLevel = await requireInstitutionAccess(supabase, user.id, institution_id);
  if (accessLevel === 'staff') return error(403, 'Only institution owners or admins can create policies');

  const { data, error: e } = await supabase.from('withdrawal_policies').insert({
    institution_id, branch_id: branch_id || null, currency: currency || 'XAF', channel: channel || null,
    role_type, single_txn_limit, daily_total_limit, auto_approve_threshold: auto_approve_threshold || 0,
    requires_dual_approval_above: requires_dual_approval_above || null,
    escalation_target_role: escalation_target_role || null,
    can_override_lower_role: can_override_lower_role || false,
    effective_from: effective_from || new Date().toISOString().split('T')[0],
    effective_to: effective_to || null,
  }).select().single();
  if (e) throw e;

  await supabase.rpc('log_audit_event', { _action_type: 'create_withdrawal_policy', _entity_type: 'withdrawal_policy', _entity_id: data.id, _details: { institution_id, role_type, single_txn_limit, daily_total_limit, created_by: user.id } });
  return ok({ success: true, policy: data }, 201);
}

async function handleGetPolicy(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { policy_id } = body;
  if (!policy_id) return error(400, 'policy_id required');

  const { data, error: e } = await supabase.from('withdrawal_policies').select('*').eq('id', policy_id).single();
  if (e || !data) return error(404, 'Policy not found');
  await requireInstitutionAccess(supabase, user.id, data.institution_id);
  return ok({ policy: data });
}

async function handleUpdatePolicy(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { policy_id, ...updates } = body;
  if (!policy_id) return error(400, 'policy_id required');
  delete updates.action;

  const { data: existing } = await supabase.from('withdrawal_policies').select('institution_id').eq('id', policy_id).single();
  if (!existing) return error(404, 'Policy not found');
  const access = await requireInstitutionAccess(supabase, user.id, existing.institution_id);
  if (access === 'staff') return error(403, 'Only institution owners or admins can update policies');

  const { data, error: e } = await supabase.from('withdrawal_policies').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', policy_id).select().single();
  if (e) throw e;

  await supabase.rpc('log_audit_event', { _action_type: 'update_withdrawal_policy', _entity_type: 'withdrawal_policy', _entity_id: policy_id, _details: { updates, updated_by: user.id } });
  return ok({ success: true, policy: data });
}

// ═══════════════════════════════════════════════════════════════════
// STAFF AUTHORIZATIONS
// ═══════════════════════════════════════════════════════════════════

async function handleListAuthorizations(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { institution_id } = body;
  if (!institution_id) return error(400, 'institution_id required');
  await requireInstitutionAccess(supabase, user.id, institution_id);

  const { data, error: e } = await supabase.from('staff_authorizations').select('*').eq('institution_id', institution_id).order('created_at', { ascending: false });
  if (e) throw e;
  return ok({ authorizations: data });
}

async function handleCreateAuthorization(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { institution_id, branch_id, user_id: target_user_id, role_type, max_override_limit, can_approve_overdraft, can_approve_withdrawal_override, can_suspend_overdraft } = body;
  if (!institution_id || !target_user_id || !role_type) return error(400, 'institution_id, user_id, role_type required');

  const access = await requireInstitutionAccess(supabase, user.id, institution_id);
  if (access === 'staff') return error(403, 'Only institution owners or admins can create authorizations');

  const { data, error: e } = await supabase.from('staff_authorizations').upsert({
    institution_id, branch_id: branch_id || null, user_id: target_user_id, role_type,
    max_override_limit: max_override_limit || null,
    can_approve_overdraft: can_approve_overdraft || false,
    can_approve_withdrawal_override: can_approve_withdrawal_override || false,
    can_suspend_overdraft: can_suspend_overdraft || false,
    status: 'active', updated_at: new Date().toISOString(),
  }, { onConflict: 'institution_id,user_id' }).select().single();
  if (e) throw e;

  // Also ensure operational role exists
  await supabase.from('institution_operational_roles').upsert({
    institution_id, branch_id: branch_id || null, user_id: target_user_id, role_type, is_active: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'institution_id,user_id,role_type' });

  await supabase.rpc('log_audit_event', { _action_type: 'create_staff_authorization', _entity_type: 'staff_authorization', _entity_id: data.id, _details: { target_user_id, role_type, created_by: user.id } });
  return ok({ success: true, authorization: data }, 201);
}

async function handleGetAuthorization(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { authorization_id } = body;
  if (!authorization_id) return error(400, 'authorization_id required');

  const { data, error: e } = await supabase.from('staff_authorizations').select('*').eq('id', authorization_id).single();
  if (e || !data) return error(404, 'Authorization not found');
  await requireInstitutionAccess(supabase, user.id, data.institution_id);
  return ok({ authorization: data });
}

async function handleUpdateAuthorization(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { authorization_id, ...updates } = body;
  if (!authorization_id) return error(400, 'authorization_id required');
  delete updates.action;

  const { data: existing } = await supabase.from('staff_authorizations').select('institution_id').eq('id', authorization_id).single();
  if (!existing) return error(404, 'Authorization not found');
  const access = await requireInstitutionAccess(supabase, user.id, existing.institution_id);
  if (access === 'staff') return error(403, 'Only institution owners or admins can update authorizations');

  const { data, error: e } = await supabase.from('staff_authorizations').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', authorization_id).select().single();
  if (e) throw e;
  return ok({ success: true, authorization: data });
}

// ═══════════════════════════════════════════════════════════════════
// OPERATIONAL ROLES
// ═══════════════════════════════════════════════════════════════════

async function handleAssignOperationalRole(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { institution_id, branch_id, user_id: target_user_id, role_type } = body;
  if (!institution_id || !target_user_id || !role_type) return error(400, 'institution_id, user_id, role_type required');

  const access = await requireInstitutionAccess(supabase, user.id, institution_id);
  if (access === 'staff') return error(403, 'Only institution owners or admins can assign operational roles');

  const { data, error: e } = await supabase.from('institution_operational_roles').upsert({
    institution_id, branch_id: branch_id || null, user_id: target_user_id, role_type, is_active: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'institution_id,user_id,role_type' }).select().single();
  if (e) throw e;

  await supabase.rpc('log_audit_event', { _action_type: 'assign_operational_role', _entity_type: 'operational_role', _entity_id: data.id, _details: { target_user_id, role_type, assigned_by: user.id } });
  return ok({ success: true, role: data }, 201);
}

async function handleListOperationalRoles(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { institution_id } = body;
  if (!institution_id) return error(400, 'institution_id required');
  await requireInstitutionAccess(supabase, user.id, institution_id);

  const { data, error: e } = await supabase.from('institution_operational_roles').select('*').eq('institution_id', institution_id).eq('is_active', true);
  if (e) throw e;
  return ok({ roles: data });
}

// ═══════════════════════════════════════════════════════════════════
// WITHDRAWAL REQUESTS
// ═══════════════════════════════════════════════════════════════════

async function handleCreateWithdrawalRequest(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { institution_id, branch_id, account_id, amount, currency, channel, reason } = body;
  if (!institution_id || !account_id || !amount) return error(400, 'institution_id, account_id, amount required');

  await requireInstitutionAccess(supabase, user.id, institution_id);

  // Evaluate policy
  const policyResult = await supabase.rpc('evaluate_withdrawal_policy', {
    _institution_id: institution_id, _branch_id: branch_id || null,
    _staff_user_id: user.id, _amount: amount,
    _currency: currency || 'XAF', _channel: channel || 'branch',
  });

  const policy = policyResult.data;

  // Get account info for emails
  const accountRef = await getAccountRef(supabase, account_id);
  const { data: acct } = await supabase.from('accounts').select('user_id').eq('id', account_id).single();
  const accountOwnerId = acct?.user_id;
  const customerName = accountOwnerId ? await getUserName(supabase, accountOwnerId) : 'Customer';
  const staffName = await getUserName(supabase, user.id);
  const branchName = await getBranchName(supabase, branch_id || null);
  const cur = currency || 'XAF';
  const formattedAmount = new Intl.NumberFormat('fr-CM').format(amount);

  if (policy?.allowed) {
    // Within policy — auto-executed
    const { data, error: e } = await supabase.from('withdrawal_requests').insert({
      institution_id, branch_id: branch_id || null, account_id,
      initiated_by_staff_id: user.id, amount, currency: cur,
      channel: channel || 'branch', source_type: 'staff', source_endpoint: 'banking-ops',
      current_status: 'approved', policy_result: policy, reason,
    }).select().single();
    if (e) throw e;

    // ✉️ Email customer: withdrawal approved
    if (accountOwnerId) {
      sendManagedEmail(supabase, {
        email_key: 'withdrawal_approved',
        recipient_user_id: accountOwnerId,
        institution_id,
        variables: { customer_name: customerName, amount: formattedAmount, currency: cur, reference: data.id.slice(0, 8), account_ref: accountRef, date: new Date().toLocaleDateString('en-GB') },
      });
    }

    // ✉️ High-value alert to management
    if (amount >= HIGH_VALUE_THRESHOLD) {
      emailManagers(supabase, {
        institution_id, branch_id, role_type: 'general_manager',
        email_key: 'high_value_withdrawal_alert',
        variables: { amount: formattedAmount, currency: cur, account_ref: accountRef, processed_by: staffName, branch_name: branchName, approval_status: 'Auto-approved (within policy)', reference: data.id.slice(0, 8) },
      });
    }

    return ok({ success: true, withdrawal_request: data, policy_evaluation: policy, auto_approved: true });
  }

  // Out of policy — create pending request with approval workflow
  const escalationRole = policy?.escalation_target || 'branch_manager';
  const approvalStatus = escalationRole === 'assistant_manager' ? 'pending_assistant_manager' :
                          escalationRole === 'branch_manager' ? 'pending_branch_manager' : 'pending_general_manager';

  const { data: wr, error: wrErr } = await supabase.from('withdrawal_requests').insert({
    institution_id, branch_id: branch_id || null, account_id,
    initiated_by_staff_id: user.id, amount, currency: cur,
    channel: channel || 'branch', source_type: 'staff', source_endpoint: 'banking-ops',
    current_status: approvalStatus, policy_result: policy,
    required_role: escalationRole, reason,
  }).select().single();
  if (wrErr) throw wrErr;

  // Create approval request
  const { data: ar, error: arErr } = await supabase.from('approval_requests').insert({
    institution_id, branch_id: branch_id || null, entity_type: 'withdrawal_request',
    entity_id: wr.id, request_type: 'withdrawal_override',
    current_stage: approvalStatus, required_role: escalationRole,
    submitted_by: user.id, status: approvalStatus, reason,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).select().single();
  if (arErr) throw arErr;

  // Update withdrawal request with approval_request_id
  await supabase.from('withdrawal_requests').update({ approval_request_id: ar.id }).eq('id', wr.id);

  // Record approval action
  await supabase.from('approval_actions').insert({
    approval_request_id: ar.id, action: 'submit', acted_by: user.id,
    acted_role: policy?.staff_role || null,
    comments: `Withdrawal of ${amount} ${cur} exceeds ${policy?.reason || 'policy limit'}`,
    metadata: { amount, policy_result: policy },
  });

  await supabase.rpc('log_audit_event', { _action_type: 'withdrawal_request_escalated', _entity_type: 'withdrawal_request', _entity_id: wr.id, _details: { amount, escalation_role: escalationRole, policy_result: policy } });

  // ✉️ Email customer: withdrawal pending approval
  if (accountOwnerId) {
    sendManagedEmail(supabase, {
      email_key: 'withdrawal_pending_approval',
      recipient_user_id: accountOwnerId,
      institution_id,
      variables: { customer_name: customerName, amount: formattedAmount, currency: cur, reference: wr.id.slice(0, 8), account_ref: accountRef, date: new Date().toLocaleDateString('en-GB') },
    });
  }

  // ✉️ Email managers: approval pending
  const roleName = escalationRole.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  emailManagers(supabase, {
    institution_id, branch_id, role_type: escalationRole,
    email_key: 'approval_pending_manager',
    variables: { role_title: roleName, amount: formattedAmount, currency: cur, account_ref: accountRef, submitted_by: staffName, branch_name: branchName, reason: reason || 'Exceeds policy limit', reference: wr.id.slice(0, 8) },
  });

  // In-app notification (existing)
  await notifyPendingApprovalManagers(supabase, {
    institution_id, branch_id: branch_id || null,
    escalation_role: escalationRole, approval_request_id: ar.id,
    amount, currency: cur, submitted_by_id: user.id,
  });

  return ok({ success: true, withdrawal_request: { ...wr, approval_request_id: ar.id }, approval_request: ar, policy_evaluation: policy, requires_approval: true, pending_role: escalationRole }, 202);
}

async function handleListWithdrawalRequests(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { institution_id, status: filterStatus, limit: lim, offset } = body;
  if (!institution_id) return error(400, 'institution_id required');
  await requireInstitutionAccess(supabase, user.id, institution_id);

  let query = supabase.from('withdrawal_requests').select('*').eq('institution_id', institution_id).order('created_at', { ascending: false });
  if (filterStatus) query = query.eq('current_status', filterStatus);
  if (lim) query = query.limit(lim);
  if (offset) query = query.range(offset, offset + (lim || 25) - 1);

  const { data, error: e } = await query;
  if (e) throw e;
  return ok({ withdrawal_requests: data });
}

async function handleGetWithdrawalRequest(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { request_id } = body;
  if (!request_id) return error(400, 'request_id required');

  const { data, error: e } = await supabase.from('withdrawal_requests').select('*').eq('id', request_id).single();
  if (e || !data) return error(404, 'Withdrawal request not found');
  await requireInstitutionAccess(supabase, user.id, data.institution_id);
  return ok({ withdrawal_request: data });
}

async function handleSubmitWithdrawalRequest(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { request_id } = body;
  if (!request_id) return error(400, 'request_id required');

  const { data: wr } = await supabase.from('withdrawal_requests').select('*').eq('id', request_id).single();
  if (!wr) return error(404, 'Not found');
  if (wr.current_status !== 'draft') return error(422, 'Can only submit draft requests');

  await supabase.from('withdrawal_requests').update({ current_status: 'submitted', updated_at: new Date().toISOString() }).eq('id', request_id);
  return ok({ success: true, status: 'submitted' });
}

async function handleCancelWithdrawalRequest(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { request_id, reason } = body;
  if (!request_id) return error(400, 'request_id required');

  const { data: wr } = await supabase.from('withdrawal_requests').select('*').eq('id', request_id).single();
  if (!wr) return error(404, 'Not found');
  if (['executed', 'cancelled', 'rejected'].includes(wr.current_status)) return error(422, `Cannot cancel request in status: ${wr.current_status}`);

  await supabase.from('withdrawal_requests').update({ current_status: 'cancelled', reason: reason || 'Cancelled by user', updated_at: new Date().toISOString() }).eq('id', request_id);
  
  if (wr.approval_request_id) {
    await supabase.from('approval_requests').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', wr.approval_request_id);
    await supabase.from('approval_actions').insert({ approval_request_id: wr.approval_request_id, action: 'cancel', acted_by: user.id, comments: reason || 'Cancelled' });
  }

  return ok({ success: true, status: 'cancelled' });
}

// ═══════════════════════════════════════════════════════════════════
// APPROVALS
// ═══════════════════════════════════════════════════════════════════

async function handleListApprovals(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { institution_id, status: filterStatus } = body;
  if (!institution_id) return error(400, 'institution_id required');
  await requireInstitutionAccess(supabase, user.id, institution_id);

  let query = supabase.from('approval_requests').select('*, approval_actions(*)').eq('institution_id', institution_id).order('created_at', { ascending: false });
  if (filterStatus) query = query.eq('status', filterStatus);

  const { data, error: e } = await query;
  if (e) throw e;
  return ok({ approvals: data });
}

async function handleGetApproval(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { approval_id } = body;
  if (!approval_id) return error(400, 'approval_id required');

  const { data, error: e } = await supabase.from('approval_requests').select('*, approval_actions(*)').eq('id', approval_id).single();
  if (e || !data) return error(404, 'Approval not found');
  await requireInstitutionAccess(supabase, user.id, data.institution_id);
  return ok({ approval: data });
}

async function handleApproveAction(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { approval_id, comments } = body;
  if (!approval_id) return error(400, 'approval_id required');

  const { data: ar } = await supabase.from('approval_requests').select('*').eq('id', approval_id).single();
  if (!ar) return error(404, 'Approval not found');
  if (['approved', 'rejected', 'executed', 'cancelled', 'expired'].includes(ar.status)) return error(422, `Cannot approve request in status: ${ar.status}`);

  // Verify approver has required role
  const { data: approverRole } = await supabase.from('institution_operational_roles').select('role_type').eq('user_id', user.id).eq('institution_id', ar.institution_id).eq('is_active', true).maybeSingle();
  const { data: approverAuth } = await supabase.from('staff_authorizations').select('*').eq('user_id', user.id).eq('institution_id', ar.institution_id).eq('status', 'active').maybeSingle();

  if (!approverRole && !approverAuth) {
    const access = await requireInstitutionAccess(supabase, user.id, ar.institution_id);
    if (access === 'staff') return error(403, 'Insufficient authority to approve');
  } else if (approverRole) {
    const { data: roleLevel } = await supabase.rpc('get_role_hierarchy_level', { _role: approverRole.role_type });
    const { data: requiredLevel } = await supabase.rpc('get_role_hierarchy_level', { _role: ar.required_role });
    if (roleLevel < requiredLevel) return error(403, `Role ${approverRole.role_type} insufficient. Required: ${ar.required_role}`);
  }

  // Approve
  await supabase.from('approval_requests').update({ status: 'approved', current_stage: 'approved', updated_at: new Date().toISOString() }).eq('id', approval_id);
  await supabase.from('approval_actions').insert({
    approval_request_id: approval_id, action: 'approve', acted_by: user.id,
    acted_role: approverRole?.role_type || null, comments,
    metadata: { approved_at: new Date().toISOString() },
  });

  // If this is a withdrawal override, update the withdrawal request and send emails
  if (ar.entity_type === 'withdrawal_request') {
    await supabase.from('withdrawal_requests').update({ current_status: 'approved', updated_at: new Date().toISOString() }).eq('id', ar.entity_id);

    const { data: wr } = await supabase.from('withdrawal_requests').select('*').eq('id', ar.entity_id).single();
    if (wr) {
      const accountRef = await getAccountRef(supabase, wr.account_id);
      const { data: acct } = await supabase.from('accounts').select('user_id').eq('id', wr.account_id).single();
      const accountOwnerId = acct?.user_id;
      const customerName = accountOwnerId ? await getUserName(supabase, accountOwnerId) : 'Customer';
      const formattedAmount = new Intl.NumberFormat('fr-CM').format(wr.amount);
      const approverName = await getUserName(supabase, user.id);
      const branchName = await getBranchName(supabase, wr.branch_id);

      try {
        const tellerResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/teller-transaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization')! },
          body: JSON.stringify({ account_id: wr.account_id, amount: wr.amount, operation: 'withdraw', description: `Approved withdrawal (approval: ${approval_id})`, institution_id: wr.institution_id }),
        });
        const tellerResult = await tellerResp.json();

        if (tellerResult.success) {
          await supabase.from('withdrawal_requests').update({ current_status: 'executed', execution_reference: tellerResult.transaction_ref, updated_at: new Date().toISOString() }).eq('id', ar.entity_id);
          await supabase.from('approval_requests').update({ status: 'executed' }).eq('id', approval_id);
          await supabase.from('approval_actions').insert({ approval_request_id: approval_id, action: 'execute', acted_by: user.id, acted_role: approverRole?.role_type || null, comments: 'Withdrawal executed after approval', metadata: tellerResult });

          // ✉️ Email customer: withdrawal approved & executed
          if (accountOwnerId) {
            sendManagedEmail(supabase, {
              email_key: 'withdrawal_approved',
              recipient_user_id: accountOwnerId,
              institution_id: wr.institution_id,
              variables: { customer_name: customerName, amount: formattedAmount, currency: wr.currency, reference: wr.id.slice(0, 8), account_ref: accountRef, date: new Date().toLocaleDateString('en-GB') },
            });
          }

          // ✉️ High-value alert
          if (wr.amount >= HIGH_VALUE_THRESHOLD) {
            emailManagers(supabase, {
              institution_id: wr.institution_id, branch_id: wr.branch_id, role_type: 'general_manager',
              email_key: 'high_value_withdrawal_alert',
              variables: { amount: formattedAmount, currency: wr.currency, account_ref: accountRef, processed_by: approverName, branch_name: branchName, approval_status: `Approved by ${approverRole?.role_type || 'owner'}`, reference: wr.id.slice(0, 8) },
            });
          }
        }

        return ok({ success: true, status: 'approved_and_executed', withdrawal_result: tellerResult });
      } catch (execErr: any) {
        console.error('Withdrawal execution after approval failed:', execErr);
        return ok({ success: true, status: 'approved', execution_pending: true, message: 'Approved but execution pending' });
      }
    }
  }

  await supabase.rpc('log_audit_event', { _action_type: 'approval_approved', _entity_type: 'approval_request', _entity_id: approval_id, _details: { approved_by: user.id, entity_type: ar.entity_type, entity_id: ar.entity_id } });
  return ok({ success: true, status: 'approved' });
}

async function handleRejectAction(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { approval_id, comments, reason } = body;
  if (!approval_id) return error(400, 'approval_id required');

  const { data: ar } = await supabase.from('approval_requests').select('*').eq('id', approval_id).single();
  if (!ar) return error(404, 'Not found');
  if (['approved', 'rejected', 'executed', 'cancelled'].includes(ar.status)) return error(422, `Cannot reject in status: ${ar.status}`);

  await requireInstitutionAccess(supabase, user.id, ar.institution_id);

  await supabase.from('approval_requests').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', approval_id);
  await supabase.from('approval_actions').insert({ approval_request_id: approval_id, action: 'reject', acted_by: user.id, comments: comments || reason || 'Rejected' });

  if (ar.entity_type === 'withdrawal_request') {
    await supabase.from('withdrawal_requests').update({ current_status: 'rejected', updated_at: new Date().toISOString() }).eq('id', ar.entity_id);

    // ✉️ Email customer: withdrawal rejected
    const { data: wr } = await supabase.from('withdrawal_requests').select('account_id, amount, currency').eq('id', ar.entity_id).single();
    if (wr) {
      const accountRef = await getAccountRef(supabase, wr.account_id);
      const { data: acct } = await supabase.from('accounts').select('user_id').eq('id', wr.account_id).single();
      if (acct?.user_id) {
        const customerName = await getUserName(supabase, acct.user_id);
        sendManagedEmail(supabase, {
          email_key: 'withdrawal_rejected',
          recipient_user_id: acct.user_id,
          institution_id: ar.institution_id,
          variables: { customer_name: customerName, amount: new Intl.NumberFormat('fr-CM').format(wr.amount), currency: wr.currency, reference: ar.entity_id.slice(0, 8), account_ref: accountRef, reason: comments || reason || 'Management decision' },
        });
      }
    }
  }

  await supabase.rpc('log_audit_event', { _action_type: 'approval_rejected', _entity_type: 'approval_request', _entity_id: approval_id, _details: { rejected_by: user.id, reason: comments || reason } });
  return ok({ success: true, status: 'rejected' });
}

async function handleEscalateAction(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { approval_id, target_role, comments } = body;
  if (!approval_id) return error(400, 'approval_id required');

  const { data: ar } = await supabase.from('approval_requests').select('*').eq('id', approval_id).single();
  if (!ar) return error(404, 'Not found');

  const nextRole = target_role || (ar.required_role === 'assistant_manager' ? 'branch_manager' : 'general_manager');
  const nextStage = nextRole === 'branch_manager' ? 'pending_branch_manager' : 'pending_general_manager';

  await supabase.from('approval_requests').update({ required_role: nextRole, current_stage: nextStage, status: nextStage, updated_at: new Date().toISOString() }).eq('id', approval_id);
  await supabase.from('approval_actions').insert({ approval_request_id: approval_id, action: 'escalate', acted_by: user.id, comments: comments || `Escalated to ${nextRole}`, metadata: { from_role: ar.required_role, to_role: nextRole } });

  if (ar.entity_type === 'withdrawal_request') {
    await supabase.from('withdrawal_requests').update({ current_status: nextStage, required_role: nextRole, updated_at: new Date().toISOString() }).eq('id', ar.entity_id);

    // ✉️ Email escalated managers
    const { data: wr } = await supabase.from('withdrawal_requests').select('account_id, amount, currency, branch_id').eq('id', ar.entity_id).single();
    if (wr) {
      const accountRef = await getAccountRef(supabase, wr.account_id);
      const fromRoleName = (ar.required_role || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const toRoleName = nextRole.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      emailManagers(supabase, {
        institution_id: ar.institution_id, branch_id: wr.branch_id, role_type: nextRole,
        email_key: 'approval_escalated',
        variables: { role_title: toRoleName, amount: new Intl.NumberFormat('fr-CM').format(wr.amount), currency: wr.currency, account_ref: accountRef, from_role: fromRoleName, escalation_reason: comments || 'Escalated for higher authority review', reference: ar.entity_id.slice(0, 8) },
      });
    }
  }

  return ok({ success: true, status: nextStage, escalated_to: nextRole });
}

// ═══════════════════════════════════════════════════════════════════
// POLICY EVALUATION (internal helper)
// ═══════════════════════════════════════════════════════════════════

async function handleEvaluatePolicy(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  const supabase = getServiceClient();
  const { institution_id, branch_id, staff_user_id, amount, currency, channel } = body;
  if (!institution_id || !amount) return error(400, 'institution_id, amount required');

  const result = await supabase.rpc('evaluate_withdrawal_policy', {
    _institution_id: institution_id, _branch_id: branch_id || null,
    _staff_user_id: staff_user_id || user.id, _amount: amount,
    _currency: currency || 'XAF', _channel: channel || 'branch',
  });

  return ok({ policy_result: result.data });
}

// ═══════════════════════════════════════════════════════════════════
// IN-APP PUSH NOTIFICATION FOR PENDING APPROVALS
// ═══════════════════════════════════════════════════════════════════

async function notifyPendingApprovalManagers(
  supabase: any,
  params: {
    institution_id: string;
    branch_id: string | null;
    escalation_role: string;
    approval_request_id: string;
    amount: number;
    currency: string;
    submitted_by_id: string;
  }
) {
  try {
    let query = supabase
      .from('institution_operational_roles')
      .select('user_id')
      .eq('institution_id', params.institution_id)
      .eq('role_type', params.escalation_role)
      .eq('is_active', true);

    if (params.branch_id) {
      query = query.or(`branch_id.eq.${params.branch_id},branch_id.is.null`);
    }

    const { data: managers } = await query;
    if (!managers || managers.length === 0) return;

    const roleName = params.escalation_role.replace(/_/g, ' ');
    const formattedAmount = new Intl.NumberFormat('fr-CM', { style: 'currency', currency: params.currency }).format(params.amount);

    for (const mgr of managers) {
      if (mgr.user_id === params.submitted_by_id) continue;

      await supabase.from('app_notifications').insert({
        user_id: mgr.user_id,
        institution_id: params.institution_id,
        type: 'warning',
        title: 'Approval Required',
        message: `A withdrawal of ${formattedAmount} requires your approval as ${roleName}.`,
        icon: 'alert-triangle',
        metadata: {
          approval_request_id: params.approval_request_id,
          amount: params.amount,
          currency: params.currency,
          action_url: '/fi-portal/approvals',
        },
      });

      try {
        await supabase.functions.invoke('push-notification', {
          body: {
            user_id: mgr.user_id,
            institution_id: params.institution_id,
            type: 'warning',
            title: 'Withdrawal Approval Required',
            message: `A withdrawal of ${formattedAmount} requires your approval as ${roleName}.`,
            icon: 'alert-triangle',
            metadata: { approval_request_id: params.approval_request_id, amount: params.amount },
          },
        });
      } catch (pushErr) {
        console.error('Push notification failed for manager', mgr.user_id, pushErr);
      }
    }
  } catch (err) {
    console.error('notifyPendingApprovalManagers error:', err);
  }
}
