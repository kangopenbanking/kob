import { type LucideIcon, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConnectorEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  showTemplateDownload?: boolean;
  onDownloadTemplate?: () => void;
}

export function ConnectorEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  showTemplateDownload,
  onDownloadTemplate,
}: ConnectorEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-2xl bg-muted p-4 mb-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
      <div className="flex items-center gap-3">
        {actionLabel && onAction && (
          <Button onClick={onAction}>{actionLabel}</Button>
        )}
        {showTemplateDownload && onDownloadTemplate && (
          <Button variant="outline" onClick={onDownloadTemplate}>
            <FileDown className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        )}
      </div>
    </div>
  );
}
