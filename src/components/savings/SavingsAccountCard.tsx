import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowUpRight, ArrowDownLeft, TrendingUp } from "lucide-react";

interface SavingsAccountCardProps {
  account: any;
  showBalance: boolean;
  onSelect: () => void;
  isSelected: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export const SavingsAccountCard = ({
  account,
  showBalance,
  onSelect,
  isSelected,
  onDeposit,
  onWithdraw,
}: SavingsAccountCardProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getGoalProgress = () => {
    if (!account.target_amount) return 0;
    return (parseFloat(account.current_balance) / parseFloat(account.target_amount)) * 100;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'dormant':
        return 'secondary';
      case 'closed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-primary' : 'hover:shadow-md'
      }`}
      onClick={onSelect}
    >
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{account.account_name || account.savings_products?.product_name}</h3>
              <p className="text-sm text-muted-foreground capitalize">{account.savings_type.replace('_', ' ')}</p>
            </div>
            <Badge variant={getStatusBadgeVariant(account.status)}>{account.status}</Badge>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold">
              {showBalance ? formatCurrency(parseFloat(account.current_balance)) : '••••••'}
            </p>
          </div>

          {account.target_amount && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Goal Progress</span>
                <span className="font-medium">{getGoalProgress().toFixed(1)}%</span>
              </div>
              <Progress value={getGoalProgress()} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Target: {formatCurrency(parseFloat(account.target_amount))}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Interest Rate</p>
              <p className="font-semibold">{account.current_interest_rate}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Interest</p>
              <p className="font-semibold text-green-600">
                {showBalance ? formatCurrency(parseFloat(account.total_interest_earned)) : '••••'}
              </p>
            </div>
            {account.maturity_date && (
              <div>
                <p className="text-muted-foreground">Maturity</p>
                <p className="font-semibold">{new Date(account.maturity_date).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {account.is_locked && (
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded text-xs text-orange-600 dark:text-orange-400">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              Locked until maturity
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onDeposit(); }}>
              <ArrowDownLeft className="h-3 w-3 mr-1" />
              Deposit
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={(e) => { e.stopPropagation(); onWithdraw(); }}
              disabled={account.is_locked || parseFloat(account.available_balance) === 0}
            >
              <ArrowUpRight className="h-3 w-3 mr-1" />
              Withdraw
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
