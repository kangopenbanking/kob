import React, { useState } from 'react';
import { usePOSTill } from '@/hooks/usePOSTill';
import { POSReceipt } from '@/components/pos/POSReceipt';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { ShiftManager } from '@/components/pos/ShiftManager';
import { EnterpriseGate } from '@/components/storefront/EnterpriseGate';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Banknote,
  Wallet, Smartphone, Package, Percent, Hash, UserCircle,
  ScanBarcode, Clock, Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const fmt = (n: number) => new Intl.NumberFormat('fr-CM', { minimumFractionDigits: 0 }).format(n);

const MerchantPOSTill: React.FC = () => {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('till');

  const { data: merchant } = useQuery({
    queryKey: ['my-merchant-for-till'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('gateway_merchants')
        .select('id, business_name, plan_tier')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
  });

  const merchantId = merchant?.id;
  const isEnterprise = merchant?.plan_tier === 'enterprise';

  const {
    products, productsLoading, cart, addItem, removeItem, updateQuantity,
    clearCart, lookupByBarcode, customerName, setCustomerName, customerPhone,
    setCustomerPhone, globalDiscount, setGlobalDiscount, discountType, setDiscountType,
    subtotal, discountAmount, taxAmount, total,
    isCheckingOut, checkout, receipt, setReceipt, searchQuery, setSearchQuery,
  } = usePOSTill(merchantId);

  if (receipt) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <POSReceipt
          receipt={receipt}
          onClose={() => setReceipt(null)}
          onNewSale={() => { clearCart(); setReceipt(null); }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* Top Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <TabsList className="h-9">
            <TabsTrigger value="till" className="gap-1.5 text-sm">
              <ShoppingCart className="h-4 w-4" /> Till
            </TabsTrigger>
            <TabsTrigger value="shifts" className="gap-1.5 text-sm">
              <Clock className="h-4 w-4" /> Shifts
              {!isEnterprise && <Crown className="h-3 w-3 text-amber-500" />}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="till" className="mt-0 flex flex-1 overflow-hidden">
          <div className="flex flex-1 gap-0 overflow-hidden">
            {/* LEFT — Product Grid */}
            <div className="flex flex-1 flex-col border-r">
              <div className="flex items-center gap-2 border-b p-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {/* Enterprise: Barcode Scanner Button */}
                <EnterpriseGate isEnterprise={isEnterprise} onUpgrade={() => toast.info('Upgrade to Enterprise for barcode scanning')}>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setScannerOpen(true)}
                  >
                    <ScanBarcode className="h-5 w-5" />
                  </Button>
                </EnterpriseGate>
              </div>

              <ScrollArea className="flex-1 p-3">
                {productsLoading ? (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Package className="mb-3 h-12 w-12" />
                    <p className="text-lg font-medium">No products yet</p>
                    <p className="text-sm">Add products from your catalog to start selling</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                    {products.map((product: any) => {
                      const variant = product.pos_product_variants?.[0];
                      const price = variant?.price || 0;
                      const inCart = cart.find(c => c.variant_id === variant?.id);
                      return (
                        <motion.div
                          key={product.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => addItem(product)}
                          className={cn(
                            'relative cursor-pointer rounded-xl border bg-card p-3 transition-all hover:shadow-md',
                            inCart && 'ring-2 ring-primary'
                          )}
                        >
                          {inCart && (
                            <Badge className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full p-0 text-xs">
                              {inCart.quantity}
                            </Badge>
                          )}
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="mb-2 h-14 w-full rounded-lg object-cover" />
                          ) : (
                            <div className="mb-2 flex h-14 items-center justify-center rounded-lg bg-muted">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                          <p className="text-sm font-bold text-primary">{fmt(price)} XAF</p>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* RIGHT — Cart Panel */}
            <div className="flex w-[380px] flex-col bg-muted/30 xl:w-[420px]">
              <div className="flex items-center justify-between border-b p-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-bold text-foreground">Cart</h2>
                  <Badge variant="secondary" className="text-xs">{cart.length}</Badge>
                </div>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={clearCart}>
                    Clear
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 p-3">
                <AnimatePresence>
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-muted-foreground">
                      <ShoppingCart className="mb-2 h-10 w-10" />
                      <p className="text-sm">Tap a product to add</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map(item => (
                        <motion.div
                          key={item.variant_id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="flex items-center gap-2 rounded-xl border bg-card p-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{fmt(item.price)} × {item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="w-20 text-right text-sm font-bold tabular-nums text-foreground">
                            {fmt(item.price * item.quantity)}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.variant_id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </ScrollArea>

              {cart.length > 0 && (
                <div className="space-y-2 border-t p-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <UserCircle className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-9 pl-8 text-sm" />
                    </div>
                    <Input placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-9 w-28 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Discount</span>
                    <Input type="number" min={0} value={globalDiscount || ''} onChange={e => setGlobalDiscount(Number(e.target.value))} className="h-9 w-20 text-sm" placeholder="0" />
                    <Button variant={discountType === 'percent' ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setDiscountType('percent')}>
                      <Percent className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant={discountType === 'fixed' ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setDiscountType('fixed')}>
                      <Hash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {cart.length > 0 && (
                <div className="border-t p-3">
                  <div className="mb-3 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span><span className="tabular-nums">{fmt(subtotal)} XAF</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span><span className="tabular-nums">-{fmt(discountAmount)} XAF</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1 text-lg font-bold text-foreground">
                      <span>Total</span><span className="tabular-nums">{fmt(total)} XAF</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button className="flex-col gap-1 h-auto py-3 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => checkout('cash')} disabled={isCheckingOut}>
                      <Banknote className="h-5 w-5" /><span className="text-xs">Cash</span>
                    </Button>
                    <Button className="flex-col gap-1 h-auto py-3" onClick={() => checkout('wallet')} disabled={isCheckingOut}>
                      <Wallet className="h-5 w-5" /><span className="text-xs">Wallet</span>
                    </Button>
                    <Button className="flex-col gap-1 h-auto py-3 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => checkout('mobile_money')} disabled={isCheckingOut}>
                      <Smartphone className="h-5 w-5" /><span className="text-xs">MoMo</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="shifts" className="mt-0 flex-1 overflow-auto p-4">
          <EnterpriseGate isEnterprise={isEnterprise} onUpgrade={() => toast.info('Upgrade to Enterprise for shift management')}>
            {merchantId && <ShiftManager merchantId={merchantId} />}
          </EnterpriseGate>
        </TabsContent>
      </Tabs>

      {/* Barcode Scanner Dialog */}
      {isEnterprise && (
        <BarcodeScanner
          isOpen={scannerOpen}
          onOpenChange={setScannerOpen}
          onScan={lookupByBarcode}
        />
      )}
    </div>
  );
};

export default MerchantPOSTill;
