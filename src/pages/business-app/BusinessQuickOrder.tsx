import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, Plus, Minus, ShoppingBag, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CartItem {
  product_id: string;
  variant_id: string;
  name: string;
  price: number;
  qty: number;
}

const BusinessQuickOrder: React.FC = () => {
  const { merchantId } = useMerchantContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const { data: products, isLoading } = useQuery({
    queryKey: ['biz-quick-products', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data } = await supabase.from('pos_products').select('id, name, pos_product_variants(id, name, price)').eq('merchant_id', merchantId).eq('status', 'active').order('name');
      return data || [];
    },
    enabled: !!merchantId,
  });

  const filtered = products?.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()));

  const addToCart = (product: any, variant: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.variant_id === variant.id);
      if (existing) return prev.map(i => i.variant_id === variant.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product_id: product.id, variant_id: variant.id, name: `${product.name}${variant.name !== 'Default' ? ` - ${variant.name}` : ''}`, price: variant.price, qty: 1 }];
    });
  };

  const updateQty = (variantId: string, delta: number) => {
    setCart(prev => prev.map(i => i.variant_id === variantId ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  };

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const formatXAF = (n: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const { data: order, error } = await supabase.from('pos_orders').insert({
        merchant_id: merchantId!, order_number: orderNumber, status: 'pending_payment' as any,
        subtotal: total, total, tax_total: 0, discount_total: 0,
        metadata_json: { items: cart.map(i => ({ product_id: i.product_id, variant_id: i.variant_id, name: i.name, price: i.price, quantity: i.qty })) },
        customer_name: customerName || null, customer_phone: customerPhone || null, channel: 'pos',
      }).select('id').single();
      if (error) throw error;
      return order;
    },
    onSuccess: () => { toast.success('Order created!'); navigate('/biz/orders'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      {/* Header */}
      <header className="pt-4 md:pt-0 mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/biz/orders')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 hover:bg-muted transition-colors shrink-0">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">New Order</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {cartCount > 0 ? `${cartCount} item${cartCount !== 1 ? 's' : ''} · ${formatXAF(total)}` : 'Select products to create an order'}
            </p>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
        <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl border-border/50 bg-muted/40 text-sm" />
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 mb-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : !filtered?.length ? (
        <div className="flex flex-col items-center py-12 mb-4">
          <Package className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 mb-4 max-h-[35vh] overflow-y-auto">
          {filtered.map((p: any) =>
            (p.pos_product_variants || []).map((v: any) => {
              const inCart = cart.find(c => c.variant_id === v.id);
              return (
                <motion.button
                  key={v.id}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    'relative rounded-2xl border bg-card p-3 text-left transition-all',
                    inCart ? 'border-foreground ring-1 ring-foreground/20' : 'border-border/40 hover:border-border/80'
                  )}
                  onClick={() => addToCart(p, v)}
                >
                  {inCart && (
                    <Badge className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]">
                      {inCart.qty}
                    </Badge>
                  )}
                  <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                  {v.name !== 'Default' && <p className="text-[10px] text-muted-foreground">{v.name}</p>}
                  <p className="text-xs font-bold text-foreground mt-1.5">{formatXAF(v.price)}</p>
                </motion.button>
              );
            })
          )}
        </div>
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <>
          <div className="space-y-2 mb-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Cart ({cart.length})</h3>
            {cart.map(item => (
              <div key={item.variant_id} className="flex items-center justify-between rounded-2xl border border-border/40 bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground truncate">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatXAF(item.price)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="icon" variant="outline" className="h-7 w-7 rounded-lg border-border/50" onClick={() => updateQty(item.variant_id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7 rounded-lg border-border/50" onClick={() => updateQty(item.variant_id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Customer Info */}
          <div className="space-y-3 mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Customer (optional)</h3>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="rounded-xl" />
              <Input placeholder="Phone number" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="rounded-xl" />
            </div>
          </div>

          {/* Create Button */}
          <Button
            className="w-full rounded-xl h-12 text-sm font-bold gap-2 bg-foreground text-background hover:bg-foreground/90"
            onClick={() => createOrderMutation.mutate()}
            disabled={createOrderMutation.isPending}
          >
            <ShoppingBag className="h-5 w-5" />
            Create Order · {formatXAF(total)}
          </Button>
        </>
      )}
    </div>
  );
};

export default BusinessQuickOrder;
