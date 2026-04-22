import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AgentStatus = 'online' | 'away' | 'offline';

const HEARTBEAT_MS = 30_000;
const ONLINE_WINDOW_MS = 90_000; // anything older counts as offline

export interface AgentPresenceRow {
  agent_id: string;
  user_id: string;
  status: AgentStatus;
  last_heartbeat_at: string;
  updated_at: string;
}

/**
 * Sends periodic heartbeats for the current support agent so other admins
 * can see their availability. Returns the resolved support_agent.id used.
 */
export function useAgentHeartbeat(userId?: string) {
  const [agentId, setAgentId] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const ping = useCallback(async (uid: string, aid: string) => {
    await (supabase.from('support_agent_presence' as any) as any).upsert(
      {
        agent_id: aid,
        user_id: uid,
        status: 'online',
        last_heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_id' }
    );
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from('support_agents' as any) as any)
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled || !data?.id) return;
      setAgentId(data.id);
      ping(userId, data.id);
      intervalRef.current = window.setInterval(() => ping(userId, data.id), HEARTBEAT_MS);
    })();
    return () => {
      cancelled = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      // Best-effort mark offline on unmount
      if (userId && agentId) {
        (supabase.from('support_agent_presence' as any) as any)
          .update({ status: 'offline', updated_at: new Date().toISOString() })
          .eq('agent_id', agentId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return agentId;
}

/**
 * Subscribes to all agent presence rows the current viewer can read.
 * Computes effective status by comparing last_heartbeat_at to ONLINE_WINDOW_MS.
 */
export function useAgentPresenceList() {
  const [rows, setRows] = useState<AgentPresenceRow[]>([]);
  const [, force] = useState(0);

  const refresh = useCallback(async () => {
    const { data } = await (supabase.from('support_agent_presence' as any) as any)
      .select('*');
    setRows((data as AgentPresenceRow[]) || []);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('agent-presence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_agent_presence' },
        () => refresh()
      )
      .subscribe();
    // Re-evaluate "online" derivation every 30s without refetching
    const t = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(t);
    };
  }, [refresh]);

  const map = new Map<string, AgentStatus>();
  const now = Date.now();
  rows.forEach((r) => {
    const stale = now - new Date(r.last_heartbeat_at).getTime() > ONLINE_WINDOW_MS;
    const effective: AgentStatus = stale ? 'offline' : r.status;
    map.set(r.user_id, effective);
    map.set(r.agent_id, effective);
  });

  return {
    statusByUserId: map,
    isOnline: (userOrAgentId?: string | null) =>
      !!userOrAgentId && map.get(userOrAgentId) === 'online',
    rows,
  };
}
