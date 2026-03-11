import React, { useState } from 'react';
import { ShoppingBag, Clock, CheckCircle2, XCircle, RefreshCw, ChevronRight, ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type OrderStatus = 'all' | 'paid' | 'pending_payment' | 'draft' | 'cancelled' | 'refunded';

const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
  paid: { label: 'Paid', dot: 'bg-emerald-500', bg: 'bg-emerald-500/10 text-emerald-700' },
  pending_payment: { label: 'Pending', dot: 'bg-amber-500', bg: 'bg-amber-500/10 text-amber-700' },
  draft: { label: 'Draft', dot: 'bg-muted-foreground', bg: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', dot: 'bg-rose-500', bg: 'bg-rose-500/10 text-rose-700' },
  refunded: { label: 'Refunded', dot: 'bg-violet-500', bg: 'bg-violet-500/10 text-violet-700' },
  processing: { label: 'Processing', dot: 'bg-sky-500', bg: 'bg-sky-500/10 text-sky-700' },
  completed: { label: 'Completed', dot: 'bg-emerald-500', bg: 'bg-emerald-500/10 text-emerald-700' },
  shipped: { label: 'Shipped', dot: 'bg-sky-500', bg: 'bg-sky-500/10 text-sky-700' },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_payment'],
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'completed', 'shipped'],
  processing: ['completed', 'shipped'],
  shipped: ['completed'],
};

const BusinessOrders: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const [filter, setFilter] = useState<OrderStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const queryClient = useQueryClient();

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

  const { data: statusHistory } = useQuery({
    queryKey: ['order-status-history', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return [];
      const { data } = await supabase
        .from('pos_order_status_history')
        .select('*')
        .eq('order_id', selectedOrder.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!selectedOrder,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus, previousStatus }: { orderId: string; newStatus: string; previousStatus: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from('pos_orders')
        .update({ status: newStatus as any })
        .eq('id', orderId);
      if (updateError) throw updateError;
      const { error: historyError } = await supabase
        .from('pos_order_status_history')
        .insert({
          order_id: orderId,
          status: newStatus as any,
          created_by: user?.id,
          note: `Changed from ${previousStatus} to ${newStatus}`,
        });
      if (historyError) throw historyError;
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['pos-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-status-history'] });
      toast.success(`Order updated to ${statusConfig[newStatus]?.label || newStatus}`);
      if (selectedOrder) setSelectedOrder({ ...selectedOrder, status: newStatus });
    },
    onError: (e: any) => toast.error(e.message),
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

  const filters: { key: OrderStatus; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'pending_payment', label: 'Pending' },
    { key: 'draft', label: 'Draft' },
  ];

  const filteredOrders = orders?.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (o.order_number?.toLowerCase().includes(s) || o.customer_name?.toLowerCase().includes(s) || o.id.toLowerCase().includes(s));
  });

  const nextStatuses = selectedOrder ? (STATUS_TRANSITIONS[selectedOrder.status] || []) : [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/40 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Orders</h1>
          <button onClick={() => refetch()} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4 text-foreground" strokeWidth={2} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={2} />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl border-border/50 bg-muted/40 text-sm"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                filter === key
                  ? 'bg-foreground text-background'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Orders List */}
      <div className="flex-1 px-5 pt-4 pb-24">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}
          </div>
        ) : !filteredOrders?.length ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
              <ShoppingBag className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {filter === 'all' ? 'No orders yet' : `No ${filter.replace('_', ' ')} orders`}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-2">
              {filteredOrders.map((order: any, i: number) => {
                const sc = statusConfig[order.status] || statusConfig.draft;
                return (
                  <motion.button
                    key={order.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                    className="w-full flex items-center gap-3.5 rounded-2xl border border-border/40 bg-card p-4 text-left transition-all hover:border-border/80 active:scale-[0.99]"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-foreground truncate">
                          {order.order_number || `#${order.id.slice(0, 8)}`}
                        </p>
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', sc.bg)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                          {sc.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{formatTime(order.created_at)}</span>
                        {order.customer_name && <><span>·</span><span className="truncate">{order.customer_name}</span></>}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-foreground whitespace-nowrap">{formatXAF(order.total || 0)}</p>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" strokeWidth={2} />
                  </motion.button>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Order Detail Sheet */}
      <Sheet open={!!selectedOrder} onOpenChange={open => !open && setSelectedOrder(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-[2rem] overflow-y-auto border-t-0 px-5 pb-10">
          <SheetHeader className="pb-1">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />
            <SheetTitle className="text-left">{selectedOrder?.order_number || `#${selectedOrder?.id?.slice(0, 8)}`}</SheetTitle>
          </SheetHeader>
          {selectedOrder && (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-muted/40 p-4 text-center">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Total</p>
                  <p className="text-xl font-bold mt-1">{formatXAF(selectedOrder.total || 0)}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4 text-center">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Status</p>
                  <span className={cn('mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', (statusConfig[selectedOrder.status] || statusConfig.draft).bg)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', (statusConfig[selectedOrder.status] || statusConfig.draft).dot)} />
                    {(statusConfig[selectedOrder.status] || statusConfig.draft).label}
                  </span>
                </div>
              </div>

              {(selectedOrder.customer_name || selectedOrder.customer_email || selectedOrder.customer_phone) && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Customer</h3>
                  <div className="rounded-2xl bg-muted/40 p-4 space-y-1">
                    {selectedOrder.customer_name && <p className="text-sm font-semibold">{selectedOrder.customer_name}</p>}
                    {selectedOrder.customer_email && <p className="text-xs text-muted-foreground">{selectedOrder.customer_email}</p>}
                    {selectedOrder.customer_phone && <p className="text-xs text-muted-foreground">{selectedOrder.customer_phone}</p>}
                  </div>
                </div>
              )}

              {nextStatuses.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Update Status</h3>
                  <div className="flex gap-2 flex-wrap">
                    {nextStatuses.map(ns => {
                      const sc = statusConfig[ns] || { label: ns, bg: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' };
                      return (
                        <Button
                          key={ns}
                          size="sm"
                          variant="outline"
                          className="rounded-full gap-1.5 text-xs h-9"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({
                            orderId: selectedOrder.id,
                            newStatus: ns,
                            previousStatus: selectedOrder.status,
                          })}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                          {sc.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {statusHistory && statusHistory.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Timeline</h3>
                  <div className="space-y-3 pl-3 border-l-2 border-border/50">
                    {statusHistory.map((h: any) => (
                      <div key={h.id} className="relative pl-4">
                        <div className="absolute -left-[0.4375rem] top-1 h-2.5 w-2.5 rounded-full bg-foreground border-2 border-background" />
                        <p className="text-sm font-semibold">{statusConfig[h.new_status]?.label || h.new_status}</p>
                        <p className="text-[11px] text-muted-foreground">{formatTime(h.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default BusinessOrders;
