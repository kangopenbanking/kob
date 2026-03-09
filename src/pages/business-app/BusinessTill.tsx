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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Banknote,
  Wallet, Smartphone, Package, ChevronUp, Percent, Hash, UserCircle,
  ScanBarcode, Clock, Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

const fmt = (n: number) => new Intl.NumberFormat('fr-CM', { minimumFractionDigits: 0 }).format(n);

const BusinessTill: React.FC = () => {
  const { merchantId: paramMerchantId } = useParams<{ merchantId?: string }>();
  const [cartOpen, setCartOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('till');

  const { data: merchant } = useQuery({
    queryKey: ['biz-till-merchant', paramMerchantId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      if (paramMerchantId) {
        const { data } = await supabase.from('gateway_merchants').select('id, business_name, plan_tier').eq('id', paramMerchantId).maybeSingle();
        return data;
      }
      const { data: staff } = await supabase.from('merchant_pos_staff').select('merchant_id').eq('user_id', user.id).eq('status', 'active').maybeSingle();
      if (staff) {
        const { data } = await supabase.from('gateway_merchants').select('id, business_name, plan_tier').eq('id', staff.merchant_id).maybeSingle();
        return data;
      }
      const { data } = await supabase.from('gateway_merchants').select('id, business_name, plan_tier').eq('user_id', user.id).maybeSingle();
      return data;
    },
  });

  const merchantId = merchant?.id;
  const isEnterprise = merchant?.plan_tier === 'enterprise';
  const till = usePOSTill(merchantId);

  if (till.receipt) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <POSReceipt
          receipt={till.receipt}
          onClose={() => till.setReceipt(null)}
          onNewSale={() => { till.clearCart(); till.setReceipt(null); }}
        />
      </div>
    );
  }

  const cartCount = till.cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md">
        <TabsList className="mx-3 mt-2 h-9">
          <TabsTrigger value="till" className="gap-1.5 text-xs">
            <ShoppingCart className="h-3.5 w-3.5" /> Till
          </TabsTrigger>
          <TabsTrigger value="shifts" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Shifts
            {!isEnterprise && <Crown className="h-3 w-3 text-amber-500" />}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="till" className="mt-0 flex flex-col pb-4">
        {/* Search + Scanner */}
        <div className="sticky top-10 z-10 bg-background/95 backdrop-blur-md">
          <div className="flex items-center gap-2 p-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search products..." value={till.searchQuery} onChange={e => till.setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <EnterpriseGate isEnterprise={isEnterprise} onUpgrade={() => toast.info('Upgrade to Enterprise')}>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setScannerOpen(true)}>
                <ScanBarcode className="h-5 w-5" />
              </Button>
            </EnterpriseGate>
          </div>
        </div>

        {/* Products */}
        <div className="grid grid-cols-2 gap-2.5 px-3">
          {till.productsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))
          ) : till.products.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center py-16 text-muted-foreground">
              <Package className="mb-2 h-10 w-10" />
              <p className="text-sm">No products available</p>
            </div>
          ) : (
            till.products.map((product: any) => {
              const variant = product.pos_product_variants?.[0];
              const price = variant?.price || 0;
              const inCart = till.cart.find(c => c.variant_id === variant?.id);
              return (
                <motion.div
                  key={product.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => till.addItem(product)}
                  className={cn(
                    'relative cursor-pointer rounded-xl border bg-card p-3 transition-all active:bg-muted',
                    inCart && 'ring-2 ring-primary'
                  )}
                >
                  {inCart && (
                    <Badge className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]">
                      {inCart.quantity}
                    </Badge>
                  )}
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="mb-2 h-12 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="mb-2 flex h-12 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <p className="truncate text-xs font-medium text-foreground">{product.name}</p>
                  <p className="text-sm font-bold text-primary">{fmt(price)}</p>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Floating Cart Button */}
        {cartCount > 0 && (
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <motion.button
                initial={{ y: 60 }}
                animate={{ y: 0 }}
                className="fixed bottom-20 left-3 right-3 z-30 flex items-center justify-between rounded-2xl bg-primary p-4 text-primary-foreground shadow-xl"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="font-bold">{cartCount} item{cartCount !== 1 && 's'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{fmt(till.total)} XAF</span>
                  <ChevronUp className="h-4 w-4" />
                </div>
              </motion.button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl px-4 pb-6">
              <SheetHeader className="pb-2">
                <SheetTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" /> Cart
                  <Button variant="ghost" size="sm" className="ml-auto text-xs text-destructive" onClick={till.clearCart}>Clear</Button>
                </SheetTitle>
              </SheetHeader>

              <div className="max-h-[30vh] space-y-2 overflow-y-auto">
                {till.cart.map(item => (
                  <div key={item.variant_id} className="flex items-center gap-2 rounded-xl border bg-card p-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{fmt(item.price)} ea</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => till.updateQuantity(item.variant_id, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => till.updateQuantity(item.variant_id, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="w-16 text-right text-sm font-bold tabular-nums">{fmt(item.price * item.quantity)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => till.removeItem(item.variant_id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <UserCircle className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Customer" value={till.customerName} onChange={e => till.setCustomerName(e.target.value)} className="h-9 pl-8 text-sm" />
                  </div>
                  <Input placeholder="Phone" value={till.customerPhone} onChange={e => till.setCustomerPhone(e.target.value)} className="h-9 w-24 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Discount</span>
                  <Input type="number" min={0} value={till.globalDiscount || ''} onChange={e => till.setGlobalDiscount(Number(e.target.value))} className="h-9 w-16 text-sm" />
                  <Button variant={till.discountType === 'percent' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => till.setDiscountType('percent')}><Percent className="h-3 w-3" /></Button>
                  <Button variant={till.discountType === 'fixed' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => till.setDiscountType('fixed')}><Hash className="h-3 w-3" /></Button>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{fmt(till.subtotal)} XAF</span>
                </div>
                {till.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span><span>-{fmt(till.discountAmount)} XAF</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 text-lg font-bold">
                  <span>Total</span><span>{fmt(till.total)} XAF</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button className="flex-col gap-1 h-auto py-3 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setCartOpen(false); till.checkout('cash'); }} disabled={till.isCheckingOut}>
                  <Banknote className="h-5 w-5" /><span className="text-xs">Cash</span>
                </Button>
                <Button className="flex-col gap-1 h-auto py-3" onClick={() => { setCartOpen(false); till.checkout('wallet'); }} disabled={till.isCheckingOut}>
                  <Wallet className="h-5 w-5" /><span className="text-xs">Wallet</span>
                </Button>
                <Button className="flex-col gap-1 h-auto py-3 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => { setCartOpen(false); till.checkout('mobile_money'); }} disabled={till.isCheckingOut}>
                  <Smartphone className="h-5 w-5" /><span className="text-xs">MoMo</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </TabsContent>

      <TabsContent value="shifts" className="mt-0 p-4">
        <EnterpriseGate isEnterprise={isEnterprise} onUpgrade={() => toast.info('Upgrade to Enterprise for shift management')}>
          {merchantId && <ShiftManager merchantId={merchantId} />}
        </EnterpriseGate>
      </TabsContent>

      {/* Barcode Scanner */}
      {isEnterprise && (
        <BarcodeScanner isOpen={scannerOpen} onOpenChange={setScannerOpen} onScan={till.lookupByBarcode} />
      )}
    </Tabs>
  );
};

export default BusinessTill;
