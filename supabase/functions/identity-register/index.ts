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
      business_email, business_phone, business_type,
      institution_name, institution_type, registration_number
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

    // ──────────────────────────────────────────────────────────
    // FIX 1: Check Authorization header to reuse authenticated user
    // ──────────────────────────────────────────────────────────
    let userId: string | null = null;

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: authUser } } = await userClient.auth.getUser();
      if (authUser) {
        userId = authUser.id;
        console.log('identity-register: reusing authenticated user', userId);
      }
    }

    // ──────────────────────────────────────────────────────────
    // FIX 2: If no authenticated user, reconcile by phone/email
    // ──────────────────────────────────────────────────────────
    if (!userId) {
      // Check profiles table first
      if (phone) {
        const { data: profile } = await adminClient
          .from('profiles')
          .select('id')
          .eq('phone_number', phone)
          .maybeSingle();
        if (profile) userId = profile.id;
      }

      // Check auth.users if still not found
      if (!userId) {
        const tempEmail = phone ? `${phone.replace('+', '')}@phone.kob.cm` : email;
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          u => u.email === tempEmail || u.phone === phone || (email && u.email === email)
        );
        if (existingUser) {
          userId = existingUser.id;
          console.log('identity-register: found existing auth user', userId);
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // Only create a new user if absolutely necessary
    // ──────────────────────────────────────────────────────────
    if (!userId) {
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
      } else {
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email: email!,
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
    }

    // ──────────────────────────────────────────────────────────
    // FIX 3: UPSERT profile instead of UPDATE
    // ──────────────────────────────────────────────────────────
    await adminClient.from('profiles').upsert({
      id: userId,
      ...(full_name ? { full_name } : {}),
      ...(phone ? { phone_number: phone } : {}),
      ...(email ? { email } : {}),
    }, { onConflict: 'id' });

    // Assign role
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

    // Create entity record based on account_type
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
            business_email: business_email || email || null,
            business_phone: business_phone || phone || null,
            status: 'active',
            onboarding_status: 'draft',
            metadata: {
              contact_person: contact_person || null,
              business_description: business_description || null,
              business_type: business_type || null,
              default_currency: default_currency || 'XAF',
              country: 'CM',
            }
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
        entityId = userId;
        nextSteps.push('complete_institution_registration', 'upload_kyb_documents', 'await_admin_approval');
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

    // Create onboarding application
    await adminClient.from('onboarding_applications').insert({
      entity_type: entityType === 'developer' ? 'developer_org' : entityType,
      entity_id: entityId,
      user_id: userId,
      status: account_type === 'developer' ? 'approved' : 'draft',
      metadata: { 
        account_type, 
        registered_via: 'identity-register',
        ...(account_type === 'institution' ? { institution_name, institution_type, registration_number } : {}),
      }
    });

    // Create identity membership
    await adminClient.from('identity_memberships').insert({
      user_id: userId,
      entity_type: entityType === 'developer' ? 'developer_org' : (entityType === 'personal' ? 'platform' : entityType),
      entity_id: entityId,
      role: account_type === 'personal' ? 'user' : 'owner',
      status: 'active'
    });

    // Audit log
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
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'identity-register');
  }
});
