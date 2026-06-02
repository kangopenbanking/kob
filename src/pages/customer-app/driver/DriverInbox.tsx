import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export default function DriverInbox() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("app_notifications")
        .select("id,title,message,is_read,created_at,type")
        .eq("user_id", user.id)
        .like("type", "ddn_%")
        .order("created_at", { ascending: false })
        .limit(50);
      setItems(data ?? []);
      setLoading(false);
      // mark as read
      const unread = (data ?? []).filter((n: any) => !n.is_read).map((n: any) => n.id);
      if (unread.length) await supabase.from("app_notifications").update({ is_read: true }).in("id", unread);
    })();
  }, []);

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft className="size-5" /></Button>
        <h1 className="text-xl font-semibold">Inbox</h1>
      </header>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell className="size-6 text-muted-foreground" />} title="No notifications" description="Driver alerts will appear here." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className={`p-3 ${!n.is_read ? "border-primary" : ""}`}>
              <p className="text-sm font-medium">{n.title}</p>
              {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
