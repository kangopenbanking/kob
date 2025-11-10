import { DashboardWidget } from "../DashboardWidget";
import { Activity, Check, AlertCircle, Info, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActivityItem {
  id: string;
  type: "success" | "warning" | "info" | "pending";
  title: string;
  description: string;
  timestamp: string;
}

interface ActivityFeedWidgetProps {
  id: string;
  activities: ActivityItem[];
  onHide?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function ActivityFeedWidget({
  id,
  activities,
  onHide,
  onRemove,
}: ActivityFeedWidgetProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <Check className="h-4 w-4 text-green-600" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-orange-600" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case "success":
        return "default";
      case "warning":
        return "destructive";
      case "info":
        return "secondary";
      case "pending":
        return "outline";
      default:
        return "outline";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-100 dark:bg-green-900";
      case "warning":
        return "bg-yellow-100 dark:bg-yellow-900";
      case "info":
        return "bg-blue-100 dark:bg-blue-900";
      case "pending":
        return "bg-orange-100 dark:bg-orange-900";
      default:
        return "bg-gray-100 dark:bg-gray-900";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <DashboardWidget
      id={id}
      title="Activity Feed"
      description="Recent updates"
      size="large"
      onHide={onHide}
      onRemove={onRemove}
    >
      <ScrollArea className="h-[300px]">
        <div className="space-y-3">
          {activities.length > 0 ? (
            activities.slice(0, 10).map((activity) => (
              <div
                key={activity.id}
                className="flex gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className={`p-2 rounded-full h-fit ${getTypeColor(activity.type)}`}>
                  {getIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <Badge
                      variant={getBadgeVariant(activity.type)}
                      className="text-xs shrink-0"
                    >
                      {activity.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </DashboardWidget>
  );
}
