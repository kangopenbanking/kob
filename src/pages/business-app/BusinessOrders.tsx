import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingBag, Clock, CheckCircle2, XCircle, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type OrderStatus = 'all' | 'paid' | 'pending_payment' | 'draft' | 'cancelled' | 'refunded';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  paid: { label: 'Paid', color: 'bg-[hsl(150,40%,90%)] text-[hsl(150,40%,30%)]', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  pending_payment: { label: 'Pending', color: 'bg-[hsl(40,90%,90%)] text-[hsl(40,60%,30%)]', icon: <Clock className="h-3.5 w-3.5" /> },
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
  cancelled: { label: 'Cancelled', color: 'bg-[hsl(0,60%,93%)] text-[hsl(0,60%,40%)]', icon: <XCircle className="h-3.5 w-3.5" /> },
  refunded: { label: 'Refunded', color: 'bg-[hsl(260,40%,92%)] text-[hsl(260,40%,35%)]', icon: <RefreshCw className="h-3.5 w-3.5" /> },
};

const BusinessOrders: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const [filter, setFilter] = useState<OrderStatus>('all');

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['pos-orders', merchantId, filter],
    queryFn: async () => {
      if (!merchantId) return [];
      let query = supabase
        .from('pos_orders')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId,
  });

  const formatXAF = (amount: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filters: { key: OrderStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'pending_payment', label: 'Pending' },
    { key: 'draft', label: 'Draft' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background p-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {orders?.length ?? 0} order{(orders?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="rounded-xl" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </header>

      {/* Filters */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              filter === key ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : !orders?.length ? (
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <ShoppingBag className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {filter === 'all' ? 'No orders yet' : `No ${filter.replace('_', ' ')} orders`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {orders.map((order: any, i: number) => {
              const sc = statusConfig[order.status] || statusConfig.draft;
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="border-0 shadow-sm">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-foreground">
                            {order.order_number || `#${order.id.slice(0, 8)}`}
                          </p>
                          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${sc.color}`}>
                            {sc.icon} {sc.label}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatTime(order.created_at)}</span>
                          {order.customer_name && <span>· {order.customer_name}</span>}
                          {order.channel && <span>· {order.channel}</span>}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-foreground">{formatXAF(order.total || 0)}</p>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default BusinessOrders;
