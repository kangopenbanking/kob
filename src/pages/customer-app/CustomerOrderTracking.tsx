import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, CheckCircle2, Clock, XCircle, Truck, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const ORDER_STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pending_payment: { label: 'Pending', icon: Clock, color: 'bg-yellow-500' },
  processing: { label: 'Processing', icon: Package, color: 'bg-blue-500' },
  paid: { label: 'Paid', icon: CheckCircle2, color: 'bg-green-500' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-green-600' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-red-500' },
  refunded: { label: 'Refunded', icon: XCircle, color: 'bg-orange-500' },
};

export function CustomerOrderTracking() {
  const { user } = useCustomerAuth();
  const navigate = useNavigate();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['customer-orders', user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get user email for matching
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.email) return [];

      const { data, error } = await (supabase as any)
        .from('pos_orders')
        .select('id, order_number, status, total, created_at, updated_at, merchant_id, customer_name, customer_email')
        .eq('customer_email', authUser.email)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch merchant details
      const merchantIds = [...new Set((data || []).map((o: any) => o.merchant_id).filter(Boolean))];
      let merchants: any[] = [];
      if (merchantIds.length > 0) {
        const { data: m } = await supabase
          .from('gateway_merchants')
          .select('id, business_name')
          .in('id', merchantIds);
        merchants = m || [];
      }

      // Fetch order items
      const orderIds = (data || []).map((o: any) => o.id);
      let items: any[] = [];
      if (orderIds.length > 0) {
        const { data: i } = await (supabase as any)
          .from('pos_order_items')
          .select('id, order_id, quantity')
          .in('order_id', orderIds);
        items = i || [];
      }

      return (data || []).map((order: any) => ({
        ...order,
        merchant: merchants.find(m => m.id === order.merchant_id),
        pos_order_items: items.filter((i: any) => i.order_id === order.id),
      }));
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20">
        <Card className="p-12 text-center max-w-md mx-auto mt-20">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to track your orders</p>
          <Button onClick={() => navigate('/app/auth')}>Sign In</Button>
        </Card>
      </div>
    );
  }

  const getStatusInfo = (status: string) => {
    return ORDER_STATUS_CONFIG[status] || { label: status, icon: Clock, color: 'bg-muted' };
  };

  const getProgressPercentage = (status: string) => {
    const steps = ['pending_payment', 'paid', 'processing', 'completed'];
    const currentIndex = steps.indexOf(status);
    if (currentIndex === -1) return 0;
    return ((currentIndex + 1) / steps.length) * 100;
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Order Tracking</h1>
          <p className="text-muted-foreground">Track your orders in real-time</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-40 animate-pulse bg-muted" />
            ))}
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order: any) => {
              const statusInfo = getStatusInfo(order.status);
              const StatusIcon = statusInfo.icon;
              const progress = getProgressPercentage(order.status);
              const isCancelled = order.status === 'cancelled' || order.status === 'refunded';

              return (
                <Card key={order.id} className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                        <Store className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{order.merchant?.business_name || 'Store'}</h3>
                        <p className="text-sm text-muted-foreground">Order #{order.order_number}</p>
                      </div>
                    </div>
                    <Badge variant={isCancelled ? 'destructive' : 'default'} className="flex items-center gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </Badge>
                  </div>

                  {!isCancelled && (
                    <div className="space-y-2">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Placed</span>
                        <span>Paid</span>
                        <span>Processing</span>
                        <span>Completed</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Items</span>
                      <span className="font-medium">{order.pos_order_items?.length || 0} item(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-bold">XAF {order.total?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ordered</span>
                      <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No orders yet</p>
            <Button className="mt-4" onClick={() => navigate('/app/marketplace')}>
              Start Shopping
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
