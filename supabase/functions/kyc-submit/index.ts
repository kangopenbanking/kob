import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/admin-notify.ts";

// Validation schema for KYC submission
const kycSubmissionSchema = z.object({
  verification_type: z.enum(['identity', 'address', 'business']),
  document_type: z.string()
    .min(2, 'Document type too short')
    .max(50, 'Document type too long')
    .regex(/^[a-zA-Z0-9_\s-]+$/, 'Invalid characters in document type'),
  document_number: z.string()
    .min(5, 'Document number too short')
    .max(50, 'Document number too long')
    .regex(/^[A-Z0-9-]+$/i, 'Document number must contain only letters, numbers, and hyphens'),
  document_country: z.string()
    .min(2, 'Country code must be at least 2 characters')
    .max(50, 'Country code too long'),
  document_expiry_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(date => new Date(date) > new Date(), 'Document must not be expired'),
  document_front_url: z.string()
    .min(1, 'Document front is required'),
  document_back_url: z.string()
    .min(1)
    .optional(),
  selfie_url: z.string()
    .min(1, 'Selfie is required')
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const requestBody = await req.json();
    
    // Validate input data
    let validatedData;
    try {
      validatedData = kycSubmissionSchema.parse(requestBody);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return new Response(
          JSON.stringify({ 
            error: 'Validation failed', 
            details: validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`)
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw validationError;
    }

    const {
      verification_type,
      document_type,
      document_number,
      document_country,
      document_expiry_date,
      document_front_url,
      document_back_url,
      selfie_url
    } = validatedData;

    // ---------------------------------------------------------------
    // Deduplication guard: block re-submission if user already has an
    // approved or pending verification. Rejected/info_requested users
    // may freely resubmit.
    // ---------------------------------------------------------------
    const { data: existing } = await supabase
      .from('kyc_verifications')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.status === 'approved') {
      return new Response(
        JSON.stringify({ error: 'Your identity is already verified. No further action is required.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (existing?.status === 'pending') {
      return new Response(
        JSON.stringify({
          error: 'A verification is already under review. Please wait for the outcome before submitting again.',
          verification_id: existing.id,
          status: 'pending',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert KYC verification record
    const { data: verification, error: verificationError } = await supabase
      .from('kyc_verifications')
      .insert({
        user_id: user.id,
        verification_type,
        document_type,
        document_number,
        document_country,
        document_expiry_date,
        document_front_url,
        document_back_url,
        selfie_url,
        status: 'pending',
        verification_method: 'manual'
      })
      .select()
      .single();

    if (verificationError) {
      console.error('Error creating KYC verification:', verificationError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit KYC verification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      _user_id: user.id,
      _event_type: 'kyc_submission',
      _event_category: 'compliance',
      _metadata: { verification_id: verification.id, verification_type }
    });

    // Look up user profile for notifications
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    // Acknowledgment email to the submitting user (non-blocking)
    if (profile?.email || user.email) {
      try {
        await supabase.functions.invoke('send-communication', {
          body: {
            template_key: 'kyc_submitted',
            recipient_email: profile?.email || user.email,
            recipient_id: user.id,
            variables: {
              recipient_name: profile?.full_name || 'Valued Customer',
              verification_id: verification.id,
              submitted_at: new Date().toLocaleString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              }),
            },
          },
        });
      } catch (ackErr) {
        console.error('Submission ack email failed (non-blocking):', ackErr);
      }
    }

    // In-app notification for the user
    try {
      await supabase.from('app_notifications').insert({
        user_id: user.id,
        type: 'info',
        title: 'Verification submitted',
        message: 'Thanks — we received your documents and our team will review them shortly.',
        icon: 'kyc',
        metadata: { verification_id: verification.id, status: 'pending' },
      });
    } catch (notifErr) {
      console.error('User in-app notification failed (non-blocking):', notifErr);
    }

    // Notify all admins about new KYC submission
    await notifyAdmins(supabase, {
      event_type: 'kyc_submitted',
      entity_type: 'kyc_verifications',
      entity_id: verification.id,
      title: 'New KYC Submission',
      message: `${profile?.full_name || user.email} submitted ${verification_type} verification for review.`,
      metadata: { verification_type, document_type, document_country },
    });

    // Trigger automated sanctions screening
    try {
      await supabase.functions.invoke('sanctions-screen', {
        body: {
          full_name: profile?.full_name || user.email,
          date_of_birth: document_expiry_date,
          nationality: document_country,
          document_number
        }
      });
    } catch (screeningError) {
      console.error('Sanctions screening error:', screeningError);
      // Continue even if screening fails - will be flagged for manual review
    }

    return new Response(
      JSON.stringify({
        success: true,
        verification_id: verification.id,
        status: verification.status,
        message: 'KYC verification submitted successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );


  } catch (error) {
    console.error('Error in kyc-submit:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
