import { supabase } from '@/integrations/supabase/client';

export type SupportAuditAction =
  | 'claim'
  | 'release'
  | 'transfer'
  | 'escalate'
  | 'note'
  | 'assignment_change'
  | 'status_change'
  | 'priority_change'
  | 'sla_warning'
  | 'sla_breach';

/**
 * Insert a structured audit-trail entry for a support conversation.
 * Failures are logged but never thrown — audit must never block UX.
 */
export async function logSupportAudit(params: {
  conversationId: string;
  action: SupportAuditAction;
  actorId?: string | null;
  actorType?: 'agent' | 'admin' | 'system' | 'user';
  details?: Record<string, unknown>;
}) {
  try {
    const { conversationId, action, actorId, actorType = 'agent', details = {} } = params;
    await (supabase.from('support_audit_logs' as any) as any).insert({
      conversation_id: conversationId,
      action,
      actor_id: actorId ?? null,
      actor_type: actorType,
      details,
    });
  } catch (err) {
    console.warn('logSupportAudit failed', err);
  }
}
