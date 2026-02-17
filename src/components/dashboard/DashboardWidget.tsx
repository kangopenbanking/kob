import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreVertical, EyeOff, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DashboardWidgetProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "small" | "medium" | "large";
  onHide?: (id: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
  accentColor?: string;
}

export function DashboardWidget({
  id,
  title,
  description,
  children,
  size = "medium",
  onHide,
  onRemove,
  className,
  accentColor,
}: DashboardWidgetProps) {
  const sizeClasses = {
    small: "col-span-1",
    medium: "col-span-1 md:col-span-2",
    large: "col-span-1 md:col-span-3",
  };

  return (
    <Card className={cn(
      sizeClasses[size],
      "rounded-xl border-0 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden",
      className
    )}>
      {accentColor && (
        <div className={cn("h-1 w-full", accentColor)} />
      )}
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
          {description && (
            <CardDescription className="text-xs text-muted-foreground">{description}</CardDescription>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl shadow-lg border-0">
            {onHide && (
              <DropdownMenuItem onClick={() => onHide(id)} className="rounded-lg">
                <EyeOff className="mr-2 h-4 w-4" />
                Hide Widget
              </DropdownMenuItem>
            )}
            {onRemove && (
              <DropdownMenuItem
                onClick={() => onRemove(id)}
                className="text-destructive rounded-lg"
              >
                <X className="mr-2 h-4 w-4" />
                Remove Widget
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
