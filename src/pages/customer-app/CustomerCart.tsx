import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, Wallet, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useAccountBalances, useCustomerAccounts } from '@/hooks/useCustomerData';

const CustomerCart: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { data: accounts = [] } = useCustomerAccounts(user?.id);
  const accountIds = accounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);

  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderComplete, setOrderComplete] = useState<any>(null);

  const walletBalance = balances.find((b: any) => b.balance_type === 'ClosingAvailable')?.amount || 0;

  useEffect(() => {
    fetchCart();
  }, [user]);

  const fetchCart = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('pos_consumer_carts')
        .select('*, pos_consumer_cart_items(*, pos_product_variants(id, name, price, pos_products(name)))')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setCart(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const items = cart?.pos_consumer_cart_items || [];
  const total = items.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0);

  const updateQuantity = async (itemId: string, newQty: number) => {
    try {
      if (newQty <= 0) {
        await supabase.from('pos_consumer_cart_items').delete().eq('id', itemId);
      } else {
        await supabase.from('pos_consumer_cart_items').update({ quantity: newQty }).eq('id', itemId);
      }
      fetchCart();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleCheckout = async () => {
    if (!cart) return;
    setCheckingOut(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-consumer-checkout', {
        body: { cart_id: cart.id },
        headers: { 'Idempotency-Key': `checkout_${cart.id}_${Date.now()}` },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error === 'insufficient_balance' ? `Insufficient balance. You need ${data.required?.toLocaleString()} XAF` : data.message || data.error);
        return;
      }
      setOrderComplete(data);
      toast.success('Payment successful!');
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="px-4 pt-16 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
        </motion.div>
        <h2 className="text-xl font-bold text-foreground">Payment Successful!</h2>
        <p className="text-sm text-muted-foreground mt-2">Order #{orderComplete.order_number}</p>
        <p className="text-lg font-bold text-primary mt-1">{orderComplete.total?.toLocaleString()} XAF</p>
        <Button onClick={() => navigate('/app/stores')} className="mt-8 rounded-xl">
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-muted">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Shopping Cart</h1>
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
        <>
          {/* Items */}
          <div className="space-y-3">
            {items.map((item: any) => {
              const variant = item.pos_product_variants;
              const productName = variant?.pos_products?.name || '';
              const variantName = variant?.name || '';
              return (
                <div key={item.id} className="bg-card border border-border/50 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {productName}{variantName ? ` - ${variantName}` : ''}
                    </p>
                    <p className="text-xs text-primary font-semibold mt-0.5">
                      {item.unit_price.toLocaleString()} XAF
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1 rounded-lg bg-muted hover:bg-muted/80"
                    >
                      {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-destructive" /> : <Minus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1 rounded-lg bg-muted hover:bg-muted/80"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-foreground w-20 text-right">
                    {(item.unit_price * item.quantity).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-6 bg-card border border-border/50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold text-foreground">{total.toLocaleString()} XAF</span>
            </div>
            <div className="border-t border-border/50 pt-3 flex justify-between text-base">
              <span className="font-bold text-foreground">Total</span>
              <span className="font-bold text-primary">{total.toLocaleString()} XAF</span>
            </div>
          </div>

          {/* Wallet balance */}
          <div className="mt-4 flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Wallet Balance:</span>
            <span className="text-xs font-bold text-foreground">{walletBalance.toLocaleString()} XAF</span>
            {walletBalance < total && (
              <span className="text-[10px] text-destructive ml-auto">Insufficient</span>
            )}
          </div>
        </>
      )}

      {/* Checkout button */}
      {items.length > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-20 left-0 right-0 max-w-lg mx-auto px-4 z-50"
        >
          <Button
            onClick={handleCheckout}
            disabled={checkingOut || walletBalance < total}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-lg"
          >
            {checkingOut ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing...</>
            ) : (
              <><Wallet className="w-4 h-4 mr-2" />Pay {total.toLocaleString()} XAF with Wallet</>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default CustomerCart;
