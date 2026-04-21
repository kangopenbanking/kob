import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, ShoppingBag, Users, DollarSign, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { PageGuide } from '@/components/business-app/PageGuide';

export default function BusinessAnalytics() {
  const { merchantId } = useMerchantContext();
  const isMobile = useIsMobile();
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

  const formatXAF = (n: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

  const stats = [
    { label: 'Revenue', value: `${(totalRevenue / 1000).toFixed(0)}K`, sub: 'FCFA', icon: DollarSign, color: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Orders', value: totalOrders.toString(), sub: 'total', icon: ShoppingBag, color: 'text-sky-600 bg-sky-500/10' },
    { label: 'Avg Order', value: `${(avgOrderValue / 1000).toFixed(0)}K`, sub: 'FCFA', icon: TrendingUp, color: 'text-violet-600 bg-violet-500/10' },
    { label: 'Conversion', value: `${conversionRate.toFixed(0)}%`, sub: 'rate', icon: Users, color: 'text-amber-600 bg-amber-500/10' },
  ];

  const handleExport = () => {
    if (!chartData.length) return;
    const csv = ['Date,Revenue,Orders'].concat(chartData.map(d => `"${d.date}",${d.revenue},${d.orders}`)).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `analytics-${timeframe}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <PageGuide
        title="Business Analytics"
        summary="Understand how your store is performing with revenue, order, and conversion trends."
        steps={[
          { title: 'Pick a timeframe', description: 'Switch between 7, 30, or 90 days to spot short-term spikes or longer trends.' },
          { title: 'Read the headline metrics', description: 'Track total revenue, orders, average basket, and conversion rate at a glance.' },
          { title: 'Export for reporting', description: 'Download the data to share with your accountant or investors.' },
        ]}
      />
      {/* Header */}
      <header className="pt-4 md:pt-0 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Business performance overview</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>

        <div className="flex gap-1.5">
          {(['7d', '30d', '90d'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                timeframe === tf ? 'bg-foreground text-background' : 'bg-muted/60 text-muted-foreground hover:bg-muted',
              )}
            >
              {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-foreground/20 border-t-foreground" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className={cn('grid gap-3 mb-5', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
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

          {/* Charts - side by side on desktop */}
          <div className={cn('gap-5 mb-5', isMobile ? 'space-y-5' : 'grid grid-cols-2')}>
            {/* Revenue Trend */}
            <div className="rounded-2xl border border-border/40 bg-card p-4">
              <h2 className="text-[15px] font-bold text-foreground mb-4">Revenue Trend</h2>
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 240}>
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
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Orders Chart */}
            <div className="rounded-2xl border border-border/40 bg-card p-4">
              <h2 className="text-[15px] font-bold text-foreground mb-4">Daily Orders</h2>
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products */}
          <div className="rounded-2xl border border-border/40 bg-card p-4">
            <h2 className="text-[15px] font-bold text-foreground mb-3">Top Products</h2>
            {topProducts.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No sales data yet</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((product, index) => {
                  const maxRev = topProducts[0]?.revenue || 1;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-xs font-bold text-muted-foreground shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{product.name}</p>
                        <div className="mt-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${(product.revenue / maxRev) * 100}%` }} />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{product.quantity} sold</p>
                      </div>
                      <p className="text-[13px] font-bold whitespace-nowrap">{formatXAF(product.revenue)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
