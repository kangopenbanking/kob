import { DashboardWidget } from "../DashboardWidget";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface BalanceWidgetProps {
  id: string;
  balance: number;
  currency?: string;
  changePercent?: number;
  onHide?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function BalanceWidget({
  id,
  balance,
  currency = "XAF",
  changePercent = 0,
  onHide,
  onRemove,
}: BalanceWidgetProps) {
  const [showBalance, setShowBalance] = useState(true);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  return (
    <DashboardWidget
      id={id}
      title="Total Balance"
      description="Across all accounts"
      size="medium"
      onHide={onHide}
      onRemove={onRemove}
      className="bg-gradient-to-br from-primary/10 to-accent/10"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">
                {showBalance ? formatCurrency(balance) : "••••••"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBalance(!showBalance)}
          >
            {showBalance ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>

        {changePercent !== 0 && (
          <div className="flex items-center gap-2 text-sm">
            {changePercent > 0 ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-500">+{changePercent}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-red-500">{changePercent}%</span>
              </>
            )}
            <span className="text-muted-foreground">vs last month</span>
          </div>
        )}
      </div>
    </DashboardWidget>
  );
}
