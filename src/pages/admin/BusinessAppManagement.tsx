import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Store, ShoppingBag, DollarSign, Search, ChevronRight, ToggleLeft, ToggleRight,
  TrendingUp, ExternalLink, Copy, Users, Package, Bus, Shield, AlertTriangle,
  Eye, Ban, CheckCircle2, Clock, Globe, MapPin, CreditCard, BarChart3,
  RefreshCw, Download, Filter, MoreVertical, Loader2, Activity,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getCanonicalUrl } from '@/config/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';

/* ── Feature flag registry ── */
const FEATURE_KEYS = [
  { key: 'pos_till', label: 'POS Till', icon: CreditCard, description: 'Point-of-sale terminal' },
  { key: 'wallet', label: 'Wallet', icon: DollarSign, description: 'Balance & payouts' },
  { key: 'qr_payments', label: 'QR Payments', icon: Globe, description: 'QR code receive' },
  { key: 'coupons', label: 'Coupons', icon: ShoppingBag, description: 'Discounts & promos' },
  { key: 'reviews', label: 'Reviews', icon: BarChart3, description: 'Customer feedback' },
  { key: 'staff_management', label: 'Staff Management', icon: Users, description: 'Team roles & access' },
  { key: 'analytics', label: 'Analytics', icon: TrendingUp, description: 'Revenue reports' },
  { key: 'travel_services', label: 'Travel Services', icon: Bus, description: 'Transport & booking' },
  { key: 'storefront', label: 'Storefront', icon: Store, description: 'Online store' },
  { key: 'inventory', label: 'Inventory', icon: Package, description: 'Stock management' },
  { key: 'bulk_operations', label: 'Bulk Operations', icon: RefreshCw, description: 'Mass payouts & imports' },
  { key: 'enterprise', label: 'Enterprise', icon: Shield, description: 'White-label & branding' },
];

/* ── Helpers ── */
const formatXAF = (n: number) =>
  new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

const formatNum = (n: number) => new Intl.NumberFormat().format(n);

const BusinessAppManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null);
  const [detailTab, setDetailTab] = useState('overview');

  const getMerchantAppUrl = (merchantId: string) => getCanonicalUrl(`/biz`);
  const openMerchantApp = () => window.open('/biz', '_blank', 'noopener,noreferrer');

  const copyMerchantAppUrl = async (merchantId: string) => {
    try {
      await navigator.clipboard.writeText(getMerchantAppUrl(merchantId));
      toast.success('App URL copied');
    } catch { toast.error('Could not copy URL'); }
  };

  /* ── Queries ── */
  const { data: merchants, isLoading: merchantsLoading } = useQuery({
    queryKey: ['admin-biz-merchants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_merchants')
        .select('id, business_name, user_id, created_at, status, kyb_status, contact_email, contact_phone, webhook_url')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
      return data || [];
    },
  });

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

  const { data: gmv } = useQuery({
    queryKey: ['admin-biz-gmv'],
    queryFn: async () => {
      const { data } = await supabase.from('pos_orders').select('total').eq('status', 'paid');
      return (data || []).reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    },
  });

  const { data: totalProducts } = useQuery({
    queryKey: ['admin-biz-total-products'],
    queryFn: async () => {
      const { count } = await supabase.from('pos_products').select('id', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: totalStaff } = useQuery({
    queryKey: ['admin-biz-total-staff'],
    queryFn: async () => {
      const { count } = await supabase.from('merchant_staff_roles').select('id', { count: 'exact', head: true }).eq('is_active', true);
      return count || 0;
    },
  });

  const { data: ordersByDay } = useQuery({
    queryKey: ['admin-biz-orders-by-day'],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data } = await supabase.from('pos_orders').select('created_at, total').gte('created_at', since).order('created_at');
      const dayMap = new Map<string, { orders: number; revenue: number }>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        dayMap.set(d.toISOString().split('T')[0], { orders: 0, revenue: 0 });
      }
      for (const o of data || []) {
        const key = o.created_at.split('T')[0];
        const existing = dayMap.get(key);
        if (existing) { existing.orders += 1; existing.revenue += o.total || 0; }
      }
      return Array.from(dayMap.entries()).map(([date, stats]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...stats,
      }));
    },
  });

  const { data: merchantOrderCounts } = useQuery({
    queryKey: ['admin-biz-merchant-orders'],
    queryFn: async () => {
      const { data } = await supabase.from('pos_orders').select('merchant_id, total, status');
      const map = new Map<string, { count: number; revenue: number; paid: number }>();
      for (const o of data || []) {
        const e = map.get(o.merchant_id) || { count: 0, revenue: 0, paid: 0 };
        e.count += 1;
        e.revenue += o.total || 0;
        if (o.status === 'paid') e.paid += 1;
        map.set(o.merchant_id, e);
      }
      return map;
    },
  });

  /* ── Selected merchant details ── */
  const { data: featureFlags } = useQuery({
    queryKey: ['admin-biz-flags', selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return [];
      const { data } = await supabase.from('business_app_feature_flags').select('*').eq('merchant_id', selectedMerchant.id);
      return data || [];
    },
    enabled: !!selectedMerchant,
  });

  const { data: merchantStaff } = useQuery({
    queryKey: ['admin-biz-merchant-staff', selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return [];
      const { data } = await supabase
        .from('merchant_staff_roles')
        .select('id, user_id, role, is_active, created_at')
        .eq('merchant_id', selectedMerchant.id);
      return data || [];
    },
    enabled: !!selectedMerchant,
  });

  const { data: merchantProducts } = useQuery({
    queryKey: ['admin-biz-merchant-products', selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return { count: 0, active: 0 };
      const { data } = await supabase
        .from('pos_products')
        .select('id, is_active')
        .eq('merchant_id', selectedMerchant.id);
      return { count: data?.length || 0, active: data?.filter((p: any) => p.is_active).length || 0 };
    },
    enabled: !!selectedMerchant,
  });

  const { data: merchantStore } = useQuery({
    queryKey: ['admin-biz-merchant-store', selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return null;
      const { data } = await supabase
        .from('pos_store_profiles')
        .select('id, store_name, is_published, created_at')
        .eq('merchant_id', selectedMerchant.id)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedMerchant,
  });

  const { data: merchantTravel } = useQuery({
    queryKey: ['admin-biz-merchant-travel', selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return [];
      const { data } = await supabase
        .from('travel_services')
        .select('id, agency_name, is_active')
        .eq('merchant_id', selectedMerchant.id);
      return data || [];
    },
    enabled: !!selectedMerchant,
  });

  const { data: merchantWallets } = useQuery({
    queryKey: ['admin-biz-merchant-wallets', selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return [];
      const { data } = await supabase
        .from('gateway_merchant_wallets')
        .select('currency, available_balance, pending_balance, ledger_balance')
        .eq('merchant_id', selectedMerchant.id);
      return data || [];
    },
    enabled: !!selectedMerchant,
  });

  /* ── Mutations ── */
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

  /* ── Derived ── */
  const isFeatureEnabled = (featureKey: string) => {
    const flag = featureFlags?.find((f: any) => f.feature_key === featureKey);
    return flag ? flag.is_enabled : true;
  };

  const filteredMerchants = merchants?.filter(m => {
    const matchesSearch = m.business_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const kybStats = {
    approved: merchants?.filter(m => m.kyb_status === 'approved').length || 0,
    pending: merchants?.filter(m => m.kyb_status === 'pending' || m.kyb_status === 'submitted').length || 0,
    not_submitted: merchants?.filter(m => !m.kyb_status || m.kyb_status === 'not_submitted').length || 0,
    rejected: merchants?.filter(m => m.kyb_status === 'rejected').length || 0,
  };

  const handleExportCSV = () => {
    if (!merchants?.length) return;
    const headers = ['Business Name', 'Status', 'KYB', 'Created', 'Orders', 'Revenue'];
    const rows = merchants.map(m => {
      const s = merchantOrderCounts?.get(m.id);
      return [m.business_name, m.status, m.kyb_status || 'N/A', m.created_at.split('T')[0], s?.count || 0, s?.revenue || 0];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `business-merchants-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-background to-background border p-6 md:p-8">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Business App Management</h1>
              <p className="text-sm text-muted-foreground">Monitor merchants, orders, features & compliance across the platform</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Total Merchants" value={merchants?.length ?? 0} icon={<Store className="h-5 w-5" />} />
        <StatCard
          title="Active Merchants"
          value={merchants?.filter(m => m.status === 'active').length ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard title="Orders Today" value={orderStats?.today ?? 0} icon={<ShoppingBag className="h-5 w-5" />}
          trend={orderStats ? { value: orderStats.week > 0 ? Math.round(((orderStats.today * 7) / orderStats.week - 1) * 100) : 0, label: 'vs avg' } : undefined}
        />
        <StatCard title="Total GMV" value={formatXAF(gmv ?? 0)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Total Products" value={formatNum(totalProducts ?? 0)} icon={<Package className="h-5 w-5" />} />
        <StatCard title="Active Staff" value={formatNum(totalStaff ?? 0)} icon={<Users className="h-5 w-5" />} />
      </div>

      {/* KYB Overview Strip */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">KYB Verification Overview</h3>
            <Badge variant="outline" className="text-xs">{merchants?.length || 0} total</Badge>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Approved', count: kybStats.approved, color: 'text-emerald-600 bg-emerald-500/10', icon: CheckCircle2 },
              { label: 'Pending', count: kybStats.pending, color: 'text-amber-600 bg-amber-500/10', icon: Clock },
              { label: 'Not Submitted', count: kybStats.not_submitted, color: 'text-muted-foreground bg-muted', icon: AlertTriangle },
              { label: 'Rejected', count: kybStats.rejected, color: 'text-destructive bg-destructive/10', icon: Ban },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2.5 rounded-xl border p-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-bold">{s.count}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="merchants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="merchants">Merchants</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="features">Feature Config</TabsTrigger>
          <TabsTrigger value="health">Platform Health</TabsTrigger>
        </TabsList>

        {/* ── Merchants Tab ── */}
        <TabsContent value="merchants" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search merchants..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>KYB</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchantsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredMerchants?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No merchants found</TableCell>
                  </TableRow>
                ) : filteredMerchants?.map(m => {
                  const stats = merchantOrderCounts?.get(m.id);
                  return (
                    <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedMerchant(m); setDetailTab('overview'); }}>
                      <TableCell className="font-medium max-w-[200px] truncate">{m.business_name || 'Unnamed'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.business_type || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{stats?.count ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatXAF(stats?.revenue ?? 0)}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === 'active' ? 'default' : m.status === 'suspended' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${
                          m.kyb_status === 'approved' ? 'border-emerald-500/50 text-emerald-600' :
                          m.kyb_status === 'rejected' ? 'border-destructive/50 text-destructive' :
                          m.kyb_status === 'pending' || m.kyb_status === 'submitted' ? 'border-amber-500/50 text-amber-600' :
                          ''
                        }`}>
                          {m.kyb_status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <p className="text-xs text-muted-foreground text-right">{filteredMerchants?.length || 0} of {merchants?.length || 0} merchants</p>
        </TabsContent>

        {/* ── Analytics Tab ── */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">Revenue Trend (14 days)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ordersByDay || []}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Orders Volume (14 days)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ordersByDay || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Merchants */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Top 10 Merchants by Revenue</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {merchants
                  ?.map(m => ({ ...m, revenue: merchantOrderCounts?.get(m.id)?.revenue ?? 0, orders: merchantOrderCounts?.get(m.id)?.count ?? 0 }))
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 10)
                  .map((m, i) => {
                    const maxRev = merchants?.map(x => merchantOrderCounts?.get(x.id)?.revenue ?? 0).sort((a, b) => b - a)[0] || 1;
                    return (
                      <div key={m.id} className="flex items-center gap-3 group cursor-pointer rounded-lg p-2 hover:bg-muted/40" onClick={() => { setSelectedMerchant(m); setDetailTab('overview'); }}>
                        <span className="text-sm font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{m.business_name}</p>
                            <p className="text-sm font-bold tabular-nums">{formatXAF(m.revenue)}</p>
                          </div>
                          <Progress value={(m.revenue / maxRev) * 100} className="h-1.5" />
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Feature Config Tab ── */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Global Feature Registry</CardTitle>
              <CardDescription>These features can be toggled per-merchant from the merchant detail panel.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {FEATURE_KEYS.map(f => {
                  const Icon = f.icon;
                  return (
                    <div key={f.key} className="flex items-center gap-3 rounded-xl border p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{f.label}</p>
                        <p className="text-[11px] text-muted-foreground">{f.description}</p>
                      </div>
                      <Badge variant="default" className="text-[10px]">Default ON</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Platform Health Tab ── */}
        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-2xl font-bold">{orderStats?.month ?? 0}</p>
                <p className="text-xs text-muted-foreground">Orders this month</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Store className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{merchants?.filter(m => m.status === 'active').length ?? 0} / {merchants?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active / Total merchants</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Shield className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold">{kybStats.approved}</p>
                <p className="text-xs text-muted-foreground">KYB Verified</p>
                {kybStats.pending > 0 && (
                  <Badge variant="outline" className="mt-2 text-[10px] border-amber-500/50 text-amber-600">
                    {kybStats.pending} pending review
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Business App Routes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">All routes within the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/biz</code> prefix are active.</p>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {[
                  'home', 'orders', 'products', 'wallet', 'customers', 'analytics', 'staff',
                  'till', 'storefront', 'coupons', 'reviews', 'inventory', 'travel',
                  'settings', 'compliance', 'enterprise', 'disputes', 'kyb',
                  'api-keys', 'webhooks', 'settlement-accounts', 'payouts', 'settlements',
                ].map(route => (
                  <div key={route} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <code>/biz/{route}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Merchant Detail Sheet ── */}
      <Sheet open={!!selectedMerchant} onOpenChange={open => !open && setSelectedMerchant(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">{selectedMerchant?.business_name}</SheetTitle>
            <SheetDescription className="text-xs">
              ID: {selectedMerchant?.id?.slice(0, 8)}… • {selectedMerchant?.business_type || 'N/A'} • Joined {selectedMerchant ? new Date(selectedMerchant.created_at).toLocaleDateString() : ''}
            </SheetDescription>
          </SheetHeader>

          {selectedMerchant && (
            <div className="mt-4 space-y-5">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Orders', value: merchantOrderCounts?.get(selectedMerchant.id)?.count ?? 0 },
                  { label: 'Revenue', value: formatXAF(merchantOrderCounts?.get(selectedMerchant.id)?.revenue ?? 0) },
                  { label: 'Products', value: merchantProducts?.count ?? 0 },
                ].map(s => (
                  <Card key={s.label} className="border">
                    <CardContent className="p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className="text-sm font-bold">{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={selectedMerchant.status === 'active' ? 'default' : 'destructive'}>
                  {selectedMerchant.status}
                </Badge>
                <Badge variant="outline" className={
                  selectedMerchant.kyb_status === 'approved' ? 'border-emerald-500/50 text-emerald-600' :
                  selectedMerchant.kyb_status === 'rejected' ? 'border-destructive/50 text-destructive' : ''
                }>
                  KYB: {selectedMerchant.kyb_status || 'N/A'}
                </Badge>
                {merchantStore?.is_published && <Badge variant="outline" className="border-blue-500/50 text-blue-600">Store Live</Badge>}
              </div>

              <Separator />

              {/* Tabbed detail sections */}
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="w-full grid grid-cols-4 h-8">
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="features" className="text-xs">Features</TabsTrigger>
                  <TabsTrigger value="staff" className="text-xs">Staff</TabsTrigger>
                  <TabsTrigger value="access" className="text-xs">Access</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-3">
                  {/* Contact */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact</h4>
                    <div className="text-sm space-y-1">
                      {selectedMerchant.contact_email && <p>📧 {selectedMerchant.contact_email}</p>}
                      {selectedMerchant.contact_phone && <p>📱 {selectedMerchant.contact_phone}</p>}
                      {selectedMerchant.webhook_url && <p className="truncate">🔗 {selectedMerchant.webhook_url}</p>}
                    </div>
                  </div>

                  {/* Wallet Balances */}
                  {merchantWallets && merchantWallets.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Wallet Balances</h4>
                      {merchantWallets.map((w: any) => (
                        <div key={w.currency} className="rounded-lg border p-3 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Available ({w.currency})</span>
                            <span className="font-bold">{formatXAF(w.available_balance)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Pending</span><span>{formatXAF(w.pending_balance)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Ledger</span><span>{formatXAF(w.ledger_balance)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Store */}
                  {merchantStore && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Storefront</h4>
                      <div className="rounded-lg border p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{merchantStore.store_name}</p>
                          <p className="text-xs text-muted-foreground">Created {new Date(merchantStore.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge variant={merchantStore.is_published ? 'default' : 'secondary'}>
                          {merchantStore.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Travel */}
                  {merchantTravel && merchantTravel.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Travel Services</h4>
                      {merchantTravel.map((t: any) => (
                        <div key={t.id} className="rounded-lg border p-3 flex items-center justify-between">
                          <p className="text-sm font-medium">{t.agency_name}</p>
                          <Badge variant={t.is_active ? 'default' : 'secondary'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="features" className="space-y-2 mt-3">
                  {FEATURE_KEYS.map(f => {
                    const enabled = isFeatureEnabled(f.key);
                    const Icon = f.icon;
                    return (
                      <div key={f.key} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{f.label}</p>
                          <p className="text-[10px] text-muted-foreground">{f.description}</p>
                        </div>
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                          disabled={toggleFeature.isPending}
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
                </TabsContent>

                <TabsContent value="staff" className="space-y-3 mt-3">
                  {merchantStaff && merchantStaff.length > 0 ? (
                    merchantStaff.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-muted-foreground truncate">{s.user_id.slice(0, 12)}…</p>
                          <p className="text-xs text-muted-foreground">{s.role} • {new Date(s.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {s.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No staff members assigned</p>
                  )}
                </TabsContent>

                <TabsContent value="access" className="space-y-3 mt-3">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">App Access</h4>
                    <Card className="border">
                      <CardContent className="p-3 space-y-3">
                        <p className="text-xs text-muted-foreground break-all font-mono">{getMerchantAppUrl(selectedMerchant.id)}</p>
                        <div className="flex items-center gap-2">
                          <Button className="flex-1" size="sm" onClick={openMerchantApp}>
                            <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open App
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copyMerchantAppUrl(selectedMerchant.id)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => window.open(`/admin/merchant-management`, '_blank')}>
                        <Eye className="h-3.5 w-3.5 mr-2" /> View in Merchant Mgmt
                      </Button>
                      <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => window.open(`/admin/business-kyc-review`, '_blank')}>
                        <Shield className="h-3.5 w-3.5 mr-2" /> KYB Review
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default BusinessAppManagement;
