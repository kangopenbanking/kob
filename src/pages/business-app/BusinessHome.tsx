import React from 'react';
import { useParams } from 'react-router-dom';
import { StatCard } from '@/components/ui/stat-card';
import { Wallet, Clock, ShoppingBag, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessData } from '@/hooks/useBusinessData';

const BusinessHome: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const { 
    merchant, 
    availableBalance, 
    pendingBalance, 
    todayRevenue, 
    todayOrders,
    isLoading 
  } = useBusinessData(merchantId);

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const formatXAF = (amount: number) => {
    return new Intl.NumberFormat('fr-CM', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          {merchant?.business_name || 'Welcome to your business dashboard'}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          title="Available"
          value={formatXAF(availableBalance)}
          icon={<Wallet className="h-5 w-5" />}
        />
        
        <StatCard
          title="Pending"
          value={formatXAF(pendingBalance)}
          icon={<Clock className="h-5 w-5" />}
        />

        <StatCard
          title="Today's Revenue"
          value={formatXAF(todayRevenue)}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={todayRevenue > 0 ? { value: 100, label: 'vs yesterday' } : undefined}
        />

        <StatCard
          title="Today's Orders"
          value={todayOrders.toString()}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
      </div>
    </div>
  );
};

export default BusinessHome;
