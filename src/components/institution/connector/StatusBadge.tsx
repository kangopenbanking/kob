import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  received: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  validating: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  processed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  draft: "bg-muted text-muted-foreground",
  generated: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  delivered: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  executed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  reconciled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  partially_failed: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-muted text-muted-foreground",
  ok: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  invalid: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  duplicate: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  skipped: "bg-muted text-muted-foreground",
  healthy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  degraded: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  down: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status.toLowerCase()] ?? "bg-muted text-muted-foreground";
  return (
    <Badge variant="secondary" className={cn("font-medium capitalize", style, className)}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
