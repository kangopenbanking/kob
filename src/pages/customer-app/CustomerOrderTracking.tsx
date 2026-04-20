import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, CheckCircle2, Clock, XCircle, Store, ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

const ORDER_STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  pending_payment: { label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
  processing: { label: 'Processing', icon: Package, color: 'text-blue-600', bg: 'bg-blue-100' },
  paid: { label: 'Paid', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  completed: { label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-100' },
  refunded: { label: 'Refunded', icon: XCircle, color: 'text-orange-600', bg: 'bg-orange-100' },
};

export function CustomerOrderTracking() {
  const { user } = useCustomerAuth();
  const navigate = useNavigate();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['customer-orders', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.email) return [];
      const { data: byEmail, error: e1 } = await (supabase as any)
        .from('pos_orders')
        .select('id, order_number, status, total, created_at, updated_at, merchant_id, customer_name, customer_email, metadata_json')
        .eq('customer_email', authUser.email).order('created_at', { ascending: false }).limit(50);
      if (e1) throw e1;
      const { data: byUserId } = await (supabase as any)
        .from('pos_orders')
        .select('id, order_number, status, total, created_at, updated_at, merchant_id, customer_name, customer_email, metadata_json')
        .filter('metadata_json->>consumer_user_id', 'eq', authUser.id).order('created_at', { ascending: false }).limit(50);
      const allOrders = [...(byEmail || [])];
      const existingIds = new Set(allOrders.map((o: any) => o.id));
      for (const o of (byUserId || [])) if (!existingIds.has(o.id)) { allOrders.push(o); existingIds.add(o.id); }
      allOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const merchantIds = [...new Set(allOrders.map((o: any) => o.merchant_id).filter(Boolean))] as string[];
      let merchants: any[] = [];
      if (merchantIds.length > 0) {
        const { data: m } = await supabase.from('gateway_merchants').select('id, business_name').in('id', merchantIds);
        merchants = m || [];
      }
      const orderIds = allOrders.map((o: any) => o.id);
      let items: any[] = [];
      if (orderIds.length > 0) {
        const { data: i } = await (supabase as any).from('pos_order_items').select('id, order_id, quantity').in('order_id', orderIds);
        items = i || [];
      }
      return allOrders.map((order: any) => ({
        ...order,
        merchant: merchants.find(m => m.id === order.merchant_id),
        pos_order_items: items.filter((i: any) => i.order_id === order.id),
      }));
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background flex items-center justify-center px-6">
        <div className="bg-card rounded-3xl p-10 text-center max-w-sm w-full ring-1 ring-border/40">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-bold mb-1">Sign in required</h2>
          <p className="text-sm text-muted-foreground mb-5">Track your orders in real-time</p>
          <Button onClick={() => navigate('/app/auth')} className="w-full h-11 rounded-2xl font-semibold">Sign In')</Button>
        </div>
      </div>
    );
  }

  const getStatusInfo = (status: string) => ORDER_STATUS_CONFIG[status] || { label: status, icon: Clock, color: 'text-foreground', bg: 'bg-muted' };
  const getProgress = (status: string) => {
    const steps = ['pending_payment', 'paid', 'processing', 'completed'];
    const idx = steps.indexOf(status);
    return idx === -1 ? 0 : ((idx + 1) / steps.length) * 100;
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="px-5 pt-7">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-center">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Activity</p>
            <h1 className="text-[22px] font-bold tracking-tight leading-tight">Your orders</h1>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-3xl bg-card animate-pulse" />)}
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="space-y-3">
            {orders.map((order: any, i: number) => {
              const s = getStatusInfo(order.status);
              const StatusIcon = s.icon;
              const progress = getProgress(order.status);
              const isCancelled = order.status === 'cancelled' || order.status === 'refunded';

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-3xl p-4 ring-1 ring-border/40 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground truncate">{order.merchant?.business_name || 'Store'}</p>
                        <p className="text-[11px] text-muted-foreground">#{order.order_number}</p>
                      </div>
                    </div>
                    <Badge className={`${s.bg} ${s.color} border-0 hover:${s.bg} flex items-center gap-1 rounded-full font-semibold text-[10px] px-2.5 py-1`}>
                      <StatusIcon className="h-2.5 w-2.5" />{s.label}
                    </Badge>
                  </div>

                  {!isCancelled && (
                    <div className="mb-3">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }}
                          className="h-full bg-foreground rounded-full"
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wider">
                        <span>Placed</span><span>Paid</span><span>Processing</span><span>Done</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border/40">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total</p>
                      <p className="text-base font-bold text-foreground">{order.total?.toLocaleString()} <span className="text-[10px] text-muted-foreground font-medium">XAF</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{order.pos_order_items?.length || 0} items</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-3xl p-12 text-center ring-1 ring-border/40 mt-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Package className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-semibold text-foreground">No orders yet</p>
            <p className="text-xs text-muted-foreground mt-1">Your purchases will appear here</p>
            <Button onClick={() => navigate('/app/stores')} className="mt-5 h-11 px-6 rounded-2xl font-semibold">Start shopping')</Button>
          </div>
        )}
      </div>
    </div>
  );
}
