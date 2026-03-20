import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 2];

    const authHeader = req.headers.get('authorization');
    const consentId = req.headers.get('x-consent-id');

    if (!authHeader || !consentId || !accountId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: hasPermission } = await supabase.rpc('check_aisp_permission', {
      _consent_id: consentId,
      _user_id: user.id,
      _permission: 'ReadBeneficiariesBasic'
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Try core account ───
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    let beneficiaryData: any[] = [];
    let dataFreshness = 'realtime';

    if (account) {
      const { data: beneficiaries } = await supabase
        .from('beneficiaries')
        .select('*')
        .eq('account_id', account.id)
        .eq('is_active', true);

      beneficiaryData = (beneficiaries || []).map(b => ({
        AccountId: accountId,
        BeneficiaryId: b.id,
        Reference: b.reference,
        CreditorAccount: {
          SchemeName: b.identification_scheme,
          Identification: b.identification_value,
          Name: b.beneficiary_name
        }
      }));
    } else {
      // ─── Try bank-sourced account ───
      const { data: psuLinks } = await supabase
        .from('bank_psu_links')
        .select('bank_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (psuLinks && psuLinks.length > 0) {
        const bankIds = psuLinks.map(l => l.bank_id);
        const { data: bsAccount } = await supabase
          .from('bank_sourced_accounts')
          .select('id')
          .eq('external_account_id', accountId)
          .in('bank_id', bankIds)
          .maybeSingle();

        if (bsAccount) {
          dataFreshness = 'daily_import';
          const { data: bsBeneficiaries } = await supabase
            .from('bank_sourced_beneficiaries')
            .select('*')
            .eq('account_id', bsAccount.id);

          beneficiaryData = (bsBeneficiaries || []).map(b => ({
            AccountId: accountId,
            BeneficiaryId: b.id,
            CreditorAccount: {
              SchemeName: b.scheme_name || 'CM_RIB',
              Identification: b.identification,
              Name: b.beneficiary_name
            },
            DataFreshness: 'daily_import'
          }));
        }
      }
    }

    if (beneficiaryData.length === 0 && !account) {
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const response = {
      Data: { Beneficiary: beneficiaryData },
      Links: { Self: `https://api.kangopenbanking.com/v1/aisp-accounts/${accountId}/beneficiaries` },
      Meta: { TotalPages: 1, DataFreshness: dataFreshness }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('Error in aisp-beneficiaries:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
