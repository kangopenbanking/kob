import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Send OTP via SMS using Vonage
async function sendViaSMS(phoneNumber: string, otpCode: string): Promise<boolean> {
  try {
    const vonageKey = Deno.env.get('VONAGE_API_KEY');
    const vonageSecret = Deno.env.get('VONAGE_API_SECRET');

    if (!vonageKey || !vonageSecret) {
      console.error('Vonage credentials not configured');
      return false;
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
    return result.messages?.[0]?.status === '0';
  } catch (error) {
    console.error('SMS sending failed:', error);
    return false;
  }
}

// Send OTP via WhatsApp using Meta Business API
async function sendViaWhatsApp(phoneNumber: string, otpCode: string): Promise<boolean> {
  try {
    const whatsappToken = Deno.env.get('WHATSAPP_API_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!whatsappToken || !phoneNumberId) {
      console.error('WhatsApp credentials not configured');
      return false;
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
      return true;
    } else {
      console.warn('WhatsApp send failed:', result);
      return false;
    }
  } catch (error) {
    console.error('WhatsApp sending failed:', error instanceof Error ? error.message : String(error));
    return false;
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
    let smsSent = false;
    let whatsappSent = false;
    let actualDeliveryMethod = delivery_method;

    if (delivery_method === 'sms' || delivery_method === 'both') {
      smsSent = await sendViaSMS(phone_number, otpCode);
    }

    if (delivery_method === 'whatsapp' || delivery_method === 'both') {
      whatsappSent = await sendViaWhatsApp(phone_number, otpCode);
      
      // Automatic fallback to SMS if WhatsApp fails and SMS wasn't already tried
      if (!whatsappSent && delivery_method === 'whatsapp') {
        console.log('WhatsApp failed, falling back to SMS');
        smsSent = await sendViaSMS(phone_number, otpCode);
        if (smsSent) {
          actualDeliveryMethod = 'sms';
        }
      }
    }

    // Check if at least one delivery succeeded
    const deliverySuccessful = smsSent || whatsappSent;

    if (!deliverySuccessful) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send OTP via any delivery method',
          details: 'Both SMS and WhatsApp delivery failed. Please check your phone number and try again.'
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
        sms_sent: smsSent,
        sms_sent_at: smsSent ? new Date().toISOString() : null,
        whatsapp_sent: whatsappSent,
        whatsapp_sent_at: whatsappSent ? new Date().toISOString() : null,
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
          sms: smsSent,
          whatsapp: whatsappSent,
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
