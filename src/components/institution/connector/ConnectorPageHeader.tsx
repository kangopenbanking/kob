import { type LucideIcon } from "lucide-react";

interface ConnectorPageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function ConnectorPageHeader({ icon: Icon, title, description, children }: ConnectorPageHeaderProps) {
  return (
    <div className="rounded-2xl bg-primary p-6 sm:p-8 text-primary-foreground">
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-foreground/20 p-2.5 shrink-0">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-primary-foreground/80 text-sm mt-0.5">{description}</p>
          </div>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
