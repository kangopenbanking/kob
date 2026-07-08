// Kang Agent — Notification bell dropdown
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Wallet, AlertTriangle, Check, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type Notif = {
  id: string;
  type: "due_soon" | "payment_failed" | "payment_success" | "system";
  title: string;
  message: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
};

export function KangNotificationBell({
  unreadCount,
  onChanged,
}: {
  unreadCount: number;
  onChanged?: () => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("kang_notifications")
      .select("id, type, title, message, is_read, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as Notif[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function markRead(id: string) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, is_read: true } : x)));
    const { error } = await (supabase as any).from("kang_notifications").update({ is_read: true }).eq("id", id);
    if (error) toast.error("Could not mark as read");
    onChanged?.();
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setItems((xs) => xs.map((x) => ({ ...x, is_read: true })));
    await (supabase as any).from("kang_notifications").update({ is_read: true })
      .eq("user_id", user.id).eq("is_read", false);
    onChanged?.();
  }

  const iconFor = (t: Notif["type"]) => {
    if (t === "payment_failed") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    if (t === "due_soon") return <Wallet className="h-3.5 w-3.5 text-amber-500" />;
    if (t === "payment_success") return <Check className="h-3.5 w-3.5 text-emerald-500" />;
    return <Info className="h-3.5 w-3.5 text-primary" />;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative" aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}>
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
          <p className="text-[13px] font-semibold">Notifications</p>
          {items.some((i) => !i.is_read) && (
            <button onClick={markAllRead} className="text-[11px] text-primary hover:underline">Mark all read</button>
          )}
        </div>
        <ScrollArea className="max-h-[380px]">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-50" />
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`p-3 cursor-pointer hover:bg-muted/60 transition ${!n.is_read ? "bg-primary/[0.03]" : ""}`}
                  onClick={() => !n.is_read && markRead(n.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{iconFor(n.type)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-medium leading-tight truncate">{n.title}</p>
                        {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                      {n.type === "payment_failed" && (
                        <Button
                          size="sm"
                          className="mt-2 h-7 text-[11px]"
                          onClick={(e) => { e.stopPropagation(); setOpen(false); navigate("/app/wallet"); }}
                        >
                          <Wallet className="h-3 w-3 mr-1" /> Top Up Wallet
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
