import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Smartphone, Monitor, Globe, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface SessionRow {
  id: string;
  app_context: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_seen_at: string;
  created_at: string;
  revoked_at: string | null;
}

const deviceIcon = (ua: string | null) => {
  const s = (ua || "").toLowerCase();
  if (s.includes("mobile") || s.includes("android") || s.includes("iphone")) return Smartphone;
  if (s.includes("mac") || s.includes("windows") || s.includes("linux")) return Monitor;
  return Globe;
};

const deviceLabel = (ua: string | null) => {
  const s = ua || "Unknown device";
  if (/iphone/i.test(s)) return "iPhone";
  if (/android/i.test(s)) return "Android";
  if (/mac/i.test(s)) return "Mac";
  if (/windows/i.test(s)) return "Windows";
  return s.slice(0, 40);
};

export default function CustomerSessions() {
  const nav = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false });
    if (error) { toast.error("Failed to load sessions"); setLoading(false); return; }
    setSessions((data || []) as SessionRow[]);
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentId((session as any)?.access_token ? null : null); // best-effort marker
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const revoke = async (id: string) => {
    const { error } = await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Failed to revoke session"); return; }
    toast.success("Session revoked");
    void load();
  };

  const revokeAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("revoked_at", null);
    if (error) { toast.error("Failed to revoke sessions"); return; }
    toast.success("All other sessions revoked");
    void load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => nav(-1)} className="rounded-full p-2 hover:bg-muted" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Active Sessions</h1>
          <p className="text-xs text-muted-foreground">Devices currently signed in to your account</p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <Card className="border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Keep your account safe</p>
              <p className="mt-1 text-xs text-muted-foreground">
                If you don't recognize a session, revoke it immediately and change your password.
              </p>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<Monitor className="h-6 w-6 text-muted-foreground" />}
            title="No active sessions"
            description="When you sign in on a device, it will appear here."
          />
        ) : (
          <>
            <div className="space-y-3">
              {sessions.map(s => {
                const Icon = deviceIcon(s.user_agent);
                const isCurrent = s.id === currentId;
                return (
                  <Card key={s.id} className="border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{deviceLabel(s.user_agent)}</p>
                          {isCurrent && <Badge variant="default" className="text-[10px]">This device</Badge>}
                          {s.app_context && <Badge variant="outline" className="text-[10px]">{s.app_context}</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {s.ip_address || "Unknown IP"} · Active {formatDistanceToNow(new Date(s.last_seen_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!isCurrent && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => revoke(s.id)}>
                          <LogOut className="h-3.5 w-3.5" /> Revoke
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
            <Button variant="outline" className="w-full" onClick={revokeAll}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out all other sessions
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
