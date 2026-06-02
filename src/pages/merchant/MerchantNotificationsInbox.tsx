import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Bell, Check, CheckCheck, X, Inbox, Truck, AlertCircle,
  CreditCard, Package, Shield, Activity, Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  icon: string | null;
  is_read: boolean;
  dismissed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type FilterTab = "all" | "unread" | "ddn" | "payments" | "disputes" | "dismissed";

const ICON_MAP: Record<string, typeof Bell> = {
  truck: Truck,
  shipping: Truck,
  order: Package,
  payment: CreditCard,
  transaction: CreditCard,
  kyc: Shield,
  alert: AlertCircle,
  default: Bell,
};

function getIcon(icon: string | null, type: string) {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
  if (type.startsWith("ddn.")) return Truck;
  if (type.includes("payment") || type.includes("charge") || type.includes("payout")) return CreditCard;
  if (type.includes("dispute")) return AlertCircle;
  if (type.includes("kyc") || type.includes("kyb")) return Shield;
  return Activity;
}

export default function MerchantNotificationsInbox() {
  const { user, loading: userLoading } = useAuthenticatedUser();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FilterTab>("all");

  const queryKey = ["merchant-notifications-inbox", user?.id];

  const { data: notifications = [], isLoading } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("app_notifications")
        .select("id,type,title,message,icon,is_read,dismissed_at,metadata,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as Notification[];
    },
  });

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`merchant-inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const dismissed = !!n.dismissed_at;
      if (tab === "dismissed") return dismissed;
      if (dismissed) return false;
      if (tab === "unread") return !n.is_read;
      if (tab === "ddn") return n.type.startsWith("ddn.");
      if (tab === "payments") return /charge|payment|payout|settlement|refund/.test(n.type);
      if (tab === "disputes") return n.type.includes("dispute");
      return true;
    });
  }, [notifications, tab]);

  const counts = useMemo(() => {
    const active = notifications.filter((n) => !n.dismissed_at);
    return {
      all: active.length,
      unread: active.filter((n) => !n.is_read).length,
      ddn: active.filter((n) => n.type.startsWith("ddn.")).length,
      payments: active.filter((n) => /charge|payment|payout|settlement|refund/.test(n.type)).length,
      disputes: active.filter((n) => n.type.includes("dispute")).length,
      dismissed: notifications.filter((n) => n.dismissed_at).length,
    };
  }, [notifications]);

  const markRead = useCallback(async (id: string, value: boolean) => {
    const { error } = await supabase
      .from("app_notifications")
      .update({ is_read: value } as any)
      .eq("id", id);
    if (error) toast.error("Failed to update");
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);

  const dismiss = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("app_notifications")
      .update({ dismissed_at: new Date().toISOString(), is_read: true } as any)
      .eq("id", id);
    if (error) toast.error("Failed to dismiss");
    else toast.success("Dismissed");
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);

  const restore = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("app_notifications")
      .update({ dismissed_at: null } as any)
      .eq("id", id);
    if (error) toast.error("Failed to restore");
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase
      .from("app_notifications")
      .update({ is_read: true } as any)
      .eq("user_id", user.id)
      .eq("is_read", false)
      .is("dismissed_at", null);
    if (error) toast.error("Failed to mark all read");
    else toast.success("All notifications marked as read");
    queryClient.invalidateQueries({ queryKey });
  }, [user, queryClient]);

  if (userLoading || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Inbox className="h-6 w-6" />
            Notifications Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Delivery events, payments, disputes and account updates.
          </p>
        </div>
        {counts.unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{counts.all}</Badge></TabsTrigger>
              <TabsTrigger value="unread">Unread <Badge variant="secondary" className="ml-2">{counts.unread}</Badge></TabsTrigger>
              <TabsTrigger value="ddn">Deliveries <Badge variant="secondary" className="ml-2">{counts.ddn}</Badge></TabsTrigger>
              <TabsTrigger value="payments">Payments <Badge variant="secondary" className="ml-2">{counts.payments}</Badge></TabsTrigger>
              <TabsTrigger value="disputes">Disputes <Badge variant="secondary" className="ml-2">{counts.disputes}</Badge></TabsTrigger>
              <TabsTrigger value="dismissed">Dismissed <Badge variant="secondary" className="ml-2">{counts.dismissed}</Badge></TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Inbox className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-sm">No notifications here</p>
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((n) => {
                  const Icon = getIcon(n.icon, n.type);
                  const isDismissed = !!n.dismissed_at;
                  return (
                    <li
                      key={n.id}
                      className={`flex gap-3 p-4 hover:bg-accent/40 transition-colors ${
                        !n.is_read && !isDismissed ? "bg-accent/20" : ""
                      }`}
                    >
                      <div className={`p-2 h-fit rounded-full ${
                        !n.is_read && !isDismissed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-sm ${!n.is_read && !isDismissed ? "font-semibold" : "font-medium"}`}>
                              {n.title}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0 font-mono">{n.type}</Badge>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                          <CardCardActions
                            notification={n}
                            isDismissed={isDismissed}
                            onMarkRead={markRead}
                            onDismiss={dismiss}
                            onRestore={restore}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function CardCardActions({
  notification: n,
  isDismissed,
  onMarkRead,
  onDismiss,
  onRestore,
}: {
  notification: Notification;
  isDismissed: boolean;
  onMarkRead: (id: string, v: boolean) => void;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  if (isDismissed) {
    return (
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onRestore(n.id)}>
        Restore
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {!n.is_read ? (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onMarkRead(n.id, true)}>
          <Check className="h-3.5 w-3.5 mr-1" />
          Mark read
        </Button>
      ) : (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onMarkRead(n.id, false)}>
          Mark unread
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onDismiss(n.id)} title="Dismiss">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
