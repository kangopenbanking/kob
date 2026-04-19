import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, Wallet, Loader2, CheckCircle2, XCircle, Receipt, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  // Shipping form state — synced from cart on load
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const SHIPPING_FLAT_FEE = 1500; // XAF — standard delivery flat rate

  const walletBalance = balances.find((b: any) => b.balance_type === 'ClosingAvailable')?.amount || 0;

  useEffect(() => {
    fetchCart();
  }, [user]);

  const fetchCart = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('pos_consumer_carts')
        .select('*, pos_consumer_cart_items(*, pos_product_variants(id, name, price, pos_products(name, pos_product_images(image_url))))')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
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
        await supabase.functions.invoke('pos-consumer-cart', {
          body: { action: 'remove', item_id: itemId },
        });
      } else {
        await supabase.functions.invoke('pos-consumer-cart', {
          body: { action: 'update_quantity', item_id: itemId, quantity: newQty },
        });
      }
      fetchCart();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Could not update cart. Please try again.'));
    }
  };

  const saveShipping = async (): Promise<boolean> => {
    if (!cart) return false;
    if (!shippingComplete) {
      toast.error('Please complete the delivery address before paying.');
      return false;
    }
    setSavingShipping(true);
    try {
      const { error } = await supabase.functions.invoke('pos-consumer-cart', {
        body: {
          action: 'set_shipping',
          cart_id: cart.id,
          shipping: {
            recipient_name: recipientName,
            phone,
            address_line: addressLine,
            city,
            region,
            country: 'CM',
            shipping_fee: SHIPPING_FLAT_FEE,
          },
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

    if (!cart) return;
    setCheckingOut(true);
    setOrderFailed(false);
    try {
      const idempotencyKey = `checkout_${cart.id}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('pos-consumer-checkout', {
        body: { cart_id: cart.id, idempotency_key: idempotencyKey },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error === 'insufficient_balance') {
          toast.error(`Insufficient wallet balance. You need ${data.required?.toLocaleString()} XAF but have ${walletBalance.toLocaleString()} XAF`);
          setOrderFailed(true);
        } else {
          toast.error(data.message || data.error);
          setOrderFailed(true);
        }
        return;
      }
      // Sync balances after successful payment
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['customer-accounts'] }),
        queryClient.refetchQueries({ queryKey: ['account-balances'] }),
      ]);
      setOrderComplete(data);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Checkout could not be completed. Please try again.'));
      setOrderFailed(true);
    } finally {
      setCheckingOut(false);
    }
  };

  /* ─── Payment Success Screen ─── */
  if (orderComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="w-20 h-20 rounded-full bg-[hsl(150,60%,50%)] flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="w-10 h-10 text-[hsl(0,0%,10%)]" strokeWidth={2.5} />
        </motion.div>
        <h2 className="text-2xl font-bold text-foreground">Payment successful</h2>
        <p className="text-sm text-muted-foreground mt-2">
          A payment of {orderComplete.total?.toLocaleString()} {orderComplete.currency || 'XAF'} was successfully made.
        </p>
        <p className="text-xs text-muted-foreground mt-1">Order #{orderComplete.order_number}</p>

        <div className="w-full max-w-xs mt-8 space-y-3">
          <Button
            onClick={() => { setOrderComplete(null); navigate('/app/stores'); }}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            New order
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.success('Receipt will be sent to your email')}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Email receipt
          </Button>
        </div>
      </div>
    );
  }

  /* ─── Payment Failed Screen ─── */
  if (orderFailed && !checkingOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6"
        >
          <XCircle className="w-10 h-10 text-primary" strokeWidth={2} />
        </motion.div>
        <h2 className="text-2xl font-bold text-foreground">Payment failed</h2>
        <p className="text-sm text-muted-foreground mt-2">Unfortunately, this payment has been declined.</p>

        <div className="w-full max-w-xs mt-8 space-y-3">
          <Button
            onClick={() => { setOrderFailed(false); handleCheckout(); }}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            Try another payment method
          </Button>
          <Button
            variant="outline"
            onClick={() => { setOrderFailed(false); navigate('/app/stores'); }}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            Exit order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-muted">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Cart</h1>
        </div>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">{items.length} items</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Your cart is empty</p>
          <Button variant="ghost" onClick={() => navigate('/app/stores')} className="mt-4">
            Browse Stores
          </Button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Items list */}
          <div className="flex-1 space-y-2.5">
            {items.map((item: any, idx: number) => {
              const variant = item.pos_product_variants;
              const productName = variant?.pos_products?.name || '';
              const variantName = variant?.name || '';
              const image = variant?.pos_products?.pos_product_images?.[0]?.image_url;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="bg-card border border-border/50 rounded-xl p-3 flex items-center gap-3"
                >
                  {/* Product image */}
                  {image ? (
                    <img src={image} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border-l-2 border-primary" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border-l-2 border-primary">
                      <ShoppingBag className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{productName}</p>
                    <p className="text-[10px] text-muted-foreground">{variantName}</p>
                    <p className="text-xs font-bold text-primary mt-0.5">
                      {item.unit_price.toLocaleString()} XAF
                    </p>
                  </div>
                  {/* Quantity control */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                      className="h-7 w-12 text-xs rounded-lg border border-border bg-background text-center focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => updateQuantity(item.id, 0)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Summary panel */}
          <div className="lg:w-72">
            <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground">{subtotal.toLocaleString()} XAF</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxes</span>
                <span className="font-semibold text-foreground">{taxes.toLocaleString()} XAF</span>
              </div>
              <div className="border-t border-border/50 pt-3 flex justify-between">
                <span className="text-base font-bold text-foreground">Total</span>
                <span className="text-base font-bold text-primary">{total.toLocaleString()} XAF</span>
              </div>
            </div>

            {/* Wallet balance */}
            <div className="mt-3 flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Wallet Balance:</span>
              <span className="text-xs font-bold text-foreground">{walletBalance.toLocaleString()} XAF</span>
              {walletBalance < total && (
                <span className="text-[10px] text-destructive ml-auto font-medium">Insufficient</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout button */}
      {items.length > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-20 left-0 right-0 max-w-lg mx-auto px-4 z-50"
        >
          <Button
            onClick={() => setShowPin(true)}
            disabled={checkingOut || walletBalance < total}
            className="w-full h-12 rounded-2xl font-semibold shadow-lg"
          >
            {checkingOut ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing...</>
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
