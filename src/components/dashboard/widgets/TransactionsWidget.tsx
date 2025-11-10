import { DashboardWidget } from "../DashboardWidget";
import { ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  type: "credit" | "debit";
  description: string;
  date: string;
  status: string;
}

interface TransactionsWidgetProps {
  id: string;
  transactions: Transaction[];
  onHide?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function TransactionsWidget({
  id,
  transactions,
  onHide,
  onRemove,
}: TransactionsWidgetProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  return (
    <DashboardWidget
      id={id}
      title="Recent Transactions"
      description="Latest activity"
      size="large"
      onHide={onHide}
      onRemove={onRemove}
    >
      <ScrollArea className="h-[300px]">
        <div className="space-y-3">
          {transactions.length > 0 ? (
            transactions.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      tx.type === "credit"
                        ? "bg-green-100 dark:bg-green-900"
                        : "bg-red-100 dark:bg-red-900"
                    }`}
                  >
                    {tx.type === "credit" ? (
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(tx.date)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-bold text-sm ${
                      tx.type === "credit" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}
                    {formatCurrency(Math.abs(tx.amount), tx.currency)}
                  </p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {tx.status}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowUpDown className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No transactions yet</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </DashboardWidget>
  );
}
