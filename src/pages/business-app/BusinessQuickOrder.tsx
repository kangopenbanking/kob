import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Minus, ShoppingBag, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface CartItem {
  product_id: string;
  variant_id: string;
  name: string;
  price: number;
  qty: number;
}

const BusinessQuickOrder: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const { data: products } = useQuery({
    queryKey: ['biz-quick-products', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data } = await supabase
        .from('pos_products')
        .select('id, name, pos_product_variants(id, name, price)')
        .eq('merchant_id', merchantId)
        .eq('status', 'active')
        .order('name');
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

  const formatXAF = (n: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const { data: order, error } = await supabase.from('pos_orders').insert({
        merchant_id: merchantId!,
        order_number: orderNumber,
        status: 'pending_payment' as any,
        subtotal: total,
        total,
        tax_total: 0,
        discount_total: 0,
        metadata_json: { items: cart.map(i => ({ product_id: i.product_id, variant_id: i.variant_id, name: i.name, price: i.price, quantity: i.qty })) },
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        channel: 'pos',
      }).select('id').single();
      if (error) throw error;
      return order;
    },
    onSuccess: () => {
      toast.success('Order created!');
      const basePath = merchantId ? `/biz/${merchantId}` : '/biz';
      navigate(`${basePath}/orders`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const basePath = merchantId ? `/biz/${merchantId}` : '/biz';

  return (
    <div className="flex min-h-screen flex-col bg-background p-4">
      <header className="mb-4 flex items-center gap-3">
        <Button size="icon" variant="ghost" className="rounded-xl" onClick={() => navigate(`${basePath}/orders`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">New Order</h1>
      </header>

      {/* Product Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4 max-h-[35vh] overflow-y-auto">
        {filtered?.map((p: any) =>
          (p.pos_product_variants || []).map((v: any) => (
            <motion.div key={v.id} whileTap={{ scale: 0.97 }}>
              <Card className="border-0 shadow-sm cursor-pointer" onClick={() => addToCart(p, v)}>
                <CardContent className="p-3">
                  <p className="text-xs font-bold truncate">{p.name}</p>
                  {v.name !== 'Default' && <p className="text-[10px] text-muted-foreground">{v.name}</p>}
                  <p className="text-xs font-bold text-primary mt-1">{formatXAF(v.price)}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="space-y-3 mb-4">
          <h3 className="text-sm font-bold">Cart ({cart.length})</h3>
          {cart.map(item => (
            <div key={item.variant_id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{formatXAF(item.price)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(item.variant_id, -1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(item.variant_id, 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Info */}
      {cart.length > 0 && (
        <div className="space-y-3 mb-4">
          <h3 className="text-sm font-bold">Customer (optional)</h3>
          <Input placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="rounded-xl" />
          <Input placeholder="Phone number" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="rounded-xl" />
        </div>
      )}

      {/* Create Order */}
      {cart.length > 0 && (
        <Button
          className="w-full rounded-2xl h-12 text-base font-bold gap-2"
          onClick={() => createOrderMutation.mutate()}
          disabled={createOrderMutation.isPending}
        >
          <ShoppingBag className="h-5 w-5" />
          Create Order · {formatXAF(total)}
        </Button>
      )}
    </div>
  );
};

export default BusinessQuickOrder;
