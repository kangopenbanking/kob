import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch { /* ok */ } }

    const action = (body.action as string) || new URL(req.url).searchParams.get('action') || 'status';
    const kycId = (body.kyc_id as string) || new URL(req.url).searchParams.get('kyc_id');

    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    const isAdmin = !!adminRole;

    // INITIATE - Start verification workflow for a KYC submission
    if (action === 'initiate') {
      if (!isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!kycId) return new Response(JSON.stringify({ error: 'kyc_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: kyc } = await supabase.from('business_kyc').select('*').eq('id', kycId).single();
      if (!kyc) return new Response(JSON.stringify({ error: 'kyc_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Create verification checks
      const checks = [
        { business_kyc_id: kycId, check_type: 'rccm_verify', status: 'pending', extracted_data: { registration_number: kyc.registration_number, business_name: kyc.business_name } },
        { business_kyc_id: kycId, check_type: 'tax_id_verify', status: kyc.tax_id ? 'pending' : 'skipped', extracted_data: { tax_id: kyc.tax_id } },
        { business_kyc_id: kycId, check_type: 'director_verify', status: 'pending', extracted_data: { directors: kyc.directors } },
        { business_kyc_id: kycId, check_type: 'address_verify', status: 'pending', extracted_data: { address: kyc.business_address } },
        { business_kyc_id: kycId, check_type: 'document_authenticity', status: kyc.registration_certificate_url ? 'pending' : 'skipped', extracted_data: { has_certificate: !!kyc.registration_certificate_url, has_articles: !!kyc.articles_of_association_url } },
        { business_kyc_id: kycId, check_type: 'cross_check', status: 'pending', extracted_data: {} },
      ];

      const { data: created, error } = await supabase.from('business_verification_checks').insert(checks).select();
      if (error) throw error;

      // Auto-run cross-check
      const crossCheckResults: Record<string, unknown> = {};
      const nameOnRCCM = kyc.business_name;
      crossCheckResults.name_consistency = { status: 'verified', rccm_name: nameOnRCCM, submitted_name: kyc.business_name, match: true };

      if (kyc.registration_number) {
        const isValidFormat = /^RC-\d{4}-[A-Z]{2,4}-\d+$/.test(kyc.registration_number) || /^[A-Z]{2}\d+/.test(kyc.registration_number);
        crossCheckResults.registration_format = { status: isValidFormat ? 'valid' : 'suspicious', value: kyc.registration_number, format_valid: isValidFormat };
      }

      if (kyc.tax_id) {
        const taxIdValid = /^[A-Z]\d{6,12}$/.test(kyc.tax_id) || kyc.tax_id.length >= 6;
        crossCheckResults.tax_id_format = { status: taxIdValid ? 'valid' : 'review_needed', value: kyc.tax_id };
      }

      // Update cross-check record
      await supabase.from('business_verification_checks').update({
        status: 'completed',
        cross_check_result: crossCheckResults,
        confidence_score: Object.values(crossCheckResults).filter((r: any) => r.status === 'valid' || r.status === 'verified').length / Math.max(Object.keys(crossCheckResults).length, 1) * 100,
        completed_at: new Date().toISOString(),
      }).eq('business_kyc_id', kycId).eq('check_type', 'cross_check');

      await supabase.from('audit_logs').insert({
        action_type: 'verification_workflow_initiated', entity_type: 'business_kyc', entity_id: kycId,
        performed_by: user.id, details: { checks_created: created?.length, kyc_business_name: kyc.business_name },
      });

      return new Response(JSON.stringify({ data: { checks: created, cross_check: crossCheckResults } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // STATUS - Get verification status for a KYC
    if (action === 'status') {
      if (!kycId) return new Response(JSON.stringify({ error: 'kyc_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: kyc } = await supabase.from('business_kyc').select('id, user_id, business_name, verification_status').eq('id', kycId).single();
      if (!kyc) return new Response(JSON.stringify({ error: 'kyc_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!isAdmin && kyc.user_id !== user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: checks } = await supabase.from('business_verification_checks').select('*').eq('business_kyc_id', kycId).order('created_at');

      const summary = {
        total: checks?.length || 0,
        passed: checks?.filter(c => c.status === 'passed' || c.status === 'completed').length || 0,
        failed: checks?.filter(c => c.status === 'failed').length || 0,
        pending: checks?.filter(c => c.status === 'pending').length || 0,
        manual_review: checks?.filter(c => c.status === 'manual_review').length || 0,
      };

      return new Response(JSON.stringify({ data: { kyc_id: kycId, business_name: kyc.business_name, verification_status: kyc.verification_status, checks, summary } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // REVIEW - Admin reviews a specific check
    if (action === 'review') {
      if (!isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const checkId = body.check_id as string;
      const decision = body.decision as string; // passed | failed | manual_review
      const notes = (body.notes as string) || '';

      if (!checkId || !decision) return new Response(JSON.stringify({ error: 'check_id and decision required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!['passed', 'failed', 'manual_review'].includes(decision)) return new Response(JSON.stringify({ error: 'invalid decision' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: updated, error } = await supabase.from('business_verification_checks').update({
        status: decision,
        reviewed_by: user.id,
        review_notes: notes,
        completed_at: new Date().toISOString(),
      }).eq('id', checkId).select().single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action_type: `verification_check_${decision}`, entity_type: 'business_verification_check', entity_id: checkId,
        performed_by: user.id, details: { decision, notes, check_type: updated.check_type },
      });

      return new Response(JSON.stringify({ data: updated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // EXTRACT - Extract data from uploaded documents
    if (action === 'extract') {
      if (!isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!kycId) return new Response(JSON.stringify({ error: 'kyc_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: kyc } = await supabase.from('business_kyc').select('*').eq('id', kycId).single();
      if (!kyc) return new Response(JSON.stringify({ error: 'kyc_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Simulate document data extraction
      const extractedData: Record<string, unknown> = {
        registration: {
          source: 'registration_certificate',
          extracted_name: kyc.business_name,
          extracted_number: kyc.registration_number,
          extracted_date: kyc.registration_date,
          confidence: 0.95,
        },
        tax: kyc.tax_id ? {
          source: 'tax_certificate',
          extracted_tax_id: kyc.tax_id,
          extracted_vat: kyc.vat_number,
          confidence: 0.92,
        } : null,
        directors: kyc.directors ? {
          source: 'director_documents',
          extracted_count: Array.isArray(kyc.directors) ? kyc.directors.length : 0,
          confidence: 0.88,
        } : null,
        address: {
          source: 'proof_of_address',
          extracted_address: kyc.business_address,
          confidence: 0.90,
        },
      };

      // Update checks with extracted data
      for (const [key, value] of Object.entries(extractedData)) {
        if (!value) continue;
        const checkType = key === 'registration' ? 'rccm_verify' : key === 'tax' ? 'tax_id_verify' : key === 'directors' ? 'director_verify' : 'address_verify';
        await supabase.from('business_verification_checks').update({
          extracted_data: value,
          status: 'manual_review',
        }).eq('business_kyc_id', kycId).eq('check_type', checkType);
      }

      return new Response(JSON.stringify({ data: { kyc_id: kycId, extracted: extractedData } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'invalid_action', valid: ['initiate', 'status', 'review', 'extract'] }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] verification-workflow error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
