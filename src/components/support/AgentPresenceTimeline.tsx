import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const REASON_LABEL: Record<string, string> = {
  initial_heartbeat: 'First seen online',
  agent_signed_on: 'Came online',
  agent_signed_off: 'Went offline',
  idle_or_marked_away: 'Marked away',
  returned_active: 'Returned active',
  status_changed: 'Status changed',
};

const STATUS_COLOR: Record<string, string> = {
  online: 'text-emerald-500 fill-emerald-500',
  away: 'text-amber-500 fill-amber-500',
  offline: 'text-muted-foreground fill-muted-foreground',
};

interface EventRow {
  id: string;
  agent_id: string;
  user_id: string;
  previous_status: string | null;
  status: string;
  reason: string | null;
  created_at: string;
}

interface Props {
  agents: Array<{ id: string; user_id?: string; full_name?: string; email?: string }>;
}

export const AgentPresenceTimeline: React.FC<Props> = ({ agents }) => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase.from('support_agent_presence_events' as any) as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!cancelled) {
        setEvents((data as EventRow[]) || []);
        setLoading(false);
      }
    })();
    const channel = supabase
      .channel('agent-presence-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_agent_presence_events' },
        (payload) => setEvents((prev) => [payload.new as EventRow, ...prev].slice(0, 200))
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const agentName = (agentId: string) => {
    const a = agents.find((x) => x.id === agentId);
    return a?.full_name || a?.email || `Agent ${agentId.slice(0, 6)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agent presence timeline</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[420px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No presence activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <Circle className={`mt-1 h-2.5 w-2.5 ${STATUS_COLOR[e.status] || ''}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {agentName(e.agent_id)}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {e.previous_status && (
                        <Badge variant="outline" className="capitalize">{e.previous_status}</Badge>
                      )}
                      <span>→</span>
                      <Badge variant="outline" className="capitalize">{e.status}</Badge>
                      <span className="ml-1">· {REASON_LABEL[e.reason || ''] || e.reason || 'Status changed'}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
