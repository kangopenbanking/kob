import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { safeErrorResponse } from '../_shared/errors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { 
      account_type, email, phone, full_name, password, org_name, 
      business_name, business_description, contact_person, default_currency,
      institution_name, institution_type 
    } = body;

    if (!account_type || !['personal', 'merchant', 'institution', 'developer'].includes(account_type)) {
      return new Response(JSON.stringify({ error: 'Invalid account_type. Must be: personal, merchant, institution, or developer' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!email && !phone) {
      return new Response(JSON.stringify({ error: 'Either email or phone is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Create user via Supabase Auth
    let userId: string;
    let provisionalToken: string | null = null;

    if (email && password) {
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { full_name, account_type }
      });
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = authData.user.id;
    } else if (phone) {
      // For phone-based registration, check if user exists
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('phone_number', phone)
        .maybeSingle();

      if (existingProfile) {
        userId = existingProfile.id;
      } else {
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          phone,
          phone_confirm: true,
          user_metadata: { full_name, account_type }
        });
        if (authError) {
          return new Response(JSON.stringify({ error: authError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        userId = authData.user.id;
      }
    } else {
      // Email without password - send magic link flow
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { full_name, account_type }
      });
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = authData.user.id;
    }

    // Step 2: Assign role
    const roleMap: Record<string, string> = {
      personal: 'personal',
      merchant: 'merchant',
      institution: 'institution',
      developer: 'developer'
    };

    await adminClient.from('user_roles').upsert({
      user_id: userId,
      role: roleMap[account_type]
    }, { onConflict: 'user_id,role' });

    // Step 3: Create entity record based on account_type
    let entityId: string = userId;
    let entityType = account_type;
    const nextSteps: string[] = [];

    switch (account_type) {
      case 'personal': {
        nextSteps.push('verify_identity', 'set_pin', 'complete_kyc');
        break;
      }
      case 'merchant': {
        const { data: merchant, error: merchantError } = await adminClient
          .from('gateway_merchants')
          .insert({
            user_id: userId,
            business_name: business_name || org_name || full_name || 'My Business',
            status: 'active',
            onboarding_status: 'draft',
            country: 'CM',
            currency: 'XAF'
          })
          .select('id')
          .single();

        if (merchantError) {
          console.error('Merchant creation error:', merchantError);
          return new Response(JSON.stringify({ error: 'Failed to create merchant record' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        entityId = merchant.id;
        nextSteps.push('complete_business_profile', 'upload_kyb_documents', 'configure_settlement');
        break;
      }
      case 'institution': {
        // Delegate to existing institution-register edge function internally
        const { data: institution, error: instError } = await adminClient
          .from('institutions')
          .insert({
            user_id: userId,
            institution_name: institution_name || org_name || 'My Institution',
            institution_type: institution_type || 'fintech_institution',
            status: 'draft',
            country: 'CM'
          })
          .select('id')
          .single();

        if (instError) {
          console.error('Institution creation error:', instError);
          return new Response(JSON.stringify({ error: 'Failed to create institution record' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        entityId = institution.id;
        nextSteps.push('complete_institution_profile', 'upload_kyb_documents', 'await_admin_approval');
        break;
      }
      case 'developer': {
        const { data: devOrg, error: devError } = await adminClient
          .from('developer_orgs')
          .insert({
            user_id: userId,
            name: org_name || business_name || full_name || 'My Developer Org',
            status: 'sandbox_active',
            country: 'CM'
          })
          .select('id')
          .single();

        if (devError) {
          console.error('Developer org creation error:', devError);
          return new Response(JSON.stringify({ error: 'Failed to create developer organization' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        entityId = devOrg.id;
        entityType = 'developer_org';
        nextSteps.push('create_sandbox_app', 'explore_api_docs', 'request_production_access');
        break;
      }
    }

    // Step 4: Create onboarding application
    await adminClient.from('onboarding_applications').insert({
      entity_type: entityType === 'developer' ? 'developer_org' : entityType,
      entity_id: entityId,
      user_id: userId,
      status: account_type === 'developer' ? 'approved' : 'draft',
      metadata: { account_type, registered_via: 'identity-register' }
    });

    // Step 5: Create identity membership
    await adminClient.from('identity_memberships').insert({
      user_id: userId,
      entity_type: entityType === 'developer' ? 'developer_org' : (entityType === 'personal' ? 'platform' : entityType),
      entity_id: entityId,
      role: account_type === 'personal' ? 'user' : 'owner',
      status: 'active'
    });

    // Step 6: Audit log
    await adminClient.from('audit_logs').insert({
      action_type: 'identity_register',
      entity_type: entityType,
      entity_id: entityId,
      performed_by: userId,
      details: { account_type, method: email ? 'email' : 'phone' }
    });

    return new Response(JSON.stringify({
      user_id: userId,
      entity_id: entityId,
      entity_type: entityType,
      account_type,
      next_steps: nextSteps,
      provisional_token: provisionalToken
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'identity-register');
  }
});
