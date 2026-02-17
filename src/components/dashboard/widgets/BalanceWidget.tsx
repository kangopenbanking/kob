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
      className="bg-card"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-4xl font-bold tracking-tight">
                {showBalance ? formatCurrency(balance) : "••••••"}
              </p>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{currency}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-9 w-9 p-0"
            onClick={() => setShowBalance(!showBalance)}
          >
            {showBalance ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>

        {changePercent !== 0 && (
          <div className="flex items-center gap-2">
            {changePercent > 0 ? (
              <span className="status-pill bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
                <TrendingUp className="mr-1 h-3 w-3" />
                +{changePercent}%
              </span>
            ) : (
              <span className="status-pill bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400">
                <TrendingDown className="mr-1 h-3 w-3" />
                {changePercent}%
              </span>
            )}
            <span className="text-xs text-muted-foreground">vs last month</span>
          </div>
        )}
      </div>
    </DashboardWidget>
  );
}
