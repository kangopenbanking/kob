import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Verify Resend webhook signature using HMAC-SHA256
// Resend uses Svix for webhooks: headers svix-id, svix-timestamp, svix-signature
async function verifyResendSignature(
  body: string,
  secret: string,
  headers: Headers
): Promise<boolean> {
  const svixId = headers.get('svix-id')
  const svixTimestamp = headers.get('svix-timestamp')
  const svixSignature = headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false
  }

  // Check timestamp freshness (5 minute tolerance)
  const ts = parseInt(svixTimestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > 300) {
    return false
  }

  // Resend webhook secret starts with "whsec_" — strip prefix and base64-decode
  const secretBytes = Uint8Array.from(atob(secret.replace('whsec_', '')), c => c.charCodeAt(0))

  const toSign = `${svixId}.${svixTimestamp}.${body}`
  const encoder = new TextEncoder()

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign))
  const computedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

  // svix-signature can contain multiple signatures separated by space (v1,xxx)
  const signatures = svixSignature.split(' ')
  for (const sig of signatures) {
    const [version, sigValue] = sig.split(',')
    if (version === 'v1' && sigValue === computedSig) {
      return true
    }
  }

  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // Read raw body for signature verification
  const body = await req.text()

  // Verify Resend/Svix webhook signature
  const isValid = await verifyResendSignature(body, webhookSecret, req.headers)
  if (!isValid) {
    console.error('Invalid Resend webhook signature')
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  // Parse the webhook event
  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const eventType = event.type
  const eventData = event.data

  if (!eventType || !eventData) {
    return jsonResponse({ error: 'Missing type or data' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Handle different Resend webhook event types
  if (eventType === 'email.bounced') {
    const email = eventData.to?.[0] || eventData.email_address
    if (!email) {
      console.warn('Bounce event missing email address', { eventData })
      return jsonResponse({ success: true, skipped: 'no_email' })
    }

    const normalizedEmail = email.toLowerCase()

    // Suppress the email address
    await supabase.from('suppressed_emails').upsert(
      { email: normalizedEmail, reason: 'bounce', metadata: { resend_event_id: event.id, bounce_type: eventData.bounce?.type } },
      { onConflict: 'email' }
    )

    // Log the bounce
    await supabase.from('email_send_log').insert({
      message_id: eventData.email_id || null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: 'bounced',
      error_message: `Bounce: ${eventData.bounce?.type || 'unknown'}`,
      metadata: { resend_event_id: event.id },
    })

    console.log('Bounce processed', { email: normalizedEmail[0] + '***' })
    return jsonResponse({ success: true })
  }

  if (eventType === 'email.complained') {
    const email = eventData.to?.[0] || eventData.email_address
    if (!email) {
      return jsonResponse({ success: true, skipped: 'no_email' })
    }

    const normalizedEmail = email.toLowerCase()

    await supabase.from('suppressed_emails').upsert(
      { email: normalizedEmail, reason: 'complaint', metadata: { resend_event_id: event.id } },
      { onConflict: 'email' }
    )

    await supabase.from('email_send_log').insert({
      message_id: eventData.email_id || null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: 'complained',
      error_message: 'Spam complaint received',
      metadata: { resend_event_id: event.id },
    })

    console.log('Complaint processed', { email: normalizedEmail[0] + '***' })
    return jsonResponse({ success: true })
  }

  if (eventType === 'email.delivered') {
    // Optional: log delivery confirmation
    const email = eventData.to?.[0] || eventData.email_address
    if (email) {
      await supabase.from('email_send_log').insert({
        message_id: eventData.email_id || null,
        template_name: 'system',
        recipient_email: email.toLowerCase(),
        status: 'delivered',
        metadata: { resend_event_id: event.id },
      })
    }
    return jsonResponse({ success: true })
  }

  // Acknowledge unknown event types gracefully
  console.log('Unhandled Resend event type', { eventType })
  return jsonResponse({ success: true, unhandled: eventType })
})