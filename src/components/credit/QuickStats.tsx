import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, ShieldCheck, Database } from 'lucide-react';

interface QuickStatsProps {
  totalLoans?: number;
  totalSavings?: number;
  kycVerified?: boolean;
  externalDataUsed?: boolean;
}

const QuickStats = ({ totalLoans, totalSavings, kycVerified, externalDataUsed }: QuickStatsProps) => {
  const stats = [
    {
      label: 'Total Loans',
      value: totalLoans ?? 0,
      icon: TrendingUp,
      color: 'hsl(var(--chart-1))',
      bgColor: 'bg-blue-100 dark:bg-blue-900'
    },
    {
      label: 'Total Savings',
      value: totalSavings ?? 0,
      icon: Wallet,
      color: 'hsl(var(--chart-2))',
      bgColor: 'bg-green-100 dark:bg-green-900'
    }
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className={`p-1.5 rounded ${stat.bgColor}`}
                    >
                      <Icon className="h-4 w-4" style={{ color: stat.color }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">KYC Status</span>
              </div>
              <Badge 
                variant={kycVerified ? 'default' : 'secondary'}
                className={kycVerified ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200' : ''}
              >
                {kycVerified ? 'Verified' : 'Pending'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">External Data</span>
              </div>
              <Badge 
                variant={externalDataUsed ? 'default' : 'outline'}
                className={externalDataUsed ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200' : ''}
              >
                {externalDataUsed ? 'Linked' : 'Not Linked'}
              </Badge>
            </div>
          </div>

          {!kycVerified && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Complete KYC verification to unlock blended scoring and increase your score confidence.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickStats;
