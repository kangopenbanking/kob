import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Globe, Settings2, ShoppingBag, DollarSign, Users, Search, ChevronRight, ToggleLeft, ToggleRight, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

const FEATURE_KEYS = [
  { key: 'pos_till', label: 'POS Till' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'qr_payments', label: 'QR Payments' },
  { key: 'coupons', label: 'Coupons' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'staff_management', label: 'Staff Management' },
  { key: 'analytics', label: 'Analytics' },
];

const BusinessAppManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null);

  // KPI: Total merchants
  const { data: merchants, isLoading: merchantsLoading } = useQuery({
    queryKey: ['admin-biz-merchants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_merchants')
        .select('id, business_name, user_id, created_at, status')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // KPI: Total orders across all merchants
  const { data: orderStats } = useQuery({
    queryKey: ['admin-biz-order-stats'],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [today, week, month, all] = await Promise.all([
        supabase.from('pos_orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
        supabase.from('pos_orders').select('id', { count: 'exact', head: true }).gte('created_at', weekStart),
        supabase.from('pos_orders').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('pos_orders').select('id', { count: 'exact', head: true }),
      ]);
      return { today: today.count || 0, week: week.count || 0, month: month.count || 0, total: all.count || 0 };
    },
  });

  // KPI: GMV
  const { data: gmv } = useQuery({
    queryKey: ['admin-biz-gmv'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pos_orders')
        .select('total')
        .eq('status', 'paid');
      return (data || []).reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    },
  });

  // Orders by day for chart
  const { data: ordersByDay } = useQuery({
    queryKey: ['admin-biz-orders-by-day'],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data } = await supabase
        .from('pos_orders')
        .select('created_at, total')
        .gte('created_at', since)
        .order('created_at');
      
      const dayMap = new Map<string, { orders: number; revenue: number }>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().split('T')[0];
        dayMap.set(key, { orders: 0, revenue: 0 });
      }
      for (const o of data || []) {
        const key = o.created_at.split('T')[0];
        const existing = dayMap.get(key);
        if (existing) {
          existing.orders += 1;
          existing.revenue += o.total || 0;
        }
      }
      return Array.from(dayMap.entries()).map(([date, stats]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...stats,
      }));
    },
  });

  // Feature flags for selected merchant
  const { data: featureFlags } = useQuery({
    queryKey: ['admin-biz-flags', selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return [];
      const { data } = await supabase
        .from('business_app_feature_flags')
        .select('*')
        .eq('merchant_id', selectedMerchant.id);
      return data || [];
    },
    enabled: !!selectedMerchant,
  });

  // Per-merchant order count
  const { data: merchantOrderCounts } = useQuery({
    queryKey: ['admin-biz-merchant-orders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pos_orders')
        .select('merchant_id, total');
      const map = new Map<string, { count: number; revenue: number }>();
      for (const o of data || []) {
        const e = map.get(o.merchant_id) || { count: 0, revenue: 0 };
        e.count += 1;
        e.revenue += o.total || 0;
        map.set(o.merchant_id, e);
      }
      return map;
    },
  });

  const toggleFeature = useMutation({
    mutationFn: async ({ merchantId, featureKey, enabled }: { merchantId: string; featureKey: string; enabled: boolean }) => {
      const { error } = await supabase.from('business_app_feature_flags').upsert({
        merchant_id: merchantId,
        feature_key: featureKey,
        is_enabled: enabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'merchant_id,feature_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-biz-flags'] });
      toast.success('Feature toggle updated');
    },
  });

  const formatXAF = (n: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

  const filteredMerchants = merchants?.filter(m =>
    m.business_name?.toLowerCase().includes(search.toLowerCase())
  );

  const isFeatureEnabled = (featureKey: string) => {
    const flag = featureFlags?.find((f: any) => f.feature_key === featureKey);
    return flag ? flag.is_enabled : true; // default enabled
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business App Management</h1>
        <p className="text-muted-foreground">Monitor merchants, orders, and feature configuration across the platform.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Active Merchants"
          value={merchants?.filter(m => m.is_active).length ?? 0}
          icon={<Store className="h-5 w-5" />}
        />
        <StatCard
          title="Orders Today"
          value={orderStats?.today ?? 0}
          icon={<ShoppingBag className="h-5 w-5" />}
          trend={orderStats ? { value: orderStats.week > 0 ? Math.round(((orderStats.today * 7) / orderStats.week - 1) * 100) : 0, label: 'vs avg' } : undefined}
        />
        <StatCard
          title="Orders This Month"
          value={orderStats?.month ?? 0}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Total GMV"
          value={formatXAF(gmv ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
        />
      </div>

      <Tabs defaultValue="merchants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="merchants">Merchants</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="merchants" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search merchants..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchantsLoading ? (
                  [1, 2, 3].map(i => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                ) : filteredMerchants?.map(m => {
                  const stats = merchantOrderCounts?.get(m.id);
                  return (
                    <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelectedMerchant(m)}>
                      <TableCell className="font-medium">{m.business_name || 'Unnamed'}</TableCell>
                      <TableCell className="text-right">{stats?.count ?? 0}</TableCell>
                      <TableCell className="text-right">{formatXAF(stats?.revenue ?? 0)}</TableCell>
                      <TableCell>
                        <Badge variant={m.is_active ? 'default' : 'secondary'}>
                          {m.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {new Date(m.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Orders & Revenue (14 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ordersByDay || []}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Merchants */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Top Merchants by Revenue</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {merchants
                  ?.map(m => ({ ...m, revenue: merchantOrderCounts?.get(m.id)?.revenue ?? 0, orders: merchantOrderCounts?.get(m.id)?.count ?? 0 }))
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 10)
                  .map((m, i) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.business_name}</p>
                        <p className="text-xs text-muted-foreground">{m.orders} orders</p>
                      </div>
                      <p className="text-sm font-bold">{formatXAF(m.revenue)}</p>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Global Feature Defaults</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Select a merchant from the Merchants tab to configure per-merchant feature toggles.</p>
              <div className="space-y-3">
                {FEATURE_KEYS.map(f => (
                  <div key={f.key} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">{f.label}</span>
                    <Badge variant="default">Enabled by default</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Merchant Detail Sheet */}
      <Sheet open={!!selectedMerchant} onOpenChange={open => !open && setSelectedMerchant(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedMerchant?.business_name}</SheetTitle>
          </SheetHeader>
          {selectedMerchant && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <Card className="border">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Orders</p>
                    <p className="text-lg font-bold">{merchantOrderCounts?.get(selectedMerchant.id)?.count ?? 0}</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-lg font-bold">{formatXAF(merchantOrderCounts?.get(selectedMerchant.id)?.revenue ?? 0)}</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h3 className="text-sm font-bold mb-3">Feature Toggles</h3>
                <div className="space-y-2">
                  {FEATURE_KEYS.map(f => {
                    const enabled = isFeatureEnabled(f.key);
                    return (
                      <div key={f.key} className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm">{f.label}</span>
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => toggleFeature.mutate({ merchantId: selectedMerchant.id, featureKey: f.key, enabled: !enabled })}
                        >
                          {enabled ? (
                            <ToggleRight className="h-5 w-5 text-primary" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default BusinessAppManagement;
