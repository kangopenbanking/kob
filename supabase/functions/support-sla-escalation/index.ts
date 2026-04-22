// SLA-based escalation for live support chats.
// Runs on a cron every minute. For each open conversation:
//   - At ≥50% of SLA elapsed (and no first response): record sla_warning
//     audit log, notify supervisors via in-app notification, mark sla_warned_at.
//   - At ≥100% (breach): bump priority one level, record sla_breach audit
//     log, transfer to escalation department if configured, re-notify agents,
//     mark sla_escalated_at.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRIORITY_NEXT: Record<string, string> = {
  low: 'medium',
  medium: 'high',
  high: 'urgent',
  urgent: 'urgent',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const now = Date.now();

    // Pull active chats that haven't had a first response yet
    const { data: convs, error } = await admin
      .from('support_conversations')
      .select(
        'id, status, priority, department_id, sla_target_minutes, sla_breach_at, first_response_at, sla_warned_at, sla_escalated_at, created_at'
      )
      .in('status', ['open', 'assigned'])
      .is('first_response_at', null)
      .limit(500);

    if (error) throw error;

    let warned = 0;
    let escalated = 0;

    for (const c of convs || []) {
      const target = (c as any).sla_target_minutes ?? 15;
      const created = new Date((c as any).created_at).getTime();
      const breachAt = (c as any).sla_breach_at
        ? new Date((c as any).sla_breach_at).getTime()
        : created + target * 60_000;
      const elapsedRatio = (now - created) / (breachAt - created);

      // 50% warning
      if (elapsedRatio >= 0.5 && elapsedRatio < 1 && !(c as any).sla_warned_at) {
        await admin
          .from('support_conversations')
          .update({ sla_warned_at: new Date().toISOString() })
          .eq('id', c.id);

        await admin.from('support_audit_logs').insert({
          conversation_id: c.id,
          actor_id: null,
          actor_type: 'system',
          action: 'sla_warning',
          details: { elapsed_pct: Math.round(elapsedRatio * 100), target_minutes: target },
        });

        // Notify admins (supervisors) in-app
        const { data: admins } = await admin
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');
        if (admins?.length) {
          await admin.from('app_notifications').insert(
            admins.map((a: any) => ({
              user_id: a.user_id,
              type: 'warning',
              title: 'Support SLA at risk',
              message: `Chat is at ${Math.round(elapsedRatio * 100)}% of its ${target}-minute response target.`,
              icon: 'alert-triangle',
              metadata: { conversation_id: c.id, kind: 'sla_warning' },
            }))
          );
        }
        warned++;
      }

      // 100% breach
      if (elapsedRatio >= 1 && !(c as any).sla_escalated_at) {
        const nextPriority = PRIORITY_NEXT[(c as any).priority || 'medium'];

        await admin
          .from('support_conversations')
          .update({
            sla_escalated_at: new Date().toISOString(),
            priority: nextPriority,
            updated_at: new Date().toISOString(),
          })
          .eq('id', c.id);

        await admin.from('support_audit_logs').insert({
          conversation_id: c.id,
          actor_id: null,
          actor_type: 'system',
          action: 'sla_breach',
          details: {
            previous_priority: (c as any).priority,
            new_priority: nextPriority,
            target_minutes: target,
          },
        });

        // Re-notify all agents in the same department + email blast
        try {
          await admin.functions.invoke('notify-support-agents', {
            body: { conversation_id: c.id },
          });
        } catch (e) {
          console.warn('notify-support-agents (escalation) failed:', e);
        }

        // In-app notification to admins
        const { data: admins } = await admin
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');
        if (admins?.length) {
          await admin.from('app_notifications').insert(
            admins.map((a: any) => ({
              user_id: a.user_id,
              type: 'warning',
              title: 'Support SLA breached',
              message: `Chat exceeded ${target}-minute target. Priority raised to ${nextPriority}.`,
              icon: 'alert-circle',
              metadata: { conversation_id: c.id, kind: 'sla_breach' },
            }))
          );
        }
        escalated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, scanned: convs?.length || 0, warned, escalated }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('support-sla-escalation error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
