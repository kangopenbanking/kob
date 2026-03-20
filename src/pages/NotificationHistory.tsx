import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bell, Check, AlertTriangle, Info, CheckCheck, Search,
  Trash2, Filter, RefreshCw, Clock, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  icon: string | null;
  read: boolean;
  created_at: string;
  source: "system" | "app";
  metadata?: Record<string, unknown>;
}

const PAGE_SIZE = 20;

const NotificationHistory = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load system_alerts
      const { data: systemData } = await supabase
        .from("system_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      // Load app_notifications
      const { data: appData } = await supabase
        .from("app_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      const mapped: Notification[] = [];

      if (systemData) {
        for (const alert of systemData) {
          mapped.push({
            id: alert.id,
            title: alert.alert_type?.replace(/_/g, " ").toUpperCase() || "SYSTEM ALERT",
            message: alert.message || "",
            type: alert.severity === "critical" || alert.severity === "high" ? "error" : alert.severity === "medium" ? "warning" : "info",
            icon: null,
            read: alert.acknowledged_at !== null,
            created_at: alert.created_at,
            source: "system",
          });
        }
      }

      if (appData) {
        for (const n of appData) {
          mapped.push({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type || "info",
            icon: n.icon,
            read: n.is_read,
            created_at: n.created_at,
            source: "app",
            metadata: n.metadata as Record<string, unknown> | undefined,
          });
        }
      }

      mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(mapped);
      setTotalCount(mapped.length);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const filtered = notifications.filter((n) => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.message.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    if (readFilter === "unread" && n.read) return false;
    if (readFilter === "read" && !n.read) return false;
    return true;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const markAsRead = async (notification: Notification) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (notification.source === "system") {
      await supabase.from("system_alerts").update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id }).eq("id", notification.id);
    } else {
      await supabase.from("app_notifications").update({ is_read: true } as any).eq("id", notification.id);
    }
    setNotifications((prev) => prev.map((n) => n.id === notification.id ? { ...n, read: true } : n));
    toast.success("Marked as read");
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const unread = notifications.filter((n) => !n.read);
    const systemIds = unread.filter((n) => n.source === "system").map((n) => n.id);
    const appIds = unread.filter((n) => n.source === "app").map((n) => n.id);
    if (systemIds.length > 0) {
      await supabase.from("system_alerts").update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id }).in("id", systemIds);
    }
    if (appIds.length > 0) {
      await supabase.from("app_notifications").update({ is_read: true } as any).in("id", appIds);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const deleteNotification = async (notification: Notification) => {
    if (notification.source === "app") {
      await supabase.from("app_notifications").delete().eq("id", notification.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      toast.success("Notification deleted");
    }
  };

  const clearAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const readAppIds = notifications.filter((n) => n.read && n.source === "app").map((n) => n.id);
    if (readAppIds.length > 0) {
      await supabase.from("app_notifications").delete().in("id", readAppIds);
    }
    setNotifications((prev) => prev.filter((n) => !(n.read && n.source === "app")));
    toast.success("Read notifications cleared");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "error": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-[hsl(var(--fi-amber))]" />;
      case "success": return <Check className="h-4 w-4 text-primary" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      error: "bg-destructive/10 text-destructive border-destructive/20",
      warning: "bg-[hsl(var(--fi-amber))]/10 text-[hsl(var(--fi-amber))] border-[hsl(var(--fi-amber))]/20",
      success: "bg-primary/10 text-primary border-primary/20",
      info: "bg-muted text-muted-foreground border-border",
    };
    return (
      <Badge variant="outline" className={`text-[10px] ${variants[type] || variants.info}`}>
        {type}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notification History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} total · {unreadCount} unread
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadNotifications} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1.5" />
              Mark all read
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Clear read
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear read notifications?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all read app notifications. System alerts will be preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearAllRead}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={readFilter} onValueChange={(v) => { setReadFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notification List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm mt-1">
                {search || typeFilter !== "all" || readFilter !== "all"
                  ? "Try adjusting your filters"
                  : "You're all caught up!"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {paginated.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 hover:bg-accent/50 transition-colors ${!n.read ? "bg-accent/20 border-l-2 border-l-primary" : ""}`}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">{getIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm ${!n.read ? "font-semibold" : "font-medium"} text-foreground`}>
                            {n.title}
                          </p>
                          {getTypeBadge(n.type)}
                          <Badge variant="outline" className="text-[10px]">
                            {n.source === "system" ? "System" : "App"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!n.read && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => markAsRead(n)} title="Mark as read">
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {n.source === "app" && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteNotification(n)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{formatTimestamp(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationHistory;
