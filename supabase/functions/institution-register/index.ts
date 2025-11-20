import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const institutionRegisterSchema = z.object({
  institution_name: z.string()
    .trim()
    .min(2, 'Institution name must be at least 2 characters')
    .max(200, 'Institution name must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\s&.,'-]+$/, 'Institution name contains invalid characters'),
  institution_type: z.string().min(2).max(100),
  registration_number: z.string()
    .trim()
    .min(5, 'Registration number must be at least 5 characters')
    .max(50, 'Registration number must be less than 50 characters')
    .regex(/^[A-Z0-9-]+$/i, 'Registration number can only contain letters, numbers, and hyphens'),
  address: z.string()
    .trim()
    .min(10, 'Address must be at least 10 characters')
    .max(500, 'Address must be less than 500 characters'),
  phone: z.string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in international format (e.g., +237123456789)'),
  website: z.string()
    .trim()
    .url('Invalid website URL')
    .max(255, 'Website URL must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  use_kob_flutterwave: z.boolean().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const {
      institution_name,
      institution_type,
      registration_number,
      address,
      phone,
      website,
      use_kob_flutterwave,
    } = await req.json();

    // Validate input
    const validationResult = institutionRegisterSchema.safeParse({
      institution_name,
      institution_type,
      registration_number,
      address,
      phone,
      website,
      use_kob_flutterwave,
    });
    
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Registering institution:', { institution_name, institution_type, user_id: user.id });

    // Check if user already has a pending or approved institution
    const { data: existingInstitutions, error: checkError } = await supabaseAdmin
      .from('institutions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved']);

    if (checkError) {
      console.error('Error checking existing institutions:', checkError);
      throw new Error('Failed to check existing institutions');
    }

    if (existingInstitutions && existingInstitutions.length > 0) {
      throw new Error('You already have a pending or approved institution registration');
    }

    // Insert institution using service role (bypasses RLS)
    const { data: institution, error: institutionError } = await supabaseAdmin
      .from('institutions')
      .insert([{
        user_id: user.id,
        institution_name,
        institution_type,
        registration_number,
        address,
        phone,
        website: website || null,
        status: 'pending',
        verification_step: 'pending_kyb',
        use_kob_flutterwave: use_kob_flutterwave || false,
      }])
      .select()
      .single();

    if (institutionError) {
      console.error('Error inserting institution:', institutionError);
      
      // Check for duplicate registration number
      if (institutionError.code === '23505' && institutionError.message.includes('registration_number')) {
        throw new Error('This registration number is already in use. Please contact support if this is your institution.');
      }
      
      throw institutionError;
    }

    console.log('Institution created:', institution.id);

    // Assign institution role to user using service role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert([{
        user_id: user.id,
        role: 'institution',
        institution_id: institution.id,
      }]);

    // Ignore duplicate key errors
    if (roleError && roleError.code !== '23505') {
      console.error('Error inserting user role:', roleError);
      // Don't throw here, institution is already created
      // This is a non-critical error
    }

    // Log audit event
    await supabaseAdmin
      .from('audit_logs')
      .insert([{
        action_type: 'institution_registration',
        entity_type: 'institution',
        entity_id: institution.id,
        performed_by: user.id,
        details: {
          institution_name,
          institution_type,
          status: 'pending'
        }
      }]);

    console.log('Institution registration successful');

    return new Response(
      JSON.stringify({
        success: true,
        institution_id: institution.id,
        message: 'Institution registered successfully. Please submit Business KYC documents to continue.',
        next_step: 'kyb_submission',
        redirect_url: '/business-kyb-submission'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Registration error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to register institution',
        details: error.details || null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
