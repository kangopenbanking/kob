// Weekly account-activity digest dispatcher.
// Iterates users opted-in via public.user_email_preferences.weekly_activity_digest,
// computes a lightweight 7-day summary, and enqueues the `weekly-activity-digest`
// transactional template per user.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-source',
}

const PAGE = 500

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

  // Master toggle
  const { data: settings } = await supabase
    .from('email_provider_settings').select('weekly_digest_enabled').eq('id', 1).maybeSingle()
  if (settings && settings.weekly_digest_enabled === false) {
    return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const triggeredBy = req.headers.get('x-trigger-source') || 'manual'
  let body: any = {}
  try { body = await req.json() } catch {}
  const singleUser = body?.user_id as string | undefined

  // Collect opted-in user IDs
  const userIds: string[] = []
  if (singleUser) {
    userIds.push(singleUser)
  } else {
    let from = 0
    while (from < 50000) {
      const { data, error } = await supabase
        .from('user_email_preferences')
        .select('user_id')
        .eq('weekly_activity_digest', true)
        .range(from, from + PAGE - 1)
      if (error) { console.error('prefs page error', error); break }
      if (!data?.length) break
      userIds.push(...data.map((r: any) => r.user_id))
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weekEnd = new Date()
  const weekStartIso = weekStart.toISOString()
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10)

  let queued = 0, skipped = 0, failed = 0
  const errors: any[] = []

  for (const uid of userIds) {
    try {
      // Look up email + display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name, first_name')
        .eq('id', uid)
        .maybeSingle()
      const recipientEmail = profile?.email
      if (!recipientEmail) { skipped++; continue }

      // Lightweight activity rollup (resilient: failures default to zeros)
      let totalTransactions = 0, totalInflow = 0, totalOutflow = 0
      try {
        const { data: txns } = await supabase
          .from('transactions')
          .select('amount, direction, type')
          .eq('user_id', uid)
          .gte('created_at', weekStartIso)
          .limit(500)
        if (txns) {
          totalTransactions = txns.length
          for (const t of txns) {
            const amt = Number(t.amount) || 0
            if (t.direction === 'credit' || t.type === 'credit') totalInflow += amt
            else totalOutflow += amt
          }
        }
      } catch (e) { console.warn('txn rollup failed', uid, e) }

      let alertsCount = 0
      try {
        const { count } = await supabase
          .from('security_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .gte('created_at', weekStartIso)
        alertsCount = count || 0
      } catch {}

      const { error: invokeErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'weekly-activity-digest',
          recipientEmail,
          idempotencyKey: `weekly-${uid}-${fmtDate(weekEnd)}`,
          userId: uid,
          triggeredBy,
          templateData: {
            name: profile?.first_name || profile?.full_name || undefined,
            weekStart: fmtDate(weekStart),
            weekEnd: fmtDate(weekEnd),
            totalTransactions,
            totalInflow: fmtMoney(totalInflow),
            totalOutflow: fmtMoney(totalOutflow),
            topCategory: 'General',
            alertsCount,
            dashboardUrl: `${Deno.env.get('APP_BASE_URL') || 'https://info.kangfintechsolutions.com'}/dashboard`,
          },
        },
      })
      if (invokeErr) throw invokeErr

      await supabase.from('user_email_preferences')
        .update({ last_weekly_sent_at: new Date().toISOString() })
        .eq('user_id', uid)
      queued++
    } catch (e: any) {
      failed++
      errors.push({ user_id: uid, error: e?.message || String(e) })
      console.error('weekly-digest user failed', uid, e)
    }
  }

  return new Response(
    JSON.stringify({ success: true, total: userIds.length, queued, skipped, failed,
      errors: errors.slice(0, 25), triggered_by: triggeredBy }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
