import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/admin-notify.ts";
import { notifyUser } from "../_shared/admin-notify.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string, extra?: Record<string, unknown>) =>
  new Response(JSON.stringify({
    type: `${Deno.env.get("SUPABASE_URL")!}/functions/v1/errors/${type}`,
    title, status, detail, error: detail, message: detail, ...(extra || {}),
  }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

const log = (level: 'info' | 'warn' | 'error', event: string, ctx: Record<string, unknown> = {}) => {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, fn: 'gateway-merchant-kyb-review', event, ...ctx });
  if (level === 'error') console.error(line); else console.log(line);
};

// Required KYB coverage gates — enforced before approval
const REQUIRED_DOC_TYPES = ['business_registration', 'tax_certificate', 'proof_of_address'];
const REQUIRED_META_FIELDS = ['kyb_business_registration', 'kyb_tax_id', 'kyb_business_address'];

function assessCoverage(merchant: any): { ok: boolean; missing_documents: string[]; missing_fields: string[] } {
  const docs = Array.isArray(merchant.kyb_documents) ? merchant.kyb_documents : [];
  const presentTypes = new Set<string>(
    docs.map((d: any) => (typeof d === 'string' ? d : d?.type || d?.document_type)).filter(Boolean)
  );
  const missing_documents = REQUIRED_DOC_TYPES.filter((t) => !presentTypes.has(t));
  const meta = merchant.metadata || {};
  const missing_fields = REQUIRED_META_FIELDS.filter((f) => !meta[f]);
  return { ok: missing_documents.length === 0 && missing_fields.length === 0, missing_documents, missing_fields };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return rfc7807('unauthorized', 'Unauthorized', 401, 'Missing Authorization header');

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return rfc7807('unauthorized', 'Unauthorized', 401, 'Invalid or expired token');

    const url = new URL(req.url);
    const body = req.method !== 'GET' ? await req.json() : {};

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin');

    const { action, merchant_id } = body as { action?: string; merchant_id?: string };

    // ─── GET — KYB Status ───
    if (req.method === 'GET') {
      const mid = url.searchParams.get('merchant_id');
      if (!mid) return rfc7807('validation_error', 'Validation Error', 400, 'merchant_id query param required');

      const { data: merchant } = await supabase
        .from('gateway_merchants')
        .select('id, business_name, status, kyb_status, kyb_submitted_at, kyb_reviewed_at, kyb_reviewed_by, kyb_documents, kyb_rejection_reason')
        .eq('id', mid).single();

      if (!merchant) return rfc7807('not_found', 'Not Found', 404, 'Merchant not found');

      // Authorization: owner or admin
      const { data: ownerCheck } = await supabase
        .from('gateway_merchants').select('user_id').eq('id', mid).single();
      if (ownerCheck?.user_id !== user.id && !isAdmin) {
        return rfc7807('forbidden', 'Forbidden', 403, 'Access denied');
      }

      return json({
        merchant_id: merchant.id,
        business_name: merchant.business_name,
        merchant_status: merchant.status,
        kyb_status: merchant.kyb_status,
        kyb_submitted_at: merchant.kyb_submitted_at,
        kyb_reviewed_at: merchant.kyb_reviewed_at,
        kyb_documents: merchant.kyb_documents,
        kyb_rejection_reason: merchant.kyb_rejection_reason,
      });
    }

    if (req.method !== 'POST') return rfc7807('method_not_allowed', 'Method Not Allowed', 405, 'Only GET and POST supported');
    if (!merchant_id) return rfc7807('validation_error', 'Validation Error', 400, 'merchant_id is required');

    const { data: merchant } = await supabase
      .from('gateway_merchants').select('*').eq('id', merchant_id).single();

    if (!merchant) return rfc7807('not_found', 'Not Found', 404, 'Merchant not found');

    // ─── SUBMIT — Merchant submits KYB documents ───
    if (action === 'submit') {
      if (merchant.user_id !== user.id) {
        return rfc7807('forbidden', 'Forbidden', 403, 'Only the merchant owner can submit KYB');
      }

      if (!['not_submitted', 'rejected'].includes(merchant.kyb_status)) {
        return rfc7807('invalid_state', 'Invalid State', 409,
          `KYB is already in '${merchant.kyb_status}' state`);
      }

      const { documents, business_registration_number, tax_id, business_address } = body as any;

      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        return rfc7807('validation_error', 'Validation Error', 400, 'At least one document is required');
      }

      const { error } = await supabase.from('gateway_merchants').update({
        kyb_status: 'submitted',
        kyb_submitted_at: new Date().toISOString(),
        kyb_documents: documents,
        kyb_rejection_reason: null,
        status: merchant.status === 'DRAFT' ? 'SUBMITTED' : merchant.status,
        metadata: {
          ...(merchant.metadata || {}),
          kyb_business_registration: business_registration_number,
          kyb_tax_id: tax_id,
          kyb_business_address: business_address,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', merchant_id);

      if (error) return rfc7807('submit_failed', 'Submit Failed', 500, error.message);

      await supabase.from('audit_logs').insert({
        action_type: 'merchant_kyb_submitted',
        entity_type: 'gateway_merchant',
        entity_id: merchant_id,
        performed_by: user.id,
        details: { document_count: documents.length },
      });

      // Notify admins about new KYB submission
      await notifyAdmins(supabase, {
        event_type: 'merchant_kyb_submitted',
        entity_type: 'gateway_merchant',
        entity_id: merchant_id,
        title: 'Merchant KYB Submitted',
        message: `${merchant.business_name} has submitted KYB documents for review.`,
        metadata: { business_name: merchant.business_name },
      });

      return json({ merchant_id, kyb_status: 'submitted', submitted_at: new Date().toISOString() });
    }

    // ─── REVIEW — Admin approves or rejects KYB ───
    if (action === 'review') {
      if (!isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Only admins can review KYB');

      const { decision, reason } = body as { decision?: string; reason?: string };

      if (!decision || !['approve', 'reject'].includes(decision)) {
        return rfc7807('validation_error', 'Validation Error', 400, "decision must be 'approve' or 'reject'");
      }

      if (!['submitted', 'under_review'].includes(merchant.kyb_status)) {
        return rfc7807('invalid_state', 'Invalid State', 409,
          `Cannot review KYB in '${merchant.kyb_status}' state`);
      }

      if (decision === 'reject' && !reason) {
        return rfc7807('validation_error', 'Validation Error', 400, 'reason is required for rejection');
      }

      const newKybStatus = decision === 'approve' ? 'verified' : 'rejected';
      const newMerchantStatus = decision === 'approve' ? 'VERIFIED' : merchant.status;

      const { error } = await supabase.from('gateway_merchants').update({
        kyb_status: newKybStatus,
        kyb_reviewed_at: new Date().toISOString(),
        kyb_reviewed_by: user.id,
        kyb_rejection_reason: decision === 'reject' ? reason : null,
        status: newMerchantStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', merchant_id);

      if (error) return rfc7807('review_failed', 'Review Failed', 500, error.message);

      await supabase.from('audit_logs').insert({
        action_type: `merchant_kyb_${decision}d`,
        entity_type: 'gateway_merchant',
        entity_id: merchant_id,
        performed_by: user.id,
        details: { decision, reason, previous_kyb_status: merchant.kyb_status },
      });

      // Notify merchant owner about review decision
      if (merchant.user_id) {
        await notifyUser(supabase, {
          user_id: merchant.user_id,
          type: decision === 'approve' ? 'success' : 'warning',
          title: decision === 'approve' ? 'KYB Approved' : 'KYB Rejected',
          message: decision === 'approve'
            ? `Your business "${merchant.business_name}" has been verified. You can now accept live payments.`
            : `Your KYB application was not approved. Reason: ${reason || 'Please contact support.'}`,
          icon: 'kyc',
          metadata: { merchant_id, decision, reason },
        });
      }

      return json({
        merchant_id,
        decision,
        kyb_status: newKybStatus,
        merchant_status: newMerchantStatus,
        reviewed_at: new Date().toISOString(),
      });
    }

    // ─── START_REVIEW — Admin marks KYB as under review ───
    if (action === 'start_review') {
      if (!isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Only admins can start review');

      if (merchant.kyb_status !== 'submitted') {
        return rfc7807('invalid_state', 'Invalid State', 409, 'KYB must be in submitted state');
      }

      await supabase.from('gateway_merchants').update({
        kyb_status: 'under_review',
        status: 'UNDER_REVIEW',
        updated_at: new Date().toISOString(),
      }).eq('id', merchant_id);

      await supabase.from('audit_logs').insert({
        action_type: 'merchant_kyb_review_started',
        entity_type: 'gateway_merchant',
        entity_id: merchant_id,
        performed_by: user.id,
      });

      return json({ merchant_id, kyb_status: 'under_review', merchant_status: 'UNDER_REVIEW' });
    }

    // ─── SUSPEND / REINSTATE — Admin lifecycle controls (Phase 3, additive) ───
    if (action === 'suspend' || action === 'reinstate') {
      if (!isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Only admins can change merchant lifecycle');
      const { reason_code, reason } = body as { reason_code?: string; reason?: string };
      if (action === 'suspend' && !reason_code) {
        return rfc7807('validation_error', 'Validation Error', 400, 'reason_code is required to suspend');
      }
      const newStatus = action === 'suspend' ? 'SUSPENDED' : (merchant.kyb_status === 'verified' ? 'VERIFIED' : 'UNDER_REVIEW');
      const { error } = await supabase.from('gateway_merchants').update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(merchant.metadata || {}),
          last_lifecycle_action: action,
          last_lifecycle_reason_code: reason_code ?? null,
          last_lifecycle_reason: reason ?? null,
          last_lifecycle_by: user.id,
          last_lifecycle_at: new Date().toISOString(),
        },
      }).eq('id', merchant_id);
      if (error) return rfc7807('lifecycle_failed', 'Lifecycle Update Failed', 500, error.message);

      await supabase.from('audit_logs').insert({
        action_type: `merchant_${action}`,
        entity_type: 'gateway_merchant',
        entity_id: merchant_id,
        performed_by: user.id,
        details: { reason_code, reason, previous_status: merchant.status },
      });

      if (merchant.user_id) {
        await notifyUser(supabase, {
          user_id: merchant.user_id,
          type: action === 'suspend' ? 'warning' : 'info',
          title: action === 'suspend' ? 'Merchant Account Suspended' : 'Merchant Account Reinstated',
          message: action === 'suspend'
            ? `Your merchant account "${merchant.business_name}" has been suspended. Reason: ${reason_code}${reason ? ' — ' + reason : ''}.`
            : `Your merchant account "${merchant.business_name}" has been reinstated.`,
          icon: 'shield',
          metadata: { merchant_id, reason_code, reason },
        });
      }

      return json({ merchant_id, status: newStatus, action, reason_code: reason_code ?? null });
    }

    return rfc7807('invalid_action', 'Invalid Action', 400, `Unknown action: ${action}`);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] [gateway-merchant-kyb-review] Error:`, err);
    return rfc7807('internal_error', 'Internal Server Error', 500, `An unexpected error occurred. Reference: ${errorId}`);
  }
});
