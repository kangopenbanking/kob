import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user has admin role
    const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleError || !isAdmin) {
      console.error('Authorization error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use service role client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Admin user initiating test data cleanup:', user.id);

    const deletedCounts: Record<string, number> = {};

    // Delete data from various tables (in order to respect foreign key constraints)
    
    // 1. Delete transaction fees
    const { error: feesError, count: feesCount } = await supabaseAdmin
      .from('transaction_fees')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (!feesError && feesCount !== null) deletedCounts.transaction_fees = feesCount;

    // 2. Delete consents
    const { error: aispError, count: aispCount } = await supabaseAdmin
      .from('aisp_consents')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (!aispError && aispCount !== null) deletedCounts.aisp_consents = aispCount;

    const { error: pispError, count: pispCount } = await supabaseAdmin
      .from('pisp_consents')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (!pispError && pispCount !== null) deletedCounts.pisp_consents = pispCount;

    // 3. Delete KYC data
    const { error: kycError, count: kycCount } = await supabaseAdmin
      .from('kyc_verifications')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (!kycError && kycCount !== null) deletedCounts.kyc_verifications = kycCount;

    // 4. Delete phone OTP codes
    const { error: otpError, count: otpCount } = await supabaseAdmin
      .from('phone_otp_codes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (!otpError && otpCount !== null) deletedCounts.phone_otp_codes = otpCount;

    // 5. Delete captcha challenges
    const { error: captchaError, count: captchaCount } = await supabaseAdmin
      .from('captcha_challenges')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (!captchaError && captchaCount !== null) deletedCounts.captcha_challenges = captchaCount;

    // 6. Delete bank connections
    const { error: bankError, count: bankCount } = await supabaseAdmin
      .from('bank_connections')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (!bankError && bankCount !== null) deletedCounts.bank_connections = bankCount;

    // 7. Delete transactions
    const { error: txError, count: txCount } = await supabaseAdmin
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (!txError && txCount !== null) deletedCounts.transactions = txCount;

    // 8. Delete payments
    const { error: payError, count: payCount } = await supabaseAdmin
      .from('payments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (!payError && payCount !== null) deletedCounts.payments = payCount;

    // 9. Delete user roles (except current admin)
    const { error: rolesError, count: rolesCount } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .neq('user_id', user.id);
    if (!rolesError && rolesCount !== null) deletedCounts.user_roles = rolesCount;

    // 10. Delete profiles (except current admin)
    const { error: profilesError, count: profilesCount } = await supabaseAdmin
      .from('profiles')
      .delete()
      .neq('id', user.id);
    if (!profilesError && profilesCount !== null) deletedCounts.profiles = profilesCount;

    // 11. Delete auth users (except current admin) using admin API
    const { data: allUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (!listError && allUsers?.users) {
      let deletedUsers = 0;
      for (const authUser of allUsers.users) {
        if (authUser.id !== user.id) {
          const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
          if (!deleteUserError) {
            deletedUsers++;
          } else {
            console.error('Error deleting user:', authUser.id, deleteUserError);
          }
        }
      }
      deletedCounts.auth_users = deletedUsers;
    }

    // Log the cleanup action
    await supabaseAdmin.rpc('log_audit_event', {
      _action_type: 'test_data_cleared',
      _entity_type: 'system',
      _entity_id: user.id,
      _details: { deleted_counts: deletedCounts }
    });

    console.log('Test data cleanup completed:', deletedCounts);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test data cleared successfully',
        deleted_counts: deletedCounts,
        note: 'Your admin account was preserved'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error clearing test data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
