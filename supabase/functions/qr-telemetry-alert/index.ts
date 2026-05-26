// QR telemetry alert evaluator.
// Counts qr_telemetry_events rows with status in ('error','retry') in the given
// window. If count >= threshold, inserts a row into qr_telemetry_alerts and
// (when SLACK_WEBHOOK_URL is set) posts a Slack notification.
//
// Invoked by the client when local spike heuristics fire, and may also be
// scheduled via pg_cron for server-side polling. Idempotent: refuses to insert
// a duplicate alert for the same (alert_type, error_code) within the window.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  window_minutes?: number;
  threshold?: number;
  error_code?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SLACK = Deno.env.get('SLACK_WEBHOOK_URL');

  let body: Body = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  const windowMinutes = Math.min(Math.max(body.window_minutes ?? 5, 1), 60);
  const threshold = Math.max(body.threshold ?? 10, 1);
  const errorCode = body.error_code;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  let q = supabase
    .from('qr_telemetry_events')
    .select('error_code,status,event_type', { count: 'exact', head: false })
    .gte('created_at', since)
    .in('status', ['error', 'retry']);
  if (errorCode) q = q.eq('error_code', errorCode);

  const { data, count, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const total = count ?? 0;
  if (total < threshold) {
    return new Response(JSON.stringify({ ok: true, fired: false, count: total }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Dedupe: do not insert another alert for the same key within the window.
  const { data: existing } = await supabase
    .from('qr_telemetry_alerts')
    .select('id')
    .eq('alert_type', errorCode ? 'qr_error_spike_code' : 'qr_error_spike')
    .eq('window_minutes', windowMinutes)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ ok: true, fired: false, deduped: true, count: total }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const byCode: Record<string, number> = {};
  for (const r of data ?? []) {
    const k = (r as any).error_code ?? 'unknown';
    byCode[k] = (byCode[k] ?? 0) + 1;
  }

  const { data: alert } = await supabase
    .from('qr_telemetry_alerts')
    .insert({
      alert_type: errorCode ? 'qr_error_spike_code' : 'qr_error_spike',
      window_minutes: windowMinutes,
      count: total,
      threshold,
      error_code: errorCode ?? null,
      details: { by_error_code: byCode },
    })
    .select()
    .single();

  if (SLACK) {
    const text = `:rotating_light: *QR error spike* — ${total} events in last ${windowMinutes}m (threshold ${threshold})\n` +
      Object.entries(byCode).map(([k, v]) => `• \`${k}\`: ${v}`).join('\n');
    try {
      await fetch(SLACK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch { /* ignore */ }
  }

  return new Response(JSON.stringify({ ok: true, fired: true, count: total, alert }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
