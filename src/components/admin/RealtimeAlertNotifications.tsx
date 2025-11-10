import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";

interface Alert {
  id: string;
  alert_type: string;
  message: string;
  severity: string;
  status: string;
  created_at: string;
}

export function RealtimeAlertNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch initial count
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from("system_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      setUnreadCount(count || 0);
    };

    // Fetch recent alerts
    const fetchRecentAlerts = async () => {
      const { data } = await supabase
        .from("system_alerts")
        .select("id, alert_type, message, severity, status, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentAlerts(data || []);
    };

    fetchUnreadCount();
    fetchRecentAlerts();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("system-alerts-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "system_alerts",
        },
        (payload) => {
          const newAlert = payload.new as Alert;
          console.log("New alert received:", newAlert);

          // Update unread count
          setUnreadCount((prev) => prev + 1);

          // Add to recent alerts
          setRecentAlerts((prev) => [newAlert, ...prev].slice(0, 5));

          // Show toast notification for critical/error alerts
          if (newAlert.severity === "critical" || newAlert.severity === "error") {
            toast({
              title: `🚨 ${newAlert.severity.toUpperCase()} Alert`,
              description: newAlert.message,
              variant: newAlert.severity === "critical" ? "destructive" : "default",
              duration: 10000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "error":
        return "bg-orange-500";
      case "warning":
        return "bg-yellow-500";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
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
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">System Alerts</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} active</Badge>
            )}
          </div>

          {recentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active alerts
            </p>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => navigate("/admin/system-alerts")}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(
                        alert.severity
                      )}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {alert.alert_type}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {alert.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/admin/system-alerts")}
          >
            View All Alerts
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
