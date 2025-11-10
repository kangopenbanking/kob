import { DashboardWidget } from "../DashboardWidget";
import { Button } from "@/components/ui/button";
import { Send, Download, CreditCard, PiggyBank } from "lucide-react";
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
      label: "Send Money",
      onClick: () => navigate("/payments"),
      color: "text-blue-500",
    },
    {
      icon: Download,
      label: "Receive Money",
      onClick: () => navigate("/mobile-money"),
      color: "text-green-500",
    },
    {
      icon: CreditCard,
      label: "Virtual Card",
      onClick: () => navigate("/virtual-cards"),
      color: "text-purple-500",
    },
    {
      icon: PiggyBank,
      label: "Savings",
      onClick: () => navigate("/savings"),
      color: "text-orange-500",
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
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            onClick={action.onClick}
            className="h-20 flex-col gap-2 hover:bg-accent"
          >
            <action.icon className={`h-6 w-6 ${action.color}`} />
            <span className="text-sm font-medium">{action.label}</span>
          </Button>
        ))}
      </div>
    </DashboardWidget>
  );
}
