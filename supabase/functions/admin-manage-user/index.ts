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

    const { action, target_user_id, target_entity_id, reason } = await req.json();

    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Helper: send notification email + push
    const sendNotification = async (userId: string, emailKey: string, title: string, message: string, variables: Record<string, any> = {}) => {
      try {
        // Push notification
        await supabaseAdmin.from('app_notifications').insert({
          user_id: userId,
          type: emailKey.includes('suspend') ? 'warning' : emailKey.includes('delete') ? 'destructive' : 'info',
          title,
          message,
          icon: 'shield',
          metadata: { action: emailKey, reason: variables.reason },
        });

        // Email notification
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userData?.user?.email) {
          await supabaseAdmin.functions.invoke('managed-send-email', {
            body: {
              email_key: emailKey,
              recipient_email: userData.user.email,
              variables: { ...variables, customer_name: userData.user.user_metadata?.full_name || 'User' },
            },
          });
        }
      } catch (e) {
        console.log('Notification send error (non-blocking):', e);
      }
    };

    // ─── USER ACTIONS ───
    if (action === 'suspend' && target_user_id) {
      if (target_user_id === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot suspend yourself' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await supabaseAdmin.from('profiles').update({
        account_status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspended_reason: reason || 'Suspended by admin'
      }).eq('id', target_user_id);

      await supabaseAdmin.auth.admin.updateUserById(target_user_id, { ban_duration: '876600h' });

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'suspend_user', _entity_type: 'user', _entity_id: target_user_id,
        _details: { reason, suspended_by: user.id }
      });

      await sendNotification(target_user_id, 'account_suspended', 'Account Suspended',
        `Your account has been suspended. Reason: ${reason || 'Policy violation'}`,
        { reason: reason || 'Policy violation' });

      return new Response(JSON.stringify({ success: true, message: 'User suspended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'unsuspend' && target_user_id) {
      await supabaseAdmin.from('profiles').update({
        account_status: 'active', suspended_at: null, suspended_reason: null
      }).eq('id', target_user_id);

      await supabaseAdmin.auth.admin.updateUserById(target_user_id, { ban_duration: 'none' });

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'unsuspend_user', _entity_type: 'user', _entity_id: target_user_id,
        _details: { unsuspended_by: user.id }
      });

      await sendNotification(target_user_id, 'account_unsuspended', 'Account Reinstated',
        'Your account has been reinstated. You can now sign in again.', {});

      return new Response(JSON.stringify({ success: true, message: 'User unsuspended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'delete' && target_user_id) {
      if (target_user_id === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get email before deletion for notification
      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
      const targetEmail = targetUser?.user?.email;
      const targetName = targetUser?.user?.user_metadata?.full_name || 'User';

      const tablesToClean = [
        'user_permission_overrides', 'user_roles', 'staff_assignments', 'staff_portal_permissions',
        'admin_portal_permissions', 'app_notifications', 'security_audit_logs', 'trusted_devices',
        'phone_otp_codes', 'captcha_challenges', 'crediq_scores', 'crediq_score_history',
        'crediq_email_preferences', 'credit_goals', 'kyc_verifications', 'customer_due_diligence',
        'user_addresses', 'postiq_address_verifications', 'savings_accounts', 'business_kyc',
        'merchant_staff_roles',
      ];

      for (const table of tablesToClean) {
        try { await supabaseAdmin.from(table).delete().eq('user_id', target_user_id); } catch (e) {
          console.log(`Skipped cleanup for ${table}:`, e);
        }
      }

      const { data: userAccounts } = await supabaseAdmin.from('accounts').select('id').eq('user_id', target_user_id);
      if (userAccounts && userAccounts.length > 0) {
        const accountIds = userAccounts.map(a => a.id);
        await supabaseAdmin.from('transactions').delete().in('account_id', accountIds);
        await supabaseAdmin.from('account_balances').delete().in('account_id', accountIds);
        await supabaseAdmin.from('beneficiaries').delete().in('account_id', accountIds);
        await supabaseAdmin.from('standing_orders').delete().in('account_id', accountIds);
        await supabaseAdmin.from('direct_debits').delete().in('account_id', accountIds);
        await supabaseAdmin.from('accounts').delete().eq('user_id', target_user_id);
      }

      await supabaseAdmin.from('aisp_consents').delete().eq('user_id', target_user_id);
      await supabaseAdmin.from('pisp_consents').delete().eq('user_id', target_user_id);
      await supabaseAdmin.from('mobile_money_transactions').delete().eq('user_id', target_user_id);
      await supabaseAdmin.from('bank_transfer_transactions').delete().eq('user_id', target_user_id);
      await supabaseAdmin.from('profiles').delete().eq('id', target_user_id);

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'delete_user', _entity_type: 'user', _entity_id: target_user_id,
        _details: { reason, deleted_by: user.id }
      });

      // Send deletion email before removing auth user
      if (targetEmail) {
        try {
          await supabaseAdmin.functions.invoke('managed-send-email', {
            body: {
              email_key: 'account_deleted',
              recipient_email: targetEmail,
              variables: { customer_name: targetName, reason: reason || 'Account permanently deleted by admin' },
            },
          });
        } catch (e) { console.log('Deletion email error:', e); }
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
      if (deleteError) {
        return new Response(JSON.stringify({ error: 'Failed to delete auth user' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'User and all data deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    // ─── INSTITUTION ACTIONS ───
    } else if (action === 'suspend_institution' && target_entity_id) {
      const { data: inst } = await supabaseAdmin.from('institutions').select('user_id, institution_name').eq('id', target_entity_id).single();
      if (!inst) return new Response(JSON.stringify({ error: 'Institution not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabaseAdmin.from('institutions').update({ status: 'suspended' }).eq('id', target_entity_id);
      // Ban owner
      await supabaseAdmin.auth.admin.updateUserById(inst.user_id, { ban_duration: '876600h' });
      await supabaseAdmin.from('profiles').update({ account_status: 'suspended', suspended_at: new Date().toISOString(), suspended_reason: reason }).eq('id', inst.user_id);
      // Ban all staff
      const { data: staff } = await supabaseAdmin.from('staff_assignments').select('user_id').eq('institution_id', target_entity_id).eq('is_active', true);
      if (staff) {
        for (const s of staff) {
          await supabaseAdmin.auth.admin.updateUserById(s.user_id, { ban_duration: '876600h' });
        }
      }

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'suspend_institution', _entity_type: 'institution', _entity_id: target_entity_id,
        _details: { reason, suspended_by: user.id, institution_name: inst.institution_name }
      });

      await sendNotification(inst.user_id, 'account_suspended', 'Institution Suspended',
        `Your institution "${inst.institution_name}" has been suspended. Reason: ${reason || 'Policy violation'}`,
        { reason, entity_name: inst.institution_name });

      return new Response(JSON.stringify({ success: true, message: 'Institution suspended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'unsuspend_institution' && target_entity_id) {
      const { data: inst } = await supabaseAdmin.from('institutions').select('user_id, institution_name').eq('id', target_entity_id).single();
      if (!inst) return new Response(JSON.stringify({ error: 'Institution not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabaseAdmin.from('institutions').update({ status: 'active' }).eq('id', target_entity_id);
      await supabaseAdmin.auth.admin.updateUserById(inst.user_id, { ban_duration: 'none' });
      await supabaseAdmin.from('profiles').update({ account_status: 'active', suspended_at: null, suspended_reason: null }).eq('id', inst.user_id);
      const { data: staff } = await supabaseAdmin.from('staff_assignments').select('user_id').eq('institution_id', target_entity_id).eq('is_active', true);
      if (staff) { for (const s of staff) { await supabaseAdmin.auth.admin.updateUserById(s.user_id, { ban_duration: 'none' }); } }

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'unsuspend_institution', _entity_type: 'institution', _entity_id: target_entity_id,
        _details: { unsuspended_by: user.id }
      });

      await sendNotification(inst.user_id, 'account_unsuspended', 'Institution Reinstated',
        `Your institution "${inst.institution_name}" has been reinstated.`, { entity_name: inst.institution_name });

      return new Response(JSON.stringify({ success: true, message: 'Institution unsuspended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'delete_institution' && target_entity_id) {
      const { data: inst } = await supabaseAdmin.from('institutions').select('user_id, institution_name').eq('id', target_entity_id).single();
      if (!inst) return new Response(JSON.stringify({ error: 'Institution not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(inst.user_id);
      const targetEmail = targetUser?.user?.email;

      // Cascade: accounts → transactions/balances, staff, fees, invoices, API clients
      const { data: instAccounts } = await supabaseAdmin.from('accounts').select('id').eq('institution_id', target_entity_id);
      if (instAccounts && instAccounts.length > 0) {
        const ids = instAccounts.map(a => a.id);
        await supabaseAdmin.from('transactions').delete().in('account_id', ids);
        await supabaseAdmin.from('account_balances').delete().in('account_id', ids);
        await supabaseAdmin.from('beneficiaries').delete().in('account_id', ids);
        await supabaseAdmin.from('standing_orders').delete().in('account_id', ids);
        await supabaseAdmin.from('direct_debits').delete().in('account_id', ids);
      }
      await supabaseAdmin.from('accounts').delete().eq('institution_id', target_entity_id);
      await supabaseAdmin.from('staff_assignments').delete().eq('institution_id', target_entity_id);
      await supabaseAdmin.from('fee_structures').delete().eq('institution_id', target_entity_id);
      await supabaseAdmin.from('transaction_fees').delete().eq('institution_id', target_entity_id);
      await supabaseAdmin.from('institution_invoices').delete().eq('institution_id', target_entity_id);
      await supabaseAdmin.from('api_clients').delete().eq('institution_id', target_entity_id);
      await supabaseAdmin.from('api_credentials').delete().eq('institution_id', target_entity_id);
      await supabaseAdmin.from('branches').delete().eq('institution_id', target_entity_id);
      await supabaseAdmin.from('bank_connections').delete().eq('institution_id', target_entity_id);
      await supabaseAdmin.from('institutions').delete().eq('id', target_entity_id);

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'delete_institution', _entity_type: 'institution', _entity_id: target_entity_id,
        _details: { reason, deleted_by: user.id, institution_name: inst.institution_name }
      });

      if (targetEmail) {
        try {
          await supabaseAdmin.functions.invoke('managed-send-email', {
            body: { email_key: 'account_deleted', recipient_email: targetEmail, variables: { customer_name: inst.institution_name, reason: reason || 'Institution permanently deleted' } },
          });
        } catch (e) { console.log('Email error:', e); }
      }

      return new Response(JSON.stringify({ success: true, message: 'Institution and all data deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    // ─── MERCHANT ACTIONS ───
    } else if (action === 'suspend_merchant' && target_entity_id) {
      const { data: merchant } = await supabaseAdmin.from('gateway_merchants').select('user_id, business_name').eq('id', target_entity_id).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'Merchant not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabaseAdmin.from('gateway_merchants').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', target_entity_id);

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'suspend_merchant', _entity_type: 'merchant', _entity_id: target_entity_id,
        _details: { reason, suspended_by: user.id, business_name: merchant.business_name }
      });

      await sendNotification(merchant.user_id, 'account_suspended', 'Merchant Account Suspended',
        `Your merchant account "${merchant.business_name}" has been suspended. Reason: ${reason || 'Policy violation'}`,
        { reason, entity_name: merchant.business_name });

      return new Response(JSON.stringify({ success: true, message: 'Merchant suspended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'unsuspend_merchant' && target_entity_id) {
      const { data: merchant } = await supabaseAdmin.from('gateway_merchants').select('user_id, business_name').eq('id', target_entity_id).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'Merchant not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabaseAdmin.from('gateway_merchants').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', target_entity_id);

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'unsuspend_merchant', _entity_type: 'merchant', _entity_id: target_entity_id,
        _details: { unsuspended_by: user.id }
      });

      await sendNotification(merchant.user_id, 'account_unsuspended', 'Merchant Account Reinstated',
        `Your merchant account "${merchant.business_name}" has been reinstated.`, { entity_name: merchant.business_name });

      return new Response(JSON.stringify({ success: true, message: 'Merchant unsuspended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'delete_merchant' && target_entity_id) {
      const { data: merchant } = await supabaseAdmin.from('gateway_merchants').select('user_id, business_name').eq('id', target_entity_id).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'Merchant not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(merchant.user_id);
      const targetEmail = targetUser?.user?.email;

      // Cascade merchant data
      const merchantTables = ['gateway_charges', 'gateway_refunds', 'gateway_merchant_wallets',
        'gateway_merchant_api_keys', 'gateway_merchant_webhooks', 'gateway_merchant_settlement_accounts',
        'merchant_staff_roles', 'pos_store_profiles', 'pos_store_subscriptions', 'business_app_feature_flags'];
      for (const t of merchantTables) {
        try { await supabaseAdmin.from(t).delete().eq('merchant_id', target_entity_id); } catch (e) { console.log(`Skip ${t}:`, e); }
      }
      await supabaseAdmin.from('gateway_merchants').delete().eq('id', target_entity_id);

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'delete_merchant', _entity_type: 'merchant', _entity_id: target_entity_id,
        _details: { reason, deleted_by: user.id, business_name: merchant.business_name }
      });

      if (targetEmail) {
        try {
          await supabaseAdmin.functions.invoke('managed-send-email', {
            body: { email_key: 'account_deleted', recipient_email: targetEmail, variables: { customer_name: merchant.business_name, reason: reason || 'Merchant account permanently deleted' } },
          });
        } catch (e) { console.log('Email error:', e); }
      }

      return new Response(JSON.stringify({ success: true, message: 'Merchant and all data deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    // ─── DEVELOPER (TPP) ACTIONS ───
    } else if (action === 'suspend_developer' && target_entity_id) {
      const { data: tpp } = await supabaseAdmin.from('tpp_registrations').select('client_name, institution_id').eq('id', target_entity_id).single();
      if (!tpp) return new Response(JSON.stringify({ error: 'TPP not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabaseAdmin.from('tpp_registrations').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', target_entity_id);
      // Revoke certificates
      await supabaseAdmin.from('client_certificates').update({ is_revoked: true }).eq('client_id', (await supabaseAdmin.from('tpp_registrations').select('client_id').eq('id', target_entity_id).single()).data?.client_id || '');

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'suspend_developer', _entity_type: 'tpp', _entity_id: target_entity_id,
        _details: { reason, suspended_by: user.id, client_name: tpp.client_name }
      });

      // Try notifying institution owner
      if (tpp.institution_id) {
        const { data: inst } = await supabaseAdmin.from('institutions').select('user_id').eq('id', tpp.institution_id).single();
        if (inst) {
          await sendNotification(inst.user_id, 'account_suspended', 'Developer Access Suspended',
            `TPP registration "${tpp.client_name}" has been suspended. Reason: ${reason || 'Policy violation'}`,
            { reason, entity_name: tpp.client_name });
        }
      }

      return new Response(JSON.stringify({ success: true, message: 'Developer registration suspended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'delete_developer' && target_entity_id) {
      const { data: tpp } = await supabaseAdmin.from('tpp_registrations').select('client_id, client_name, institution_id').eq('id', target_entity_id).single();
      if (!tpp) return new Response(JSON.stringify({ error: 'TPP not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabaseAdmin.from('client_certificates').delete().eq('client_id', tpp.client_id);
      await supabaseAdmin.from('api_clients').delete().eq('client_id', tpp.client_id);
      await supabaseAdmin.from('tpp_registrations').delete().eq('id', target_entity_id);

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'delete_developer', _entity_type: 'tpp', _entity_id: target_entity_id,
        _details: { reason, deleted_by: user.id, client_name: tpp.client_name }
      });

      if (tpp.institution_id) {
        const { data: inst } = await supabaseAdmin.from('institutions').select('user_id').eq('id', tpp.institution_id).single();
        if (inst) {
          await sendNotification(inst.user_id, 'account_deleted', 'Developer Registration Deleted',
            `TPP registration "${tpp.client_name}" has been permanently deleted.`,
            { entity_name: tpp.client_name, reason: reason || 'Permanently deleted by admin' });
        }
      }

      return new Response(JSON.stringify({ success: true, message: 'Developer registration deleted' }), {
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
