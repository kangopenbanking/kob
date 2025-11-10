import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreVertical, Eye, EyeOff, X } from "lucide-react";
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
}: DashboardWidgetProps) {
  const sizeClasses = {
    small: "col-span-1",
    medium: "col-span-1 md:col-span-2",
    large: "col-span-1 md:col-span-3",
  };

  return (
    <Card className={cn(sizeClasses[size], className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onHide && (
              <DropdownMenuItem onClick={() => onHide(id)}>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide Widget
              </DropdownMenuItem>
            )}
            {onRemove && (
              <DropdownMenuItem
                onClick={() => onRemove(id)}
                className="text-destructive"
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
