// Sends a parallel email OTP for a registered user, in addition to the
// primary Firebase / Vonage SMS OTP. The user can verify with either code.
//
// Looks up the registered email by phone (auth.users or profiles), generates
// a 6-digit code, stores it in phone_otp_codes (keyed by email) so the
// existing phone-auth-verify-otp can validate it, and delivers via the
// managed-send-email Edge Function. Fails silently if no email is on file.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

function validPhone(p: unknown): p is string {
  return typeof p === 'string' && /^\+[1-9]\d{6,14}$/.test(p.trim());
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function lookupEmailByPhone(supabase: any, phone: string): Promise<string | null> {
  try {
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = list?.users?.find((u: any) => u.phone === phone.replace(/^\+/, '') || u.phone === phone);
    if (match?.email && !match.email.endsWith('@kang.id')) return match.email;
  } catch (e) {
    console.warn('[email-otp] auth.admin.listUsers failed:', (e as Error).message);
  }
  try {
    const { data } = await supabase
      .from('profiles')
      .select('email')
      .eq('phone_number', phone)
      .not('email', 'is', null)
      .limit(1)
      .maybeSingle();
    if (data?.email) return data.email as string;
  } catch (_) { /* table may not exist or column missing */ }
  return null;
}

async function sendEmail(to: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${supabaseUrl}/functions/v1/managed-send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      to,
      subject: 'Your KOB verification code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff">
          <h2 style="color:#1a1a1a;margin:0 0 16px">Verification code</h2>
          <p style="color:#555;font-size:15px;line-height:1.5;margin:0 0 16px">
            Use the code below to confirm your sign-in. It expires in 10 minutes.
          </p>
          <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
            <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1a1a1a">${code}</span>
          </div>
          <p style="color:#555;font-size:14px;margin:0 0 8px">
            You also received an SMS code — either code will work.
          </p>
          <p style="color:#999;font-size:12px;margin:24px 0 0">
            If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) return { ok: false, error: body?.error || `HTTP ${res.status}` };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { phone_number, otp_type } = await req.json();
    if (!validPhone(phone_number)) {
      return new Response(JSON.stringify({ skipped: true, reason: 'invalid_phone' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!otp_type) {
      return new Response(JSON.stringify({ error: 'otp_type required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const email = await lookupEmailByPhone(supabase, phone_number);
    if (!email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_registered_email' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: max 3 email OTPs per 15 min per address.
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('phone_otp_codes')
      .select('id')
      .eq('phone_number', email)
      .gte('created_at', since);
    if ((recent?.length || 0) >= 3) {
      return new Response(JSON.stringify({ skipped: true, reason: 'rate_limited' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const sendRes = await sendEmail(email, code);
    if (!sendRes.ok) {
      console.error('[email-otp] send failed:', sendRes.error);
      return new Response(JSON.stringify({ success: false, error: sendRes.error }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('phone_otp_codes').insert({
      phone_number: email,
      otp_code: otpHash,
      otp_type,
      delivery_method: 'email',
      expires_at: expiresAt,
      sms_sent: false,
      whatsapp_sent: false,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      user_agent: req.headers.get('user-agent') || '',
    });

    return new Response(JSON.stringify({ success: true, email_masked: email.replace(/(.{2}).+(@.+)/, '$1***$2') }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[email-otp] error', e);
    return new Response(JSON.stringify({ error: 'failed_to_send_email_otp' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
