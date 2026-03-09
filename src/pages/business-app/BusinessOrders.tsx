import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingBag, Clock, CheckCircle2, XCircle, RefreshCw, ChevronRight, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

type OrderStatus = 'all' | 'paid' | 'pending_payment' | 'draft' | 'cancelled' | 'refunded';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  paid: { label: 'Paid', color: 'bg-[hsl(150,40%,90%)] text-[hsl(150,40%,30%)]', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  pending_payment: { label: 'Pending', color: 'bg-[hsl(40,90%,90%)] text-[hsl(40,60%,30%)]', icon: <Clock className="h-3.5 w-3.5" /> },
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
  cancelled: { label: 'Cancelled', color: 'bg-[hsl(0,60%,93%)] text-[hsl(0,60%,40%)]', icon: <XCircle className="h-3.5 w-3.5" /> },
  refunded: { label: 'Refunded', color: 'bg-[hsl(260,40%,92%)] text-[hsl(260,40%,35%)]', icon: <RefreshCw className="h-3.5 w-3.5" /> },
  processing: { label: 'Processing', color: 'bg-[hsl(210,60%,90%)] text-[hsl(210,60%,30%)]', icon: <Clock className="h-3.5 w-3.5" /> },
  completed: { label: 'Completed', color: 'bg-[hsl(150,40%,90%)] text-[hsl(150,40%,30%)]', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  shipped: { label: 'Shipped', color: 'bg-[hsl(210,50%,90%)] text-[hsl(210,50%,30%)]', icon: <ArrowRight className="h-3.5 w-3.5" /> },
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

  // Order status history
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

      // Update order status
      const { error: updateError } = await supabase
        .from('pos_orders')
        .update({ status: newStatus as any })
        .eq('id', orderId);
      if (updateError) throw updateError;

      // Record status change
      const { error: historyError } = await supabase
        .from('pos_order_status_history')
        .insert({
          order_id: orderId,
          previous_status: previousStatus,
          new_status: newStatus,
          changed_by: user?.id,
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

  const filters: { key: OrderStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'pending_payment', label: 'Pending' },
    { key: 'draft', label: 'Draft' },
  ];

  const nextStatuses = selectedOrder ? (STATUS_TRANSITIONS[selectedOrder.status] || []) : [];

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
                  <Card className="border-0 shadow-sm cursor-pointer" onClick={() => setSelectedOrder(order)}>
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

      {/* Order Detail Sheet */}
      <Sheet open={!!selectedOrder} onOpenChange={open => !open && setSelectedOrder(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedOrder?.order_number || `#${selectedOrder?.id?.slice(0, 8)}`}</SheetTitle>
          </SheetHeader>
          {selectedOrder && (
            <div className="mt-4 space-y-5">
              {/* Order Summary */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-0 bg-muted/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{formatXAF(selectedOrder.total || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-muted/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${(statusConfig[selectedOrder.status] || statusConfig.draft).color}`}>
                      {(statusConfig[selectedOrder.status] || statusConfig.draft).icon}
                      {(statusConfig[selectedOrder.status] || statusConfig.draft).label}
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Customer Info */}
              {(selectedOrder.customer_name || selectedOrder.customer_email || selectedOrder.customer_phone) && (
                <div>
                  <h3 className="text-sm font-bold mb-2">Customer</h3>
                  <Card className="border-0 bg-muted/50">
                    <CardContent className="p-3 space-y-1">
                      {selectedOrder.customer_name && <p className="text-sm font-medium">{selectedOrder.customer_name}</p>}
                      {selectedOrder.customer_email && <p className="text-xs text-muted-foreground">{selectedOrder.customer_email}</p>}
                      {selectedOrder.customer_phone && <p className="text-xs text-muted-foreground">{selectedOrder.customer_phone}</p>}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Status Actions */}
              {nextStatuses.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold mb-2">Update Status</h3>
                  <div className="flex gap-2 flex-wrap">
                    {nextStatuses.map(ns => {
                      const sc = statusConfig[ns] || { label: ns, color: 'bg-muted text-muted-foreground' };
                      return (
                        <Button
                          key={ns}
                          size="sm"
                          variant="outline"
                          className="rounded-xl gap-1.5"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({
                            orderId: selectedOrder.id,
                            newStatus: ns,
                            previousStatus: selectedOrder.status,
                          })}
                        >
                          {sc.icon} {sc.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status Timeline */}
              {statusHistory && statusHistory.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold mb-2">Status History</h3>
                  <div className="space-y-2">
                    {statusHistory.map((h: any) => (
                      <div key={h.id} className="flex items-center gap-3 text-sm">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <div className="flex-1">
                          <span className="font-medium">{statusConfig[h.new_status]?.label || h.new_status}</span>
                          {h.previous_status && (
                            <span className="text-muted-foreground"> from {statusConfig[h.previous_status]?.label || h.previous_status}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatTime(h.created_at)}</span>
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
