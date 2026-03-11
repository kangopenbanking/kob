import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, ShoppingBag, Users, ArrowLeft, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMerchantContext } from '@/hooks/useMerchantContext';

export default function BusinessAnalytics() {
  const navigate = useNavigate();
  const { merchantId } = useMerchantContext();
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['analytics-orders', merchantId, timeframe],
    queryFn: async () => {
      if (!merchantId) return [];
      const daysAgo = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      const { data, error } = await supabase
        .from('pos_orders')
        .select('*, pos_order_items(*)')
        .eq('merchant_id', merchantId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!merchantId,
  });

  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
  const totalOrders = orders?.length || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const completedOrders = orders?.filter(o => o.status === 'completed') || [];
  const conversionRate = totalOrders > 0 ? (completedOrders.length / totalOrders) * 100 : 0;

  const dailyData: Record<string, { date: string; revenue: number; orders: number }> = {};
  orders?.forEach(order => {
    const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!dailyData[date]) dailyData[date] = { date, revenue: 0, orders: 0 };
    dailyData[date].revenue += order.total || 0;
    dailyData[date].orders += 1;
  });
  const chartData = Object.values(dailyData);

  const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
  orders?.forEach(order => {
    order.pos_order_items?.forEach((item: any) => {
      const key = item.product_variant_id || 'unknown';
      if (!productSales[key]) productSales[key] = { name: item.product_name || 'Unknown', quantity: 0, revenue: 0 };
      productSales[key].quantity += item.quantity;
      productSales[key].revenue += item.price * item.quantity;
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const stats = [
    { label: 'Revenue', value: `${(totalRevenue / 1000).toFixed(0)}K`, sub: 'FCFA', icon: DollarSign, color: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Orders', value: totalOrders.toString(), sub: 'total', icon: ShoppingBag, color: 'text-sky-600 bg-sky-500/10' },
    { label: 'Avg Order', value: `${(avgOrderValue / 1000).toFixed(0)}K`, sub: 'FCFA', icon: TrendingUp, color: 'text-violet-600 bg-violet-500/10' },
    { label: 'Conversion', value: `${conversionRate.toFixed(0)}%`, sub: 'rate', icon: Users, color: 'text-amber-600 bg-amber-500/10' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/40 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Analytics</h1>
        </div>

        <div className="flex gap-1.5">
          {(['7d', '30d', '90d'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                timeframe === tf
                  ? 'bg-foreground text-background'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted',
              )}
            >
              {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 px-5 pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-foreground/20 border-t-foreground" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {stats.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-border/40 bg-card p-4"
                  >
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', s.color.split(' ')[1])}>
                      <Icon className={cn('h-4 w-4', s.color.split(' ')[0])} strokeWidth={1.8} />
                    </div>
                    <p className="mt-3 text-xl font-bold tracking-tight text-foreground">
                      {s.value} <span className="text-xs font-medium text-muted-foreground">{s.sub}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Chart */}
            <div className="rounded-2xl border border-border/40 bg-card p-4 mb-5">
              <h2 className="text-[15px] font-bold text-foreground mb-4">Revenue Trend</h2>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Top Products */}
            <div className="rounded-2xl border border-border/40 bg-card p-4">
              <h2 className="text-[15px] font-bold text-foreground mb-3">Top Products</h2>
              {topProducts.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No sales data yet</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((product, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-xs font-bold text-muted-foreground">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{product.name}</p>
                        <p className="text-[11px] text-muted-foreground">{product.quantity} sold</p>
                      </div>
                      <p className="text-[13px] font-bold whitespace-nowrap">{product.revenue.toLocaleString()} F</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
