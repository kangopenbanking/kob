import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';

const ACTION_LABEL: Record<string, string> = {
  claim: 'Claimed chat',
  release: 'Released chat',
  transfer: 'Transferred department',
  escalate: 'Escalated priority',
  note: 'Added internal note',
  assignment_change: 'Assignment changed',
  status_change: 'Status changed',
  priority_change: 'Priority changed',
  sla_warning: 'SLA warning issued',
  sla_breach: 'SLA breached',
};

interface AuditRow {
  id: string;
  action: string;
  actor_id: string | null;
  actor_type: string;
  details: Record<string, any> | null;
  created_at: string;
}

/**
 * Inline audit-trail list for a single conversation. Reads support_audit_logs
 * and refreshes via realtime so admins see actions as they happen.
 */
export const SupportAuditLog: React.FC<{ conversationId?: string; className?: string }> = ({
  conversationId,
  className,
}) => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await (supabase.from('support_audit_logs' as any) as any)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!cancelled) {
        setRows((data as AuditRow[]) || []);
        setLoading(false);
      }
    })();
    const channel = supabase
      .channel(`audit-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_audit_logs',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => setRows((prev) => [payload.new as AuditRow, ...prev])
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  if (!conversationId) return null;

  return (
    <div className={className}>
      <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        Activity
      </div>
      <ScrollArea className="h-48">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">No actions logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {ACTION_LABEL[r.action] || r.action}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
                {r.details && Object.keys(r.details).length > 0 && (
                  <p className="mt-0.5 text-muted-foreground line-clamp-2">
                    {Object.entries(r.details)
                      .filter(([, v]) => v !== null && v !== undefined && v !== '')
                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                      .join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
};
