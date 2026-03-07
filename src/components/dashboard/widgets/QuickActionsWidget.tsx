import { DashboardWidget } from "../DashboardWidget";
import { Button } from "@/components/ui/button";
import { Send, CreditCard, PiggyBank, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickActionsWidgetProps {
  id: string;
  onHide?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function QuickActionsWidget({
  id,
  onHide,
  onRemove,
}: QuickActionsWidgetProps) {
  const navigate = useNavigate();

  const actions = [
    {
      icon: Send,
      label: "Send",
      onClick: () => navigate("/payments"),
      bg: "bg-primary/10",
      color: "text-primary",
    },
    {
      icon: ArrowDownToLine,
      label: "Fund",
      onClick: () => navigate("/fund-account"),
      bg: "bg-accent/50",
      color: "text-accent-foreground",
    },
    {
      icon: ArrowUpFromLine,
      label: "Withdraw",
      onClick: () => navigate("/payments"),
      bg: "bg-destructive/10",
      color: "text-destructive",
    },
    {
      icon: CreditCard,
      label: "Cards",
      onClick: () => navigate("/virtual-cards"),
      bg: "bg-secondary",
      color: "text-secondary-foreground",
    },
    {
      icon: PiggyBank,
      label: "Save",
      onClick: () => navigate("/savings"),
      bg: "bg-muted",
      color: "text-muted-foreground",
    },
  ];

  return (
    <DashboardWidget
      id={id}
      title="Quick Actions"
      description="Common tasks"
      size="medium"
      onHide={onHide}
      onRemove={onRemove}
    >
      <div className="grid grid-cols-5 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="flex flex-col items-center gap-2 rounded-2xl p-3 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${action.bg}`}>
              <action.icon className={`h-5 w-5 ${action.color}`} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{action.label}</span>
          </button>
        ))}
      </div>
    </DashboardWidget>
  );
}
