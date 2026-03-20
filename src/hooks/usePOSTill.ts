import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WalletQRData {
  qr_payload: string;
  order_id: string;
  order_number: string;
  amount: number;
  merchant_name: string;
}

export interface CartItem {
  variant_id: string;
  product_id: string;
  name: string;
  variant_name: string;
  price: number;
  quantity: number;
  discount: number;
  image_url?: string;
}

export interface ReceiptData {
  order_id: string;
  order_number: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: string;
  merchant_name: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
}

export function usePOSTill(merchantId: string | undefined) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('percent');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [walletQR, setWalletQR] = useState<WalletQRData | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['pos-till-products', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data: prods } = await supabase
        .from('pos_products')
        .select('*, pos_product_variants(*)')
        .eq('merchant_id', merchantId)
        .eq('status', 'active')
        .order('name');
      return (prods || []) as any[];
    },
    enabled: !!merchantId,
  });

  const { data: merchantData } = useQuery({
    queryKey: ['pos-till-merchant', merchantId],
    queryFn: async () => {
      if (!merchantId) return null;
      const { data } = await supabase
        .from('gateway_merchants')
        .select('id, business_name')
        .eq('id', merchantId)
        .single();
      return data;
    },
    enabled: !!merchantId,
  });

  const filteredProducts = useMemo(() => {
    let result = products;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p: any) => p.name?.toLowerCase().includes(q));
    }
    return result;
  }, [products, searchQuery, categoryFilter]);

  const addItem = useCallback((product: any, variant?: any) => {
    const v = variant || product.pos_product_variants?.[0];
    if (!v) return;
    setCart(prev => {
      const existing = prev.find(i => i.variant_id === v.id);
      if (existing) {
        return prev.map(i => i.variant_id === v.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        variant_id: v.id,
        product_id: product.id,
        name: product.name,
        variant_name: v.name || 'Default',
        price: v.price || 0,
        quantity: 1,
        discount: 0,
        image_url: product.image_url,
      }];
    });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setCart(prev => prev.filter(i => i.variant_id !== variantId));
  }, []);

  const updateQuantity = useCallback((variantId: string, qty: number) => {
    if (qty < 1) return removeItem(variantId);
    setCart(prev => prev.map(i => i.variant_id === variantId ? { ...i, quantity: qty } : i));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setGlobalDiscount(0);
    setReceipt(null);
  }, []);

  const lookupByBarcode = useCallback((code: string) => {
    // Search variants by barcode or SKU
    for (const product of products) {
      const variants = product.pos_product_variants || [];
      const matchedVariant = variants.find((v: any) =>
        v.barcode === code || v.sku === code
      );
      if (matchedVariant) {
        addItem(product, matchedVariant);
        toast.success(`Added: ${product.name}`);
        return true;
      }
    }
    // Fallback: search by product name partial match
    const nameMatch = products.find((p: any) => p.name?.toLowerCase().includes(code.toLowerCase()));
    if (nameMatch) {
      addItem(nameMatch);
      toast.success(`Added: ${nameMatch.name}`);
      return true;
    }
    toast.error(`No product found for "${code}"`);
    return false;
  }, [products, addItem]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + (i.price * i.quantity - i.discount), 0), [cart]);
  const discountAmount = useMemo(() => discountType === 'percent' ? subtotal * globalDiscount / 100 : globalDiscount, [subtotal, globalDiscount, discountType]);
  const taxRate = 0; // configurable per merchant later
  const taxAmount = useMemo(() => (subtotal - discountAmount) * taxRate, [subtotal, discountAmount, taxRate]);
  const total = useMemo(() => Math.max(subtotal - discountAmount + taxAmount, 0), [subtotal, discountAmount, taxAmount]);

  const createOrderAndSubmit = useCallback(async () => {
    if (!merchantId || cart.length === 0) return null;

    const orderRes = await supabase.functions.invoke('pos-orders', {
      body: {
        merchant_id: merchantId,
        channel: 'pos',
        currency: 'XAF',
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        items: cart.map(i => ({
          variant_id: i.variant_id,
          product_id: i.product_id,
          name: `${i.name}${i.variant_name !== 'Default' ? ` - ${i.variant_name}` : ''}`,
          quantity: i.quantity,
          unit_price: i.price,
          discount: i.discount,
        })),
        discount_amount: discountAmount,
      },
    });
    if (orderRes.error) throw new Error(orderRes.error.message || 'Order creation failed');
    const order = orderRes.data;

    await supabase.functions.invoke('pos-submit-order', {
      body: { order_id: order.id },
    });

    return order;
  }, [merchantId, cart, customerName, customerPhone, discountAmount]);

  const checkout = useCallback(async (paymentMethod: 'cash' | 'wallet' | 'mobile_money') => {
    if (!merchantId || cart.length === 0) return;
    setIsCheckingOut(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const order = await createOrderAndSubmit();
      if (!order) throw new Error('Failed to create order');

      // Wallet: generate QR code for customer to scan & pay
      if (paymentMethod === 'wallet') {
        const qrRes = await supabase.functions.invoke('pos-qr-payment', {
          body: {
            action: 'generate',
            merchant_id: merchantId,
            amount: total,
            order_id: order.id,
            description: `Order ${order.order_number || order.id.slice(0, 8)}`,
          },
        });
        if (qrRes.error) throw new Error(qrRes.error.message || 'QR generation failed');

        setWalletQR({
          qr_payload: qrRes.data.qr_payload,
          order_id: order.id,
          order_number: order.order_number || order.id.slice(0, 8).toUpperCase(),
          amount: total,
          merchant_name: merchantData?.business_name || 'Merchant',
        });
        toast.success('Scan & Pay QR code generated — ask your customer to scan it with their Kang app');
        return;
      }

      // Cash & MoMo: proceed through pos-pay-order
      const idempotencyKey = `${order.id}-${Date.now()}`;
      const payRes = await supabase.functions.invoke('pos-pay-order', {
        body: { order_id: order.id, method: paymentMethod },
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      if (payRes.error) throw new Error(payRes.error.message || 'Payment failed');

      // Build receipt
      setReceipt({
        order_id: order.id,
        order_number: order.order_number || order.id.slice(0, 8).toUpperCase(),
        items: [...cart],
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        payment_method: paymentMethod,
        merchant_name: merchantData?.business_name || 'Merchant',
        created_at: new Date().toISOString(),
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
      });

      toast.success(`Payment of ${total.toLocaleString()} XAF received via ${paymentMethod === 'cash' ? 'cash' : 'Mobile Money'} ✅`);
    } catch (err: any) {
      toast.error(err.message || 'Checkout could not be completed. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  }, [merchantId, cart, customerName, customerPhone, discountAmount, subtotal, taxAmount, total, merchantData, createOrderAndSubmit]);

  // Poll for wallet QR payment completion
  const checkWalletPayment = useCallback(async () => {
    if (!walletQR) return;
    const { data: order } = await supabase
      .from('pos_orders')
      .select('status, order_number')
      .eq('id', walletQR.order_id)
      .single();

    if (order?.status === 'paid') {
      setReceipt({
        order_id: walletQR.order_id,
        order_number: walletQR.order_number,
        items: [...cart],
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total: walletQR.amount,
        payment_method: 'wallet_qr',
        merchant_name: walletQR.merchant_name,
        created_at: new Date().toISOString(),
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
      });
      setWalletQR(null);
      toast.success(`Customer payment of ${walletQR.amount.toLocaleString()} XAF received via Scan & Pay ✅`);
      return true;
    }
    return false;
  }, [walletQR, cart, subtotal, discountAmount, taxAmount, customerName, customerPhone]);

  const cancelWalletQR = useCallback(() => {
    setWalletQR(null);
  }, []);

  return {
    products: filteredProducts,
    productsLoading,
    merchantData,
    cart,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    lookupByBarcode,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    globalDiscount,
    setGlobalDiscount,
    discountType,
    setDiscountType,
    subtotal,
    discountAmount,
    taxAmount,
    total,
    isCheckingOut,
    checkout,
    receipt,
    setReceipt,
    walletQR,
    setWalletQR,
    checkWalletPayment,
    cancelWalletQR,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
  };
}
