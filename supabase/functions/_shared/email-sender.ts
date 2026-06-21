// Shared email sender: Resend first (when enabled), Lovable Email fallback.
// Loads provider config from public.email_provider_settings (singleton, id=1).

import { sendLovableEmail } from 'npm:@lovable.dev/email-js'

export type ProviderSettings = {
  primary_provider: 'resend' | 'lovable_email'
  fallback_provider: 'resend' | 'lovable_email' | 'none'
  environment: 'sandbox' | 'production'
  sandbox_from_email: string
  sandbox_from_name: string
  production_from_email: string
  production_from_name: string
  reply_to_email: string | null
  resend_api_key_label: string
  resend_enabled: boolean
  fallback_enabled: boolean
}

const DEFAULTS: ProviderSettings = {
  primary_provider: 'resend',
  fallback_provider: 'lovable_email',
  environment: 'sandbox',
  sandbox_from_email: 'onboarding@resend.dev',
  sandbox_from_name: 'Kang Open Banking (Sandbox)',
  production_from_email: 'noreply@info.kangfintechsolutions.com',
  production_from_name: 'Kang Open Banking',
  reply_to_email: null,
  resend_api_key_label: 'RESEND_API_KEY',
  resend_enabled: true,
  fallback_enabled: true,
}

export async function loadProviderSettings(supabase: any): Promise<ProviderSettings> {
  try {
    const { data } = await supabase
      .from('email_provider_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (data) return { ...DEFAULTS, ...data }
  } catch (e) {
    console.warn('loadProviderSettings failed, using defaults', e)
  }
  return DEFAULTS
}

export function resolveFromAddress(s: ProviderSettings, fallbackFrom?: string): string {
  const name = s.environment === 'production' ? s.production_from_name : s.sandbox_from_name
  const email = s.environment === 'production' ? s.production_from_email : s.sandbox_from_email
  if (!email) return fallbackFrom || 'onboarding@resend.dev'
  return `${name} <${email}>`
}

export type EmailPayload = {
  to: string
  from?: string
  subject: string
  html: string
  text?: string
  reply_to?: string
  // Lovable extras (used only by fallback)
  sender_domain?: string
  purpose?: string
  label?: string
  idempotency_key?: string
  unsubscribe_token?: string
  message_id?: string
  run_id?: string
}

export type SendResult = {
  provider: 'resend' | 'lovable_email'
  ok: boolean
  status?: number
  error?: string
  rateLimited?: boolean
  retryAfterSeconds?: number | null
  forbidden?: boolean
}

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'

async function sendViaResend(payload: EmailPayload, settings: ProviderSettings): Promise<SendResult> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const resendKey = Deno.env.get(settings.resend_api_key_label) || Deno.env.get('RESEND_API_KEY')
  if (!lovableKey) return { provider: 'resend', ok: false, error: 'LOVABLE_API_KEY missing' }
  if (!resendKey) return { provider: 'resend', ok: false, error: `${settings.resend_api_key_label} missing` }

  const from = payload.from || resolveFromAddress(settings)
  const body: Record<string, unknown> = {
    from,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
  }
  if (payload.text) body.text = payload.text
  const replyTo = payload.reply_to || settings.reply_to_email
  if (replyTo) body.reply_to = replyTo

  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': resendKey,
      },
      body: JSON.stringify(body),
    })
    const txt = await res.text()
    if (res.ok) return { provider: 'resend', ok: true, status: res.status }
    const retryAfter = res.headers.get('retry-after')
    return {
      provider: 'resend',
      ok: false,
      status: res.status,
      error: txt.slice(0, 800),
      rateLimited: res.status === 429,
      retryAfterSeconds: retryAfter ? Number(retryAfter) || 60 : null,
      forbidden: res.status === 403,
    }
  } catch (e) {
    return { provider: 'resend', ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function sendViaLovable(payload: EmailPayload): Promise<SendResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) return { provider: 'lovable_email', ok: false, error: 'LOVABLE_API_KEY missing' }
  // Lovable Email requires the From address domain to align with sender_domain.
  // If the configured From (e.g. Resend sandbox onboarding@resend.dev) doesn't,
  // rewrite it to noreply@<sender_domain> using the same display name so the
  // fallback succeeds.
  let fromForLovable = payload.from || ''
  if (payload.sender_domain && fromForLovable) {
    const match = fromForLovable.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
    const addr = match ? match[2] : fromForLovable
    const name = match ? match[1] : ''
    const addrDomain = addr.split('@')[1] || ''
    if (!addrDomain.endsWith(payload.sender_domain)) {
      const local = (addr.split('@')[0] || 'noreply').replace(/[^A-Za-z0-9._-]/g, '') || 'noreply'
      fromForLovable = name ? `${name} <${local}@${payload.sender_domain}>` : `${local}@${payload.sender_domain}`
    }
  }
  try {
    await sendLovableEmail(
      {
        run_id: payload.run_id,
        to: payload.to,
        from: fromForLovable,
        sender_domain: payload.sender_domain!,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        purpose: (payload.purpose as any) || 'transactional',
        label: payload.label,
        idempotency_key: payload.idempotency_key,
        unsubscribe_token: payload.unsubscribe_token,
        message_id: payload.message_id,
      },
      { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') }
    )
    return { provider: 'lovable_email', ok: true }
  } catch (e: any) {
    const status = (e && typeof e === 'object' && 'status' in e) ? (e as any).status : undefined
    const msg = e instanceof Error ? e.message : String(e)
    return {
      provider: 'lovable_email',
      ok: false,
      status,
      error: msg,
      rateLimited: status === 429 || msg.includes('429'),
      retryAfterSeconds: (e as any)?.retryAfterSeconds ?? null,
      forbidden: status === 403 || msg.includes('403'),
    }
  }
}

/**
 * Send an email using the configured primary provider, falling back to the
 * secondary provider on transient failures. Rate-limit and 403 are NOT retried
 * on the same provider — they bubble up so the queue can react.
 */
export async function sendEmailWithFallback(
  payload: EmailPayload,
  settings: ProviderSettings,
  opts: { forceFallbackOn403?: boolean } = {},
): Promise<{ primary: SendResult; fallback?: SendResult; finalProvider: 'resend' | 'lovable_email' | null; ok: boolean }> {
  const primary = settings.primary_provider
  const useResendFirst = primary === 'resend' && settings.resend_enabled

  const first = useResendFirst ? await sendViaResend(payload, settings) : await sendViaLovable(payload)
  if (first.ok) return { primary: first, finalProvider: first.provider, ok: true }

  // Don't fallback on rate-limit — that needs queue-level backoff handling.
  // 403 normally also skips fallback (quota/account issue), but admin test
  // sends opt-in to fallback so unverified-recipient sandbox 403s still route
  // through the secondary provider and return a useful result to the UI.
  const skipFallback =
    first.rateLimited ||
    (!opts.forceFallbackOn403 && first.forbidden) ||
    !settings.fallback_enabled ||
    settings.fallback_provider === 'none'

  if (skipFallback) {
    return { primary: first, finalProvider: null, ok: false }
  }

  const fallback = useResendFirst ? await sendViaLovable(payload) : await sendViaResend(payload, settings)
  return {
    primary: first,
    fallback,
    finalProvider: fallback.ok ? fallback.provider : null,
    ok: fallback.ok,
  }
}
