import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, DollarSign, Package, Users, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function BusinessAnalytics() {
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  // Get merchant ID
  useEffect(() => {
    const getMerchantId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: merchant } = await supabase
        .from('gateway_merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (merchant) setMerchantId(merchant.id);
    };
    getMerchantId();
  }, []);

  // Fetch orders data
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

  // Calculate metrics
  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const totalOrders = orders?.length || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const paidOrders = orders?.filter(o => o.payment_status === 'succeeded') || [];
  const conversionRate = totalOrders > 0 ? (paidOrders.length / totalOrders) * 100 : 0;

  // Group by date for chart
  const dailyData: Record<string, { date: string; revenue: number; orders: number }> = {};

  orders?.forEach(order => {
    const date = new Date(order.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    if (!dailyData[date]) {
      dailyData[date] = { date, revenue: 0, orders: 0 };
    }

    dailyData[date].revenue += order.total_amount || 0;
    dailyData[date].orders += 1;
  });

  const chartData = Object.values(dailyData);

  // Top products
  const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

  orders?.forEach(order => {
    order.pos_order_items?.forEach((item: any) => {
      const key = item.product_variant_id || 'unknown';
      if (!productSales[key]) {
        productSales[key] = {
          name: item.product_name || 'Unknown Product',
          quantity: 0,
          revenue: 0,
        };
      }
      productSales[key].quantity += item.quantity;
      productSales[key].revenue += item.price * item.quantity;
    });
  });

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-primary-foreground/80 text-sm">Business performance insights</p>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-white text-primary'
                  : 'text-primary-foreground/70 hover:text-primary-foreground'
              }`}
            >
              {tf === '7d' ? 'Last 7 Days' : tf === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-green-700 font-medium">Total Revenue</p>
                </div>
                <p className="text-2xl font-bold text-green-900">
                  {totalRevenue.toLocaleString()} <span className="text-base">FCFA</span>
                </p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  <p className="text-xs text-blue-700 font-medium">Total Orders</p>
                </div>
                <p className="text-2xl font-bold text-blue-900">{totalOrders}</p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <p className="text-xs text-purple-700 font-medium">Avg Order Value</p>
                </div>
                <p className="text-2xl font-bold text-purple-900">
                  {avgOrderValue.toLocaleString()} <span className="text-base">FCFA</span>
                </p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  <p className="text-xs text-orange-700 font-medium">Conversion Rate</p>
                </div>
                <p className="text-2xl font-bold text-orange-900">{conversionRate.toFixed(1)}%</p>
              </Card>
            </div>

            {/* Revenue Chart */}
            <Card className="p-4">
              <h2 className="font-semibold mb-4">Revenue Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Top Products */}
            <Card className="p-4">
              <h2 className="font-semibold mb-4">Top Products</h2>
              {topProducts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No sales data yet</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.quantity} sold
                          </p>
                        </div>
                      </div>
                      <p className="font-bold text-sm">
                        {product.revenue.toLocaleString()} FCFA
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
