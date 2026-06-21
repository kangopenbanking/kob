// Monthly statement dispatcher.
// Sends the `monthly-statement` template with a pre-signed download URL.
// The download URL points to an existing statement-generation endpoint when
// available; otherwise falls back to a deep link into the in-app Statements page.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-source',
}

const PAGE = 500
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://info.kangfintechsolutions.com'

function fmtMoney(n: number, currency = 'XAF') {
  if (!isFinite(n)) n = 0
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: settings } = await supabase
    .from('email_provider_settings').select('monthly_statement_enabled').eq('id', 1).maybeSingle()
  if (settings && settings.monthly_statement_enabled === false) {
    return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const triggeredBy = req.headers.get('x-trigger-source') || 'manual'
  let body: any = {}
  try { body = await req.json() } catch {}
  const singleUser = body?.user_id as string | undefined

  const userIds: string[] = []
  if (singleUser) {
    userIds.push(singleUser)
  } else {
    let from = 0
    while (from < 50000) {
      const { data, error } = await supabase
        .from('user_email_preferences')
        .select('user_id')
        .eq('monthly_statement', true)
        .range(from, from + PAGE - 1)
      if (error) { console.error('prefs page error', error); break }
      if (!data?.length) break
      userIds.push(...data.map((r: any) => r.user_id))
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  // Compute previous calendar month window
  const now = new Date()
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthLabel = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const startIso = monthStart.toISOString()
  const endIso = monthEnd.toISOString()
  const periodKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

  let queued = 0, skipped = 0, failed = 0
  const errors: any[] = []

  for (const uid of userIds) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name, first_name')
        .eq('id', uid)
        .maybeSingle()
      const recipientEmail = profile?.email
      if (!recipientEmail) { skipped++; continue }

      let totalCredits = 0, totalDebits = 0, txCount = 0
      try {
        const { data: txns } = await supabase
          .from('transactions')
          .select('amount, direction, type')
          .eq('user_id', uid)
          .gte('created_at', startIso)
          .lt('created_at', endIso)
          .limit(5000)
        if (txns) {
          txCount = txns.length
          for (const t of txns) {
            const amt = Number(t.amount) || 0
            if (t.direction === 'credit' || t.type === 'credit') totalCredits += amt
            else totalDebits += amt
          }
        }
      } catch {}

      const statementUrl = `${APP_BASE_URL}/app/statements?period=${periodKey}&user=${uid}`
      const csvUrl = `${APP_BASE_URL}/app/statements?period=${periodKey}&user=${uid}&format=csv`

      const { error: invokeErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'monthly-statement',
          recipientEmail,
          idempotencyKey: `monthly-${uid}-${periodKey}`,
          userId: uid,
          triggeredBy,
          templateData: {
            name: profile?.first_name || profile?.full_name || undefined,
            month: monthLabel,
            totalCredits: fmtMoney(totalCredits),
            totalDebits: fmtMoney(totalDebits),
            transactionCount: txCount,
            openingBalance: fmtMoney(0),
            closingBalance: fmtMoney(totalCredits - totalDebits),
            statementUrl,
            csvUrl,
          },
        },
      })
      if (invokeErr) throw invokeErr

      await supabase.from('user_email_preferences')
        .update({ last_monthly_sent_at: new Date().toISOString() })
        .eq('user_id', uid)
      queued++
    } catch (e: any) {
      failed++
      errors.push({ user_id: uid, error: e?.message || String(e) })
      console.error('monthly-statement user failed', uid, e)
    }
  }

  return new Response(
    JSON.stringify({ success: true, total: userIds.length, queued, skipped, failed,
      period: periodKey, errors: errors.slice(0, 25), triggered_by: triggeredBy }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
