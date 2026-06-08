/**
 * NameCorrectionUpdates — customer-facing notification center for the
 * Nium name-correction lifecycle (submitted / under review / approved /
 * rejected). Lists the user's in-app notifications filtered by
 * metadata.kind = 'nium_name_correction' with read/unread tracking.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Row = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const STAGE_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "destructive" }> = {
  submitted: { label: "Submitted", tone: "secondary" },
  maker: { label: "Under review", tone: "secondary" },
  approved: { label: "Approved", tone: "default" },
  rejected: { label: "Rejected", tone: "destructive" },
};

export function NameCorrectionUpdates({ userId }: { userId: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from("app_notifications")
      .select("id,title,message,is_read,created_at,metadata")
      .eq("user_id", userId)
      .eq("type", "kyc")
      .contains("metadata", { kind: "nium_name_correction" } as any)
      .order("created_at", { ascending: false })
      .limit(20);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh on new INSERTs for this user.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`name-correction-updates-${userId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "app_notifications",
        filter: `user_id=eq.${userId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const markRead = async (id: string) => {
    await supabase.from("app_notifications").update({ is_read: true } as any).eq("id", id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, is_read: true } : r));
  };
  const markAllRead = async () => {
    if (!userId) return;
    const ids = rows.filter(r => !r.is_read).map(r => r.id);
    if (!ids.length) return;
    await supabase.from("app_notifications").update({ is_read: true } as any).in("id", ids);
    setRows(prev => prev.map(r => ({ ...r, is_read: true })));
  };

  const unread = rows.filter(r => !r.is_read).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Name correction updates</CardTitle>
          {unread > 0 && (
            <Badge variant="secondary" className="ml-1">{unread} new</Badge>
          )}
        </div>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-1">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no name correction updates yet. Submitted, under-review, approved and rejected events will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map(r => {
              const stage = String((r.metadata as any)?.stage ?? "");
              const requestId = String((r.metadata as any)?.request_id ?? "");
              const tag = STAGE_LABEL[stage] ?? { label: stage || "Update", tone: "secondary" as const };
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => !r.is_read && markRead(r.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      r.is_read ? "bg-card" : "bg-primary/5 border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.title}</span>
                        {!r.is_read && <Circle className="h-2 w-2 fill-primary text-primary" />}
                      </div>
                      <Badge variant={tag.tone as any}>{tag.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.message}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground/70">
                      <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                      {requestId && (
                        <span className="font-mono">ref {requestId.slice(0, 8).toUpperCase()}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default NameCorrectionUpdates;
