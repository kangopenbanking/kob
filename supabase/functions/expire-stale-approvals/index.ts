import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyCronAuth } from '../_shared/cron-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Expire approval_requests past their expires_at
    const { data: expired, error: expErr } = await supabase
      .from('approval_requests')
      .update({ status: 'expired', current_stage: 'expired', updated_at: new Date().toISOString() })
      .lt('expires_at', new Date().toISOString())
      .not('status', 'in', '("approved","rejected","cancelled","expired","executed")')
      .select('id, entity_type, entity_id, institution_id, submitted_by');

    if (expErr) {
      console.error('expire-stale-approvals update error:', expErr);
      throw expErr;
    }

    const count = expired?.length || 0;

    // For each expired approval, update the linked withdrawal_request too
    for (const ar of expired || []) {
      if (ar.entity_type === 'withdrawal_request') {
        await supabase
          .from('withdrawal_requests')
          .update({ current_status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', ar.entity_id);
      }

      // Record expiration action in audit trail
      await supabase.from('approval_actions').insert({
        approval_request_id: ar.id,
        action: 'expire',
        acted_by: '00000000-0000-0000-0000-000000000000', // system actor
        acted_role: null,
        comments: 'Auto-expired: approval window elapsed',
        metadata: { expired_at: new Date().toISOString() },
      });

      // Notify the submitter that their request expired
      await supabase.from('app_notifications').insert({
        user_id: ar.submitted_by,
        institution_id: ar.institution_id,
        type: 'warning',
        title: 'Approval Request Expired',
        message: `Your ${ar.entity_type?.replace(/_/g, ' ')} approval request has expired without action.`,
        icon: 'clock',
        metadata: { approval_request_id: ar.id, entity_id: ar.entity_id },
      });
    }

    console.log(`expire-stale-approvals: expired ${count} requests`);
    return new Response(
      JSON.stringify({ success: true, expired_count: count }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('expire-stale-approvals error:', err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
