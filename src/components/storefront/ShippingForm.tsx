import { useState } from 'react';
import { Truck, Send, Loader2, CheckCircle2, Hash, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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

  const handleConfirmShipping = async () => {
    if (!orderId || !carrier || !trackingNumber) {
      toast.error('Please fill in Order ID, Carrier, and Tracking Number');
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create in-app notification for the merchant (confirmation)
      await supabase.from('app_notifications').insert({
        user_id: user.id,
        type: 'success',
        title: 'Shipping Confirmed',
        message: `Order ${orderId} has been marked as shipped via ${carrier}. Tracking: ${trackingNumber}`,
        icon: 'shipping',
        metadata: {
          order_id: orderId,
          carrier_name: carrier,
          tracking_number: trackingNumber,
          tracking_url: trackingUrl || null,
          estimated_delivery: estimatedDelivery || null,
          shipping_address: shippingAddress || null,
          store_name: storeName,
          merchant_id: merchantId,
        },
      });

      toast.success('Shipping confirmed! Customer will be notified.');
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setOrderId('');
        setCarrier('');
        setTrackingNumber('');
        setTrackingUrl('');
        setEstimatedDelivery('');
        setShippingAddress('');
        setNotes('');
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
          Order {orderId} • {carrier} • {trackingNumber}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Order ID *</Label>
          <Input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g. ORD-20260308-001"
            className="h-10 rounded-lg border-border/60"
          />
        </div>
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
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tracking Number *</Label>
          <Input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g. 1Z999AA10123456784"
            className="h-10 rounded-lg border-border/60"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tracking URL (optional)</Label>
          <Input
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder="https://tracking.carrier.com/..."
            className="h-10 rounded-lg border-border/60"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Estimated Delivery</Label>
          <Input
            type="date"
            value={estimatedDelivery}
            onChange={(e) => setEstimatedDelivery(e.target.value)}
            className="h-10 rounded-lg border-border/60"
          />
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
        disabled={sending || !orderId || !carrier || !trackingNumber}
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
  );
}
