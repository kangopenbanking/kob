// SLA-based escalation for live support chats.
// Runs on a cron every minute. For each open conversation:
//   - At ≥ warning% of SLA elapsed (and no first response): record sla_warning
//     audit log, notify supervisors via in-app notification + optional email.
//   - At ≥ escalation% (breach): bump priority one level, record sla_breach
//     audit log, optionally transfer to escalation_department_id, re-notify
//     agents, and email the supervisor with a deep link.
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

const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://kob.lovable.app';

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
        'id, status, priority, department_id, sla_target_minutes, sla_breach_at, first_response_at, sla_warned_at, sla_escalated_at, created_at, subject'
      )
      .in('status', ['open', 'assigned'])
      .is('first_response_at', null)
      .limit(500);

    if (error) throw error;

    // Pre-load department configs in one query
    const deptIds = Array.from(new Set((convs || []).map((c: any) => c.department_id).filter(Boolean)));
    const { data: depts } = deptIds.length
      ? await admin
          .from('support_departments')
          .select('id, name, sla_target_minutes, sla_warning_pct, sla_escalation_pct, escalation_department_id, supervisor_email, notify_supervisor')
          .in('id', deptIds)
      : { data: [] as any[] };
    const deptById = new Map<string, any>();
    (depts || []).forEach((d: any) => deptById.set(d.id, d));

    let warned = 0;
    let escalated = 0;

    const supervisorEmail = async (
      to: string,
      subject: string,
      lines: string[],
      conversationId: string,
      severity: 'warning' | 'breach',
    ) => {
      const deepLink = `${APP_BASE_URL}/admin/support-chat?conversation=${conversationId}`;
      try {
        await admin.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'support-sla-supervisor',
            recipientEmail: to,
            idempotencyKey: `sla-${conversationId}-${severity}`,
            templateData: {
              subject,
              summaryLines: lines.map((l) => l.replace(/<[^>]+>/g, '')),
              deepLink,
              conversationId,
              severity,
            },
          },
        });
      } catch (err) {
        console.warn('supervisor email failed:', err);
      }
    };

    for (const c of convs || []) {
      const dept = c.department_id ? deptById.get(c.department_id) : null;
      const target = (c as any).sla_target_minutes ?? dept?.sla_target_minutes ?? 15;
      const warningPct = dept?.sla_warning_pct ?? 50;
      const escalationPct = dept?.sla_escalation_pct ?? 100;
      const created = new Date((c as any).created_at).getTime();
      const breachAt = (c as any).sla_breach_at
        ? new Date((c as any).sla_breach_at).getTime()
        : created + target * 60_000;
      const elapsedRatio = ((now - created) / (breachAt - created)) * 100;

      // Warning threshold
      if (elapsedRatio >= warningPct && elapsedRatio < escalationPct && !(c as any).sla_warned_at) {
        await admin
          .from('support_conversations')
          .update({ sla_warned_at: new Date().toISOString() })
          .eq('id', c.id);

        await admin.from('support_audit_logs').insert({
          conversation_id: c.id,
          actor_id: null,
          actor_type: 'system',
          action: 'sla_warning',
          details: {
            elapsed_pct: Math.round(elapsedRatio),
            warning_pct: warningPct,
            target_minutes: target,
          },
        });

        const deepLink = `${APP_BASE_URL}/admin/support-chat?conversation=${c.id}`;

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
              title: `SLA at risk · ${dept?.name || 'Support'}`,
              message: `Chat hit ${Math.round(elapsedRatio)}% of its ${target}-min target. Open to respond.`,
              icon: 'alert-triangle',
              action_url: deepLink,
              metadata: { conversation_id: c.id, kind: 'sla_warning', deep_link: deepLink },
            }))
          );
        }

        // Supervisor email summary
        if (dept?.notify_supervisor && dept?.supervisor_email) {
          await supervisorEmail(
            dept.supervisor_email,
            `SLA at risk · ${dept.name}`,
            [
              `A live support chat in <strong>${dept.name}</strong> has reached ${Math.round(elapsedRatio)}% of its ${target}-minute response target.`,
              `Subject: ${(c as any).subject || '(no subject)'}.`,
              `No agent has responded yet.`,
            ],
            c.id,
          );
        }
        warned++;
      }

      // Escalation threshold
      if (elapsedRatio >= escalationPct && !(c as any).sla_escalated_at) {
        const previousPriority = (c as any).priority || 'medium';
        const nextPriority = PRIORITY_NEXT[previousPriority];
        const previousDeptId = (c as any).department_id;
        const transferTo = dept?.escalation_department_id;

        const updatePayload: any = {
          sla_escalated_at: new Date().toISOString(),
          priority: nextPriority,
          updated_at: new Date().toISOString(),
        };
        if (transferTo && transferTo !== previousDeptId) {
          updatePayload.department_id = transferTo;
          updatePayload.assigned_agent_id = null;
          updatePayload.claimed_by = null;
          updatePayload.claimed_at = null;
          updatePayload.status = 'open';
        }

        await admin.from('support_conversations').update(updatePayload).eq('id', c.id);

        await admin.from('support_audit_logs').insert({
          conversation_id: c.id,
          actor_id: null,
          actor_type: 'system',
          action: 'sla_breach',
          details: {
            previous_priority: previousPriority,
            new_priority: nextPriority,
            target_minutes: target,
            escalation_pct: escalationPct,
            transferred_to_department: transferTo || null,
            previous_department: previousDeptId,
          },
        });

        // Re-notify agents (now in the escalation dept if transferred)
        try {
          await admin.functions.invoke('notify-support-agents', {
            body: { conversation_id: c.id },
          });
        } catch (e) {
          console.warn('notify-support-agents (escalation) failed:', e);
        }

        const deepLink = `${APP_BASE_URL}/admin/support-chat?conversation=${c.id}`;

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
              title: `SLA breached · ${dept?.name || 'Support'}`,
              message: `Chat exceeded ${target}-min target. Priority raised to ${nextPriority}.${transferTo ? ' Re-routed to escalation team.' : ''}`,
              icon: 'alert-circle',
              action_url: deepLink,
              metadata: { conversation_id: c.id, kind: 'sla_breach', deep_link: deepLink },
            }))
          );
        }

        // Supervisor email summary
        if (dept?.notify_supervisor && dept?.supervisor_email) {
          await supervisorEmail(
            dept.supervisor_email,
            `SLA breach · ${dept?.name || 'Support'}`,
            [
              `A support chat exceeded its <strong>${target}-minute</strong> response target (now at ${Math.round(elapsedRatio)}%).`,
              `Priority was raised from <strong>${previousPriority}</strong> to <strong>${nextPriority}</strong>.`,
              transferTo
                ? `The conversation was re-routed to the escalation department.`
                : `No escalation department configured – conversation stays in ${dept?.name || 'this department'}.`,
              `Subject: ${(c as any).subject || '(no subject)'}.`,
            ],
            c.id,
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
