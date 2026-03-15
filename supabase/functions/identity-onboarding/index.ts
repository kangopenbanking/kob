import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { safeErrorResponse } from '../_shared/errors.ts';
import { notifyAdmins } from '../_shared/admin-notify.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const { action, entity_type, entity_id, ...params } = body;

    switch (action) {
      case 'start': {
        if (!entity_type) {
          return new Response(JSON.stringify({ error: 'entity_type required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if already exists
        const { data: existing } = await adminClient
          .from('onboarding_applications')
          .select('id, status')
          .eq('user_id', userId)
          .eq('entity_type', entity_type)
          .maybeSingle();

        if (existing) {
          return new Response(JSON.stringify({
            application_id: existing.id,
            status: existing.status,
            message: 'Onboarding application already exists'
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: app, error: appError } = await adminClient
          .from('onboarding_applications')
          .insert({
            entity_type,
            entity_id: entity_id || userId,
            user_id: userId,
            status: 'draft',
            metadata: params.metadata || {}
          })
          .select('id, status')
          .single();

        if (appError) {
          return new Response(JSON.stringify({ error: 'Failed to create application' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          application_id: app.id,
          status: app.status,
          next_steps: getNextSteps(entity_type, 'draft')
        }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'submit': {
        if (!entity_id) {
          return new Response(JSON.stringify({ error: 'entity_id required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: app, error } = await adminClient
          .from('onboarding_applications')
          .update({
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', entity_id)
          .eq('user_id', userId)
          .eq('status', 'draft')
          .select('id, status, entity_type')
          .single();

        if (error || !app) {
          return new Response(JSON.stringify({ error: 'Application not found or already submitted' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await adminClient.from('audit_logs').insert({
          action_type: 'onboarding_submitted',
          entity_type: app.entity_type,
          entity_id: app.id,
          performed_by: userId,
          details: { application_id: app.id }
        });

        return new Response(JSON.stringify({
          application_id: app.id,
          status: 'submitted',
          message: 'Your application has been submitted for review'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'status': {
        const query = adminClient
          .from('onboarding_applications')
          .select('id, entity_type, entity_id, status, submitted_at, reviewed_at, notes, created_at, updated_at')
          .eq('user_id', userId);

        if (entity_id) query.eq('id', entity_id);
        if (entity_type) query.eq('entity_type', entity_type);

        const { data: apps } = await query.order('created_at', { ascending: false });

        return new Response(JSON.stringify({ applications: apps || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'documents': {
        // This integrates with existing KYC/KYB document storage
        if (!entity_id) {
          return new Response(JSON.stringify({ error: 'entity_id required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { doc_type, file_url, metadata: docMetadata } = params;

        if (!doc_type || !file_url) {
          return new Response(JSON.stringify({ error: 'doc_type and file_url required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Store document reference in existing kyc tables or onboarding metadata
        const { data: app } = await adminClient
          .from('onboarding_applications')
          .select('id, metadata')
          .eq('id', entity_id)
          .eq('user_id', userId)
          .single();

        if (!app) {
          return new Response(JSON.stringify({ error: 'Application not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const existingDocs = (app.metadata as any)?.documents || [];
        existingDocs.push({
          doc_type,
          file_url,
          metadata: docMetadata,
          uploaded_at: new Date().toISOString()
        });

        await adminClient.from('onboarding_applications').update({
          metadata: { ...(app.metadata as any), documents: existingDocs },
          updated_at: new Date().toISOString()
        }).eq('id', entity_id);

        return new Response(JSON.stringify({ success: true, document_count: existingDocs.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'admin-review': {
        // Admin approve/reject
        const isAdmin = await adminClient.rpc('has_role', { _user_id: userId, _role: 'admin' });
        if (!isAdmin.data) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { application_id, decision, review_notes } = params;
        if (!application_id || !decision || !['approved', 'rejected'].includes(decision)) {
          return new Response(JSON.stringify({ error: 'application_id and decision (approved|rejected) required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: app, error: reviewError } = await adminClient
          .from('onboarding_applications')
          .update({
            status: decision,
            reviewed_at: new Date().toISOString(),
            reviewer_user_id: userId,
            notes: review_notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', application_id)
          .in('status', ['submitted', 'under_review'])
          .select('id, entity_type, entity_id, user_id, status')
          .single();

        if (reviewError || !app) {
          return new Response(JSON.stringify({ error: 'Application not found or cannot be reviewed' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update entity status based on decision
        if (decision === 'approved') {
          switch (app.entity_type) {
            case 'merchant':
              await adminClient.from('gateway_merchants').update({ onboarding_status: 'active' }).eq('id', app.entity_id);
              break;
            case 'institution':
              await adminClient.from('institutions').update({ status: 'approved' }).eq('id', app.entity_id);
              break;
            case 'developer_org':
              await adminClient.from('developer_orgs').update({ status: 'prod_approved' }).eq('id', app.entity_id);
              break;
          }
        }

        // Notify user
        await adminClient.from('app_notifications').insert({
          user_id: app.user_id,
          type: decision === 'approved' ? 'success' : 'warning',
          title: `Onboarding ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
          message: decision === 'approved'
            ? 'Your application has been approved. You now have full access.'
            : `Your application was not approved. ${review_notes || 'Please contact support.'}`,
          icon: 'onboarding',
          metadata: { application_id, decision }
        });

        await adminClient.from('audit_logs').insert({
          action_type: `onboarding_${decision}`,
          entity_type: app.entity_type,
          entity_id: app.entity_id,
          performed_by: userId,
          details: { application_id, decision, notes: review_notes }
        });

        return new Response(JSON.stringify({
          application_id: app.id,
          status: decision,
          message: `Application ${decision}`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'identity-onboarding');
  }
});

function getNextSteps(entityType: string, status: string): string[] {
  const steps: Record<string, Record<string, string[]>> = {
    personal: {
      draft: ['complete_profile', 'upload_id_document', 'submit_for_verification'],
      submitted: ['await_review'],
      approved: ['set_pin', 'explore_dashboard']
    },
    merchant: {
      draft: ['complete_business_profile', 'upload_kyb_documents', 'configure_settlement', 'submit_application'],
      submitted: ['await_admin_review'],
      approved: ['create_api_keys', 'configure_webhooks', 'start_accepting_payments']
    },
    institution: {
      draft: ['complete_institution_profile', 'upload_compliance_documents', 'submit_application'],
      submitted: ['await_compliance_review'],
      approved: ['create_api_clients', 'configure_webhooks', 'onboard_customers']
    },
    developer_org: {
      draft: ['complete_org_profile', 'create_sandbox_app'],
      submitted: ['await_review'],
      approved: ['create_production_keys', 'integrate_api']
    }
  };

  return steps[entityType]?.[status] || ['contact_support'];
}
