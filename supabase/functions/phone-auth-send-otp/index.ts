import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders } from "../_shared/cors.ts";

// Input validation schema
const sendOtpSchema = z.object({
  phone: z.string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in international format (e.g., +237123456789)')
    .min(8, 'Phone number is too short')
    .max(15, 'Phone number is too long'),
  method: z.enum(['sms', 'whatsapp', 'auto']).optional(),
});

// Error codes for specific failure scenarios
type SMSResult = {
  success: boolean;
  error_code?: 'QUOTA_EXCEEDED' | 'INVALID_CREDENTIALS' | 'SERVICE_UNAVAILABLE' | 'DELIVERY_FAILED';
  error_message?: string;
};

type WhatsAppResult = {
  success: boolean;
  error_code?: 'INVALID_CREDENTIALS' | 'SERVICE_UNAVAILABLE' | 'DELIVERY_FAILED';
  error_message?: string;
};

// Send OTP via SMS using Vonage
async function sendViaSMS(phoneNumber: string, otpCode: string): Promise<SMSResult> {
  try {
    const vonageKey = Deno.env.get('VONAGE_API_KEY');
    const vonageSecret = Deno.env.get('VONAGE_API_SECRET');

    if (!vonageKey || !vonageSecret) {
      console.error('Vonage credentials not configured');
      return { success: false, error_code: 'INVALID_CREDENTIALS', error_message: 'SMS service not configured' };
    }

    const response = await fetch('https://rest.nexmo.com/sms/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'KOB API',
        to: phoneNumber,
        text: `Your Kang Open Banking verification code is: ${otpCode}. Valid for 10 minutes. Do not share this code.`,
        api_key: vonageKey,
        api_secret: vonageSecret,
      }),
    });

    const result = await response.json();
    console.log('SMS sent via Vonage:', result);
    
    const messageStatus = result.messages?.[0]?.status;
    const errorText = result.messages?.[0]?.['error-text'] || '';
    
    // Vonage status codes: 0 = success, 9 = quota exceeded, others = various errors
    if (messageStatus === '0') {
      return { success: true };
    } else if (messageStatus === '9') {
      console.error('Vonage quota exceeded:', errorText);
      return { success: false, error_code: 'QUOTA_EXCEEDED', error_message: 'SMS quota exceeded. Please try again later or use WhatsApp.' };
    } else if (messageStatus === '4' || messageStatus === '5') {
      return { success: false, error_code: 'INVALID_CREDENTIALS', error_message: 'SMS service authentication failed' };
    } else {
      return { success: false, error_code: 'DELIVERY_FAILED', error_message: errorText || 'Failed to deliver SMS' };
    }
  } catch (error) {
    console.error('SMS sending failed:', error);
    return { success: false, error_code: 'SERVICE_UNAVAILABLE', error_message: 'SMS service unavailable' };
  }
}

// Send OTP via WhatsApp using Meta Business API
async function sendViaWhatsApp(phoneNumber: string, otpCode: string): Promise<WhatsAppResult> {
  try {
    const whatsappToken = Deno.env.get('WHATSAPP_API_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!whatsappToken || !phoneNumberId) {
      console.error('WhatsApp credentials not configured');
      return { success: false, error_code: 'INVALID_CREDENTIALS', error_message: 'WhatsApp service not configured' };
    }

    // Try sending as regular text message (works if conversation is active)
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: {
            preview_url: false,
            body: `Your Kang Open Banking verification code is: ${otpCode}\n\nValid for 10 minutes. Do not share this code.\n\nIf you didn't request this, please ignore.`
          }
        })
      }
    );

    const result = await response.json();
    
    if (result.messages?.[0]?.id) {
      console.log('WhatsApp message sent successfully:', result.messages[0].id);
      return { success: true };
    } else {
      console.warn('WhatsApp send failed:', result);
      return { success: false, error_code: 'DELIVERY_FAILED', error_message: result.error?.message || 'WhatsApp delivery failed' };
    }
  } catch (error) {
    console.error('WhatsApp sending failed:', error instanceof Error ? error.message : String(error));
    return { success: false, error_code: 'SERVICE_UNAVAILABLE', error_message: 'WhatsApp service unavailable' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone_number, otp_type, delivery_method = 'both', captcha_session_id } = await req.json();

    // Validate input
    const validationResult = sendOtpSchema.safeParse({ phone: phone_number, method: delivery_method });
    
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid phone number format', 
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!phone_number || !otp_type || !captcha_session_id) {
      return new Response(
        JSON.stringify({ error: 'phone_number, otp_type, and captcha_session_id are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify captcha session
    const { data: captcha, error: captchaError } = await supabase
      .from('captcha_challenges')
      .select('*')
      .eq('session_id', captcha_session_id)
      .eq('status', 'verified')
      .single();

    if (captchaError || !captcha) {
      return new Response(
        JSON.stringify({ error: 'Invalid or unverified captcha session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Rate limiting: check recent OTP requests for this phone
    const { data: recentOTPs } = await supabase
      .from('phone_otp_codes')
      .select('created_at')
      .eq('phone_number', phone_number)
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (recentOTPs && recentOTPs.length >= 3) {
      return new Response(
        JSON.stringify({ error: 'Too many OTP requests. Please try again in 15 minutes.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    // Send via selected delivery method(s) with automatic fallback
    let smsResult: SMSResult = { success: false };
    let whatsappResult: WhatsAppResult = { success: false };
    let actualDeliveryMethod = delivery_method;
    let lastErrorCode: string | undefined;
    let lastErrorMessage: string | undefined;

    if (delivery_method === 'sms' || delivery_method === 'auto') {
      smsResult = await sendViaSMS(phone_number, otpCode);
      if (!smsResult.success) {
        lastErrorCode = smsResult.error_code;
        lastErrorMessage = smsResult.error_message;
      }
    }

    if (delivery_method === 'whatsapp' || delivery_method === 'auto') {
      whatsappResult = await sendViaWhatsApp(phone_number, otpCode);
      if (!whatsappResult.success) {
        lastErrorCode = whatsappResult.error_code;
        lastErrorMessage = whatsappResult.error_message;
      }
      
      // Automatic fallback to SMS if WhatsApp fails and SMS wasn't already tried
      if (!whatsappResult.success && delivery_method === 'whatsapp') {
        console.log('WhatsApp failed, falling back to SMS');
        smsResult = await sendViaSMS(phone_number, otpCode);
        if (smsResult.success) {
          actualDeliveryMethod = 'sms';
        } else {
          lastErrorCode = smsResult.error_code;
          lastErrorMessage = smsResult.error_message;
        }
      }
    }

    // Check if at least one delivery succeeded
    const deliverySuccessful = smsResult.success || whatsappResult.success;

    if (!deliverySuccessful) {
      // Return specific error code for better client-side handling
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send OTP',
          error_code: lastErrorCode || 'DELIVERY_FAILED',
          details: lastErrorMessage || 'Unable to deliver verification code. Please check your phone number and try again.',
          delivery_attempts: {
            sms: { success: smsResult.success, error: smsResult.error_message },
            whatsapp: { success: whatsappResult.success, error: whatsappResult.error_message }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Store OTP in database
    const { data: otpRecord, error: insertError } = await supabase
      .from('phone_otp_codes')
      .insert({
        phone_number,
        otp_code: otpCode,
        otp_type,
        delivery_method: actualDeliveryMethod,
        expires_at: expiresAt,
        sms_sent: smsResult.success,
        sms_sent_at: smsResult.success ? new Date().toISOString() : null,
        whatsapp_sent: whatsappResult.success,
        whatsapp_sent_at: whatsappResult.success ? new Date().toISOString() : null,
        ip_address: clientIp,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store OTP:', insertError);
      throw new Error('Failed to store OTP record');
    }

    console.log(`OTP sent to ${phone_number} via ${delivery_method}: ${otpCode}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP sent successfully',
        delivery_status: {
          sms: smsResult.success,
          whatsapp: whatsappResult.success,
        },
        expires_at: expiresAt,
        otp_id: otpRecord.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Send OTP error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send OTP', details: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
