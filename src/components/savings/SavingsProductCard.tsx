import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Lock, Target, Users, AlertCircle, PiggyBank } from "lucide-react";

interface SavingsProductCardProps {
  product: any;
  onSelect: () => void;
}

export const SavingsProductCard = ({ product, onSelect }: SavingsProductCardProps) => {
  const getProductIcon = (type: string) => {
    switch (type) {
      case 'fixed_deposit':
        return <Lock className="h-8 w-8 text-primary" />;
      case 'goal_savings':
        return <Target className="h-8 w-8 text-primary" />;
      case 'kids_savings':
        return <Users className="h-8 w-8 text-primary" />;
      case 'high_yield':
        return <TrendingUp className="h-8 w-8 text-primary" />;
      default:
        return <PiggyBank className="h-8 w-8 text-primary" />;
    }
  };

  const formatInterestRate = (rate: number) => {
    return `${rate}% p.a.`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getProductIcon(product.savings_type)}
            <div>
              <CardTitle className="text-lg">{product.product_name}</CardTitle>
              <CardDescription>{product.description}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-lg font-bold">
            {formatInterestRate(product.base_interest_rate)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Min. Opening</p>
            <p className="font-semibold">{formatCurrency(product.min_opening_balance)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Interest Paid</p>
            <p className="font-semibold capitalize">{product.interest_payment_frequency}</p>
          </div>
          {product.lock_in_period_months && (
            <div>
              <p className="text-muted-foreground">Lock-in Period</p>
              <p className="font-semibold">{product.lock_in_period_months} months</p>
            </div>
          )}
          {product.max_withdrawals_per_month && (
            <div>
              <p className="text-muted-foreground">Withdrawals/Month</p>
              <p className="font-semibold">{product.max_withdrawals_per_month}</p>
            </div>
          )}
        </div>

        {product.tiered_rates && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Tiered Interest Rates</p>
            </div>
            <div className="space-y-1 text-xs">
              {product.tiered_rates.map((tier: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span>{formatCurrency(tier.min_balance)} - {tier.max_balance ? formatCurrency(tier.max_balance) : 'Above'}</span>
                  <span className="font-semibold">{tier.rate}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={onSelect} className="w-full">
          Open Account
        </Button>
      </CardContent>
    </Card>
  );
};
