import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Trash2, ShoppingBag, Wallet, Loader2, CheckCircle2, XCircle, Receipt, Truck, Tag, Plus, Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useAccountBalances, useCustomerAccounts } from '@/hooks/useCustomerData';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { useQueryClient } from '@tanstack/react-query';

const CustomerCart: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useCustomerAccounts(user?.id);
  const accountIds = accounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);

  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderComplete, setOrderComplete] = useState<any>(null);
  const [orderFailed, setOrderFailed] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);

  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const SHIPPING_FLAT_FEE = 1500;

  const walletBalance = balances.find((b: any) => b.balance_type === 'ClosingAvailable')?.amount || 0;

  useEffect(() => { fetchCart(); }, [user]);

  const fetchCart = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('pos_consumer_carts')
        .select('*, pos_consumer_cart_items(*, pos_product_variants(id, name, price, pos_products(name, pos_product_images(url))))')
        .eq('user_id', user.id).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      setCart(data);
      if (data) {
        const d = data as any;
        setRecipientName(d.shipping_recipient_name || '');
        setPhone(d.shipping_phone || '');
        setAddressLine(d.shipping_address_line || '');
        setCity(d.shipping_city || '');
        setRegion(d.shipping_region || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const items = cart?.pos_consumer_cart_items || [];
  const subtotal = items.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0);
  const shippingFee = items.length > 0 && addressLine ? SHIPPING_FLAT_FEE : 0;
  const taxes = 0;
  const total = subtotal + taxes + shippingFee;
  const shippingComplete = !!(recipientName && phone && addressLine && city);

  const updateQuantity = async (itemId: string, newQty: number) => {
    try {
      if (newQty <= 0) {
        await supabase.functions.invoke('pos-consumer-cart', { body: { action: 'remove', item_id: itemId } });
      } else {
        await supabase.functions.invoke('pos-consumer-cart', { body: { action: 'update_quantity', item_id: itemId, quantity: newQty } });
      }
      fetchCart();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Could not update cart.'));
    }
  };

  const saveShipping = async (): Promise<boolean> => {
    if (!cart) return false;
    if (!shippingComplete) { toast.error('Complete the delivery address before paying.'); return false; }
    setSavingShipping(true);
    try {
      const { error } = await supabase.functions.invoke('pos-consumer-cart', {
        body: {
          action: 'set_shipping', cart_id: cart.id,
          shipping: { recipient_name: recipientName, phone, address_line: addressLine, city, region, country: 'CM', shipping_fee: SHIPPING_FLAT_FEE },
        },
      });
      if (error) throw error;
      return true;
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Could not save delivery address.'));
      return false;
    } finally {
      setSavingShipping(false);
    }
  };

  const startCheckout = async () => {
    const ok = await saveShipping();
    if (ok) setShowPin(true);
  };

  const handleCheckout = async () => {
    if (!cart) return;
    setCheckingOut(true); setOrderFailed(false);
    try {
      const idempotencyKey = `checkout_${cart.id}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('pos-consumer-checkout', {
        body: { cart_id: cart.id, idempotency_key: idempotencyKey },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error === 'insufficient_balance') {
          toast.error(`Insufficient wallet balance.`);
        } else {
          toast.error(data.message || data.error);
        }
        setOrderFailed(true);
        return;
      }
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['customer-accounts'] }),
        queryClient.refetchQueries({ queryKey: ['account-balances'] }),
      ]);
      setOrderComplete(data);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Checkout could not be completed.'));
      setOrderFailed(true);
    } finally {
      setCheckingOut(false);
    }
  };

  /* ─── Success ─── */
  if (orderComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 bg-gradient-to-b from-background to-emerald-50/30">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}
          className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30"
        >
          <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
        </motion.div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Payment successful</h2>
        <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">
          {orderComplete.total?.toLocaleString()} {orderComplete.currency || 'XAF'} paid · Order #{orderComplete.order_number}
        </p>
        <div className="w-full max-w-xs mt-8 space-y-3">
          <Button onClick={() => navigate('/app/orders') className="w-full h-12 rounded-2xl font-semibold">
            Track order
          </Button>
          <Button variant="outline" onClick={() => { setOrderComplete(null); navigate('/app/stores'); }} className="w-full h-12 rounded-2xl font-semibold">
            Continue shopping
          </Button>
        </div>
      </div>
    );
  }

  /* ─── Failed ─── */
  if (orderFailed && !checkingOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}
          className="w-24 h-24 rounded-full bg-rose-500/15 flex items-center justify-center mb-6"
        >
          <XCircle className="w-12 h-12 text-rose-500" strokeWidth={2} />
        </motion.div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Payment failed</h2>
        <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">This payment was declined. Please try again.</p>
        <div className="w-full max-w-xs mt-8 space-y-3">
          <Button onClick={() => { setOrderFailed(false); handleCheckout(); }} className="w-full h-12 rounded-2xl font-semibold">
            Try again
          </Button>
          <Button variant="outline" onClick={() => { setOrderFailed(false); navigate('/app/stores'); }} className="w-full h-12 rounded-2xl font-semibold">
            Exit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32 bg-gradient-to-b from-muted/30 via-background to-background min-h-screen">
      {/* ─── Header ─── */}
      <div className="px-5 pt-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-center">
            <ArrowLeft className="w-[18px] h-[18px] text-foreground" />
          </button>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Checkout</p>
            <h1 className="text-[22px] leading-tight font-bold text-foreground tracking-tight">Your cart</h1>
          </div>
        </div>
        {items.length > 0 && (
          <span className="text-xs font-semibold text-muted-foreground bg-card border border-border/60 rounded-full px-3 py-1">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 px-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <ShoppingBag className="w-7 h-7 text-muted-foreground/60" />
          </div>
          <p className="text-base font-semibold text-foreground">Your cart is empty</p>
          <p className="text-xs text-muted-foreground mt-1">Find something special in the marketplace</p>
          <Button onClick={() => navigate('/app/stores') className="mt-6 h-11 px-6 rounded-2xl font-semibold">
            Browse stores
          </Button>
        </div>
      ) : (
        <div className="px-5 mt-5 space-y-5">
          {/* ─── Items ─── */}
          <div>
            <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider mb-3">Items</h2>
            <div className="bg-card rounded-3xl ring-1 ring-border/40 divide-y divide-border/40 overflow-hidden">
              {items.map((item: any, idx: number) => {
                const variant = item.pos_product_variants;
                const productName = variant?.pos_products?.name || '';
                const variantName = variant?.name || '';
                const image = variant?.pos_products?.pos_product_images?.[0]?.url;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="p-3.5 flex items-center gap-3"
                  >
                    {image ? (
                      <img src={image} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-5 h-5 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{productName}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{variantName}</p>
                      <p className="text-[14px] font-bold text-foreground mt-1.5">
                        {item.unit_price.toLocaleString()} <span className="text-[10px] text-muted-foreground font-medium">XAF</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, 0)}
                        className="text-muted-foreground/70 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center gap-1 bg-muted rounded-full p-0.5">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-7 w-7 rounded-full bg-card flex items-center justify-center shadow-sm">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-foreground w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-7 w-7 rounded-full bg-card flex items-center justify-center shadow-sm">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ─── Delivery address ─── */}
          <div>
            <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-primary" />Delivery address
            </h2>
            <div className="bg-card rounded-3xl ring-1 ring-border/40 p-4 space-y-2.5">
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient name" className="h-11 rounded-xl bg-muted/40 border-0" />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (e.g. +237…)" className="h-11 rounded-xl bg-muted/40 border-0" />
              <Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="Street address" className="h-11 rounded-xl bg-muted/40 border-0" />
              <div className="grid grid-cols-2 gap-2.5">
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="h-11 rounded-xl bg-muted/40 border-0" />
                <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" className="h-11 rounded-xl bg-muted/40 border-0" />
              </div>
            </div>
          </div>

          {/* ─── Order summary ─── */}
          <div>
            <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-primary" />Order summary
            </h2>
            <div className="bg-card rounded-3xl ring-1 ring-border/40 p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground">{subtotal.toLocaleString()} XAF</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span className="font-semibold text-foreground">{shippingFee.toLocaleString()} XAF</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxes</span>
                <span className="font-semibold text-foreground">{taxes.toLocaleString()} XAF</span>
              </div>
              <div className="border-t border-border/50 pt-3 flex justify-between items-baseline">
                <span className="text-[15px] font-bold text-foreground">Total</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[20px] font-bold text-foreground tracking-tight">{total.toLocaleString()}</span>
                  <span className="text-[11px] text-muted-foreground font-medium">XAF</span>
                </div>
              </div>
            </div>

            {/* Wallet pill */}
            <div className="mt-3 flex items-center gap-2.5 p-3.5 bg-card rounded-2xl ring-1 ring-border/40">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-muted-foreground font-medium">Wallet balance</p>
                <p className="text-sm font-bold text-foreground">{walletBalance.toLocaleString()} XAF</p>
              </div>
              {walletBalance < total && (
                <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Low</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Sticky pay bar ─── */}
      {items.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-20 left-0 right-0 max-w-lg mx-auto px-4 z-50"
        >
          <Button
            onClick={startCheckout}
            disabled={checkingOut || savingShipping || walletBalance < total || !shippingComplete}
            className="w-full h-13 py-3.5 rounded-2xl font-semibold shadow-2xl bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            {checkingOut || savingShipping ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</>
            ) : !shippingComplete ? (
              <><Truck className="w-4 h-4 mr-2" />Add delivery address</>
            ) : walletBalance < total ? (
              <>Insufficient balance</>
            ) : (
              <><Wallet className="w-4 h-4 mr-2" />Pay {total.toLocaleString()} XAF</>
            )}
          </Button>
        </motion.div>
      )}

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handleCheckout} />
    </div>
  );
};

export default CustomerCart;
