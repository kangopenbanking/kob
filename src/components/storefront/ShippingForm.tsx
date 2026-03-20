import { useState, useEffect } from 'react';
import { Truck, Send, Loader2, CheckCircle2, Search, Package, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CARRIERS = [
  'DHL Express',
  'EMS Cameroon',
  'CamPost',
  'FedEx',
  'Aramex',
  'UPS',
  'Custom / Local',
];

interface ShippingFormProps {
  storeName: string;
  currency: string;
  merchantId: string | null;
}

interface OrderLookup {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  currency: string;
  customer_id: string | null;
}

interface ShippingRecord {
  order_id: string;
  order_number: string;
  carrier: string;
  tracking_number: string;
  shipped_at: string;
  status: string;
}

export function ShippingForm({ storeName, currency, merchantId }: ShippingFormProps) {
  const [orderId, setOrderId] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Order validation
  const [validating, setValidating] = useState(false);
  const [orderLookup, setOrderLookup] = useState<OrderLookup | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Shipping history
  const [history, setHistory] = useState<ShippingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (merchantId) loadHistory();
  }, [merchantId]);

  const loadHistory = async () => {
    if (!merchantId) return;
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('pos_order_status_history')
        .select('order_id, new_status, metadata, created_at')
        .eq('new_status', 'shipped' as any)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setHistory(data.map((h: any) => ({
          order_id: h.order_id,
          order_number: h.metadata?.order_number || h.order_id?.slice(0, 8),
          carrier: h.metadata?.carrier || 'Unknown',
          tracking_number: h.metadata?.tracking_number || '',
          shipped_at: h.created_at,
          status: 'shipped',
        })));
      }
    } catch (err) { console.error(err); }
    finally { setLoadingHistory(false); }
  };

  const validateOrder = async () => {
    if (!orderId.trim() || !merchantId) return;
    setValidating(true);
    setOrderLookup(null);
    setOrderError(null);
    try {
      // Try by order_number first, then by id
      let query = supabase
        .from('pos_orders')
        .select('id, order_number, status, total_amount, currency, customer_id')
        .eq('merchant_id', merchantId);

      const { data: byNumber } = await query.eq('order_number', orderId.trim()).maybeSingle();
      if (byNumber) {
        if ((byNumber as any).status === 'shipped') {
          setOrderError('This order has already been shipped.');
        } else {
          setOrderLookup(byNumber as any);
        }
        setValidating(false);
        return;
      }

      // Try by UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(orderId.trim())) {
        const { data: byId } = await supabase
          .from('pos_orders')
          .select('id, order_number, status, total_amount, currency, customer_id')
          .eq('merchant_id', merchantId)
          .eq('id', orderId.trim())
          .maybeSingle();
        if (byId) {
          if ((byId as any).status === 'shipped') {
            setOrderError('This order has already been shipped.');
          } else {
            setOrderLookup(byId as any);
          }
          setValidating(false);
          return;
        }
      }

      setOrderError('Order not found. Please check the Order ID or number.');
    } catch (err) { setOrderError('Failed to validate order'); }
    finally { setValidating(false); }
  };

  const handleConfirmShipping = async () => {
    if (!carrier || !trackingNumber) {
      toast.error('Please fill in Carrier and Tracking Number');
      return;
    }
    if (!orderLookup && !orderId) {
      toast.error('Please enter and validate an Order ID');
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const targetOrderId = orderLookup?.id || orderId;

      // 1. Update order status to shipped
      if (orderLookup) {
        await (supabase.from('pos_orders') as any)
          .update({ status: 'shipped', updated_at: new Date().toISOString() })
          .eq('id', orderLookup.id);

        // 2. Record in order status history
        await supabase.from('pos_order_status_history').insert({
          order_id: orderLookup.id,
          previous_status: orderLookup.status as any,
          new_status: 'shipped' as any,
          changed_by: user.id,
          metadata: {
            carrier_name: carrier,
            tracking_number: trackingNumber,
            tracking_url: trackingUrl || null,
            estimated_delivery: estimatedDelivery || null,
            shipping_address: shippingAddress || null,
            order_number: orderLookup.order_number,
          },
        } as any);

        // 3. Notify customer if they exist
        if (orderLookup.customer_id) {
          await supabase.from('app_notifications').insert({
            user_id: orderLookup.customer_id,
            type: 'success',
            title: 'Your Order Has Shipped!',
            message: `Order ${orderLookup.order_number} from ${storeName} has been shipped via ${carrier}. Tracking: ${trackingNumber}`,
            icon: 'shipping',
            metadata: {
              order_id: orderLookup.id,
              order_number: orderLookup.order_number,
              carrier_name: carrier,
              tracking_number: trackingNumber,
              tracking_url: trackingUrl || null,
              estimated_delivery: estimatedDelivery || null,
              store_name: storeName,
            },
          });
        }
      }

      // 4. Notify merchant (confirmation)
      await supabase.from('app_notifications').insert({
        user_id: user.id,
        type: 'success',
        title: 'Shipping Confirmed',
        message: `Order ${orderLookup?.order_number || orderId} has been marked as shipped via ${carrier}. Tracking: ${trackingNumber}`,
        icon: 'shipping',
        metadata: {
          order_id: targetOrderId,
          carrier_name: carrier,
          tracking_number: trackingNumber,
          tracking_url: trackingUrl || null,
          estimated_delivery: estimatedDelivery || null,
          shipping_address: shippingAddress || null,
          store_name: storeName,
          merchant_id: merchantId,
        },
      });

      toast.success('Shipping confirmed! Customer has been notified.');
      setSent(true);
      loadHistory();
      setTimeout(() => {
        setSent(false);
        setOrderId('');
        setCarrier('');
        setTrackingNumber('');
        setTrackingUrl('');
        setEstimatedDelivery('');
        setShippingAddress('');
        setNotes('');
        setOrderLookup(null);
        setOrderError(null);
      }, 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm shipping');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-10">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-emerald-500" strokeWidth={1.5} />
        </div>
        <p className="text-base font-bold text-foreground">Shipping Confirmed!</p>
        <p className="text-xs text-muted-foreground mt-1">
          Order {orderLookup?.order_number || orderId} • {carrier} • {trackingNumber}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shipping Form */}
      <div className="space-y-4">
        {/* Order ID with validation */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Order ID or Number *</Label>
          <div className="flex gap-2">
            <Input
              value={orderId}
              onChange={(e) => { setOrderId(e.target.value); setOrderLookup(null); setOrderError(null); }}
              placeholder="e.g. ORD-20260308-001 or UUID"
              className="h-10 rounded-lg border-border/60 flex-1"
              onBlur={validateOrder}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-lg"
              onClick={validateOrder}
              disabled={validating || !orderId.trim()}
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          {orderLookup && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span className="text-foreground font-medium">{orderLookup.order_number}</span>
              <Badge variant="outline" className="text-[10px]">{orderLookup.status}</Badge>
              <span className="text-muted-foreground ml-auto">{Number(orderLookup.total_amount).toLocaleString()} {orderLookup.currency}</span>
            </div>
          )}
          {orderError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
              <span className="text-destructive">{orderError}</span>
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Carrier *</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger className="h-10 rounded-lg border-border/60">
                <SelectValue placeholder="Select carrier" />
              </SelectTrigger>
              <SelectContent>
                {CARRIERS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tracking Number *</Label>
            <Input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. 1Z999AA10123456784"
              className="h-10 rounded-lg border-border/60"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tracking URL (optional)</Label>
            <Input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://tracking.carrier.com/..."
              className="h-10 rounded-lg border-border/60"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Estimated Delivery</Label>
            <Input
              type="date"
              value={estimatedDelivery}
              onChange={(e) => setEstimatedDelivery(e.target.value)}
              className="h-10 rounded-lg border-border/60"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Shipping Address</Label>
          <Input
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            placeholder="Customer's delivery address"
            className="h-10 rounded-lg border-border/60"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special delivery instructions or notes..."
            rows={2}
            className="rounded-lg border-border/60 resize-none text-xs"
          />
        </div>

        <Button
          onClick={handleConfirmShipping}
          disabled={sending || !carrier || !trackingNumber || (!orderLookup && !orderId)}
          className="w-full gap-2 rounded-lg h-10 text-xs font-semibold bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" strokeWidth={1.5} />
          )}
          Confirm Shipping & Notify Customer
        </Button>
      </div>

      {/* Shipping History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            Recent Shipments
          </h3>
          <Badge variant="secondary" className="text-[10px]">{history.length}</Badge>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 border rounded-xl bg-muted/20">
            <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground">No shipments yet. Confirm your first order above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{h.order_number}</p>
                    <p className="text-[10px] text-muted-foreground">{h.carrier} • {h.tracking_number}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge variant="outline" className="text-[10px] text-emerald-600">Shipped</Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(h.shipped_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
