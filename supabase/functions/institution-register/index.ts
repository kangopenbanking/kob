import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const institutionRegisterSchema = z.object({
  institution_name: z.string().trim().min(2).max(200)
    .regex(/^[a-zA-Z0-9\s&.,'-]+$/, 'Institution name contains invalid characters'),
  institution_type: z.string().min(2).max(100),
  registration_number: z.string().trim().min(5).max(50)
    .regex(/^[A-Z0-9-]+$/i, 'Registration number can only contain letters, numbers, and hyphens'),
  address: z.string().trim().min(10).max(500),
  phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in international format'),
  website: z.string().trim().url().max(255).optional().or(z.literal('')),
  use_kob_flutterwave: z.boolean().optional(),
});

// Default Banking App config auto-assigned to every new institution
function buildDefaultAppConfig(institutionName: string) {
  return {
    features: {
      cards: true,
      savings: true,
      loans: true,
      credit_score: true,
      mobile_money: true,
      qr_payments: true,
      bill_payments: true,
      transfers: true,
      account_funding: true,
      notifications: true,
    },
    home_layout: {
      show_balance_card: true,
      show_quick_actions: true,
      show_recent_transactions: true,
      show_promo_banner: true,
    },
    section_order: [
      'balance_card',
      'quick_actions',
      'recent_transactions',
      'promo_banner',
    ],
    layout_style: 'modern',
    walkthrough_config: { skip_enabled: true },
    card_colors: {},
    support_phone: '',
    support_email: '',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();

    const validationResult = institutionRegisterSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { institution_name, institution_type, registration_number, address, phone, website, use_kob_flutterwave } = validationResult.data;

    console.log('Registering institution:', { institution_name, institution_type, user_id: user.id });

    // Check existing
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('institutions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved']);

    if (checkError) throw new Error('Failed to check existing institutions');
    if (existing && existing.length > 0) throw new Error('You already have a pending or approved institution registration');

    // Insert with default app_config
    const defaultAppConfig = buildDefaultAppConfig(institution_name);

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
        app_config: defaultAppConfig,
      }])
      .select()
      .single();

    if (institutionError) {
      if (institutionError.code === '23505' && institutionError.message.includes('registration_number')) {
        throw new Error('This registration number is already in use.');
      }
      throw institutionError;
    }

    console.log('Institution created with app_config:', institution.id);

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert([{ user_id: user.id, role: 'institution', institution_id: institution.id }]);
    if (roleError && roleError.code !== '23505') {
      console.error('Error inserting user role:', roleError);
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert([{
      action_type: 'institution_registration',
      entity_type: 'institution',
      entity_id: institution.id,
      performed_by: user.id,
      details: { institution_name, institution_type, status: 'pending' },
    }]);

    return new Response(
      JSON.stringify({
        success: true,
        institution_id: institution.id,
        message: 'Institution registered successfully. Please submit Business KYC documents to continue.',
        next_step: 'kyb_submission',
        redirect_url: '/business-kyb-submission',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to register institution', details: error.details || null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
