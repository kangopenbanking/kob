import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, Check, AlertTriangle, Info, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOneSignal } from "@/hooks/useOneSignal";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  read: boolean;
  created_at: string;
  source: "system" | "app";
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const getHistoryPath = () => {
    const path = location.pathname;
    if (path.startsWith("/merchant")) return "/merchant/notification-history";
    if (path.startsWith("/business")) return "/business/notification-history";
    if (path.startsWith("/admin")) return "/admin/notification-history";
    if (path.startsWith("/institution")) return "/admin/notification-history";
    return "/notification-history";
  };

  // Register OneSignal for the current user (no institution scope on desktop dashboards)
  useOneSignal();

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load from both system_alerts and app_notifications
      const [systemResult, appResult] = await Promise.all([
        supabase
          .from("system_alerts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("app_notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(15),
      ]);

      const mapped: Notification[] = [];

      if (systemResult.data) {
        for (const alert of systemResult.data) {
          mapped.push({
            id: alert.id,
            title: alert.alert_type.replace(/_/g, " ").toUpperCase(),
            message: alert.message || "",
            type: alert.severity === "critical" || alert.severity === "high"
              ? "error"
              : alert.severity === "medium"
              ? "warning"
              : "info",
            read: alert.acknowledged_at !== null,
            created_at: alert.created_at,
            source: "system",
          });
        }
      }

      if (appResult.data) {
        for (const n of appResult.data) {
          mapped.push({
            id: n.id,
            title: n.title,
            message: n.message,
            type: (n.type as Notification["type"]) || "info",
            read: n.is_read,
            created_at: n.created_at,
            source: "app",
          });
        }
      }

      // Sort by created_at desc
      mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(mapped.slice(0, 25));
      setUnreadCount(mapped.filter((n) => !n.read).length);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    // Subscribe to both tables
    const systemChannel = supabase
      .channel("system_alerts_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_alerts" }, (payload) => {
        loadNotifications();
        if (payload.eventType === "INSERT") {
          const newAlert = payload.new as any;
          toast.info(newAlert.message, { description: newAlert.alert_type });
        }
      })
      .subscribe();

    const appChannel = supabase
      .channel("app_notifications_center")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "app_notifications" }, (payload) => {
        loadNotifications();
        const n = payload.new as any;
        toast(n.title, { description: n.message });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(systemChannel);
      supabase.removeChannel(appChannel);
    };
  }, [loadNotifications]);

  const markAsRead = async (notification: Notification) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (notification.source === "system") {
        await supabase
          .from("system_alerts")
          .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id })
          .eq("id", notification.id);
      } else {
        await supabase
          .from("app_notifications")
          .update({ is_read: true } as any)
          .eq("id", notification.id);
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const unread = notifications.filter((n) => !n.read);
      if (unread.length === 0) return;

      const systemIds = unread.filter((n) => n.source === "system").map((n) => n.id);
      const appIds = unread.filter((n) => n.source === "app").map((n) => n.id);

      if (systemIds.length > 0) {
        await supabase
          .from("system_alerts")
          .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id })
          .in("id", systemIds);
      }
      if (appIds.length > 0) {
        await supabase
          .from("app_notifications")
          .update({ is_read: true } as any)
          .in("id", appIds);
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "error":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-destructive/70" />;
      case "success":
        return <Check className="h-4 w-4 text-primary" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs gap-1">
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-accent/50 transition-colors ${
                    !notification.read ? "bg-accent/20" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="mt-1">{getIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{notification.title}</p>
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => markAsRead(notification)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatTimestamp(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate(getHistoryPath())}>
                View all notifications
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
