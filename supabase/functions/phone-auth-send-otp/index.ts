import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

// Manual phone validation (replaced zod to avoid import timeout)
function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone || typeof phone !== 'string') return { valid: false, error: 'Phone number is required' };
  const trimmed = phone.trim();
  if (trimmed.length < 8) return { valid: false, error: 'Phone number is too short' };
  if (trimmed.length > 16) return { valid: false, error: 'Phone number is too long' };
  if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) return { valid: false, error: 'Phone must be in international format (e.g., +237123456789)' };
  return { valid: true };
}

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

type EmailResult = {
  success: boolean;
  error_code?: 'SERVICE_UNAVAILABLE' | 'DELIVERY_FAILED' | 'INVALID_EMAIL';
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

// Send OTP via Email using managed-send-email
async function sendViaEmail(emailAddress: string, otpCode: string): Promise<EmailResult> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const response = await fetch(`${supabaseUrl}/functions/v1/managed-send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        to: emailAddress,
        subject: 'Your KOB Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1a1a1a; margin-bottom: 16px;">Verification Code</h2>
            <p style="color: #555; font-size: 15px; line-height: 1.5;">Your Kang Open Banking verification code is:</p>
            <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${otpCode}</span>
            </div>
            <p style="color: #555; font-size: 14px;">This code is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      }),
    });

    const result = await response.json();

    if (response.ok && !result.error) {
      console.log('OTP email sent successfully to:', emailAddress);
      return { success: true };
    } else {
      console.error('Email send failed:', result);
      return { success: false, error_code: 'DELIVERY_FAILED', error_message: result.error || 'Failed to send email' };
    }
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error_code: 'SERVICE_UNAVAILABLE', error_message: 'Email service unavailable' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone_number, email_address, otp_type, delivery_method = 'both', captcha_session_id } = await req.json();

    // Admin-managed provider toggle. Block SMS server-side when admin disabled it.
    const env = (Deno.env.get('APP_ENV') || Deno.env.get('SUPABASE_ENV') || 'production') as
      'development' | 'preview' | 'production';
    const { data: providerCfg } = await supabase
      .from('otp_provider_settings')
      .select('firebase_enabled, sms_fallback_enabled')
      .eq('environment', env)
      .eq('role_scope', 'all')
      .maybeSingle();
    const smsAllowed = providerCfg ? providerCfg.sms_fallback_enabled !== false : true;
    const isEmailDeliveryEarly = delivery_method === 'email';
    if (!smsAllowed && !isEmailDeliveryEarly && (delivery_method === 'sms' || delivery_method === 'auto' || delivery_method === 'both')) {
      console.warn(`[phone-auth-send-otp] Vonage SMS disabled by admin for env=${env}`);
      return new Response(
        JSON.stringify({
          error: 'SMS OTP is disabled by administrator for this environment',
          error_code: 'SMS_DISABLED_BY_ADMIN',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // For email delivery, phone_number is optional; for phone delivery, phone_number is required
    const isEmailDelivery = delivery_method === 'email';
    
    if (!isEmailDelivery) {
      // Validate phone input for non-email delivery
      const phoneValidation = validatePhone(phone_number);
      if (!phoneValidation.valid) {
        return new Response(
          JSON.stringify({ error: phoneValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (isEmailDelivery && !email_address) {
      return new Response(
        JSON.stringify({ error: 'email_address is required for email delivery' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isEmailDelivery && !phone_number) {
      return new Response(
        JSON.stringify({ error: 'phone_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!otp_type || !captcha_session_id) {
      return new Response(
        JSON.stringify({ error: 'otp_type and captcha_session_id are required' }),
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

    // Rate limiting: check recent OTP requests for this identifier
    const rateLimitIdentifier = isEmailDelivery ? email_address : phone_number;
    const { data: recentOTPs } = await supabase
      .from('phone_otp_codes')
      .select('created_at')
      .eq('phone_number', rateLimitIdentifier)
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
    let emailResult: EmailResult = { success: false };
    let actualDeliveryMethod = delivery_method;
    let lastErrorCode: string | undefined;
    let lastErrorMessage: string | undefined;

    if (isEmailDelivery) {
      emailResult = await sendViaEmail(email_address, otpCode);
      if (!emailResult.success) {
        lastErrorCode = emailResult.error_code;
        lastErrorMessage = emailResult.error_message;
      }
    } else {
      if (delivery_method === 'sms' || delivery_method === 'auto' || delivery_method === 'both') {
        smsResult = await sendViaSMS(phone_number, otpCode);
        if (!smsResult.success) {
          lastErrorCode = smsResult.error_code;
          lastErrorMessage = smsResult.error_message;
        }
      }

      if (delivery_method === 'whatsapp' || delivery_method === 'auto' || delivery_method === 'both') {
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
    }

    // Check if at least one delivery succeeded
    const deliverySuccessful = smsResult.success || whatsappResult.success || emailResult.success;

    if (!deliverySuccessful) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send OTP',
          error_code: lastErrorCode || 'DELIVERY_FAILED',
          details: lastErrorMessage || 'Unable to deliver verification code. Please try again.',
          delivery_attempts: {
            sms: { success: smsResult.success, error: smsResult.error_message },
            whatsapp: { success: whatsappResult.success, error: whatsappResult.error_message },
            email: { success: emailResult.success, error: emailResult.error_message }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Hash OTP before storage (SHA-256)
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(otpCode));
    const otpHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Store hashed OTP in database (use email as phone_number field for email delivery)
    const { data: otpRecord, error: insertError } = await supabase
      .from('phone_otp_codes')
      .insert({
        phone_number: isEmailDelivery ? email_address : phone_number,
        otp_code: otpHash,
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

    const identifier = isEmailDelivery ? email_address : phone_number;
    console.log(`OTP sent to ${identifier} via ${delivery_method}: [REDACTED]`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP sent successfully',
        delivery_status: {
          sms: smsResult.success,
          whatsapp: whatsappResult.success,
          email: emailResult.success,
        },
        expires_at: expiresAt,
        otp_id: otpRecord.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Send OTP error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send OTP. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
