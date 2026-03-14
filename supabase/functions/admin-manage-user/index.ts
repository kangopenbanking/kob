import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id, _role: 'admin'
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, target_user_id, reason } = await req.json();

    if (!action || !target_user_id) {
      return new Response(JSON.stringify({ error: 'Missing action or target_user_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Prevent self-action
    if (target_user_id === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot perform this action on yourself' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'suspend') {
      // Update profile status
      await supabaseAdmin.from('profiles').update({
        account_status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspended_reason: reason || 'Suspended by admin'
      }).eq('id', target_user_id);

      // Ban user in auth (prevents login)
      await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
        ban_duration: '876600h' // ~100 years
      });

      // Log audit event
      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'suspend_user',
        _entity_type: 'user',
        _entity_id: target_user_id,
        _details: { reason, suspended_by: user.id }
      });

      return new Response(JSON.stringify({ success: true, message: 'User suspended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'unsuspend') {
      await supabaseAdmin.from('profiles').update({
        account_status: 'active',
        suspended_at: null,
        suspended_reason: null
      }).eq('id', target_user_id);

      // Unban user in auth
      await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
        ban_duration: 'none'
      });

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'unsuspend_user',
        _entity_type: 'user',
        _entity_id: target_user_id,
        _details: { unsuspended_by: user.id }
      });

      return new Response(JSON.stringify({ success: true, message: 'User unsuspended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'delete') {
      // Delete all user data across tables (order matters for FK constraints)
      const tablesToClean = [
        'user_permission_overrides',
        'user_roles',
        'staff_assignments',
        'staff_portal_permissions',
        'admin_portal_permissions',
        'app_notifications',
        'security_audit_logs',
        'trusted_devices',
        'phone_otp_codes',
        'captcha_challenges',
        'crediq_scores',
        'crediq_score_history',
        'crediq_email_preferences',
        'credit_goals',
        'kyc_verifications',
        'customer_due_diligence',
        'user_addresses',
        'postiq_address_verifications',
        'savings_accounts',
        'business_kyc',
        'merchant_staff_roles',
      ];

      for (const table of tablesToClean) {
        try {
          await supabaseAdmin.from(table).delete().eq('user_id', target_user_id);
        } catch (e) {
          console.log(`Skipped cleanup for ${table}:`, e);
        }
      }

      // Delete accounts and related data
      const { data: userAccounts } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('user_id', target_user_id);

      if (userAccounts && userAccounts.length > 0) {
        const accountIds = userAccounts.map(a => a.id);
        await supabaseAdmin.from('transactions').delete().in('account_id', accountIds);
        await supabaseAdmin.from('account_balances').delete().in('account_id', accountIds);
        await supabaseAdmin.from('beneficiaries').delete().in('account_id', accountIds);
        await supabaseAdmin.from('standing_orders').delete().in('account_id', accountIds);
        await supabaseAdmin.from('direct_debits').delete().in('account_id', accountIds);
        await supabaseAdmin.from('accounts').delete().eq('user_id', target_user_id);
      }

      // Delete consents
      await supabaseAdmin.from('aisp_consents').delete().eq('user_id', target_user_id);
      await supabaseAdmin.from('pisp_consents').delete().eq('user_id', target_user_id);

      // Delete mobile money and bank transfer transactions
      await supabaseAdmin.from('mobile_money_transactions').delete().eq('user_id', target_user_id);
      await supabaseAdmin.from('bank_transfer_transactions').delete().eq('user_id', target_user_id);

      // Delete profile
      await supabaseAdmin.from('profiles').delete().eq('id', target_user_id);

      // Log audit event before deleting auth user
      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'delete_user',
        _entity_type: 'user',
        _entity_id: target_user_id,
        _details: { reason, deleted_by: user.id }
      });

      // Delete auth user last
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
      if (deleteError) {
        console.error('Error deleting auth user:', deleteError);
        return new Response(JSON.stringify({ error: 'Failed to delete auth user' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'User and all data deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('admin-manage-user error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
