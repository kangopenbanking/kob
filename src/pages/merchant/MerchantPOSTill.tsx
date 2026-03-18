import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOSTill } from '@/hooks/usePOSTill';
import { POSReceipt } from '@/components/pos/POSReceipt';
import { WalletQRDialog } from '@/components/pos/WalletQRDialog';
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
  ScanBarcode, Clock, Crown, Store, CreditCard, Receipt,
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
    walletQR, checkWalletPayment, cancelWalletQR,
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
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-muted/20">
      {/* Top Navigation Bar */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b bg-background px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Store className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">
                {merchant?.business_name || 'POS Terminal'}
              </h1>
              <p className="text-[10px] text-muted-foreground">Point of Sale</p>
            </div>
          </div>
          <TabsList className="h-9 bg-muted/60">
            <TabsTrigger value="till" className="gap-1.5 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CreditCard className="h-3.5 w-3.5" strokeWidth={1.5} /> Till
            </TabsTrigger>
            <TabsTrigger value="shifts" className="gap-1.5 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.5} /> Shifts
              {!isEnterprise && <Crown className="h-3 w-3 text-amber-500" />}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="till" className="mt-0 flex flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT — Product Grid */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Search Bar */}
              <div className="flex items-center gap-2 bg-background border-b px-4 py-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 rounded-xl border-border/60 bg-muted/40 focus:bg-background transition-colors"
                  />
                </div>
                {isEnterprise ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl border-border/60"
                    onClick={() => setScannerOpen(true)}
                  >
                    <ScanBarcode className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl border-border/60 opacity-50"
                    onClick={() => navigate('/biz/enterprise')}
                  >
                    <ScanBarcode className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </Button>
                )}
              </div>

              {/* Product Grid */}
              <ScrollArea className="flex-1 p-4">
                {productsLoading ? (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/60" />
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
                      <Package className="h-8 w-8" strokeWidth={1.5} />
                    </div>
                    <p className="text-base font-bold text-foreground">No products yet</p>
                    <p className="text-sm mt-1">Add products from your catalog to start selling</p>
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
                            'relative cursor-pointer rounded-2xl border bg-background p-3.5 transition-all hover:shadow-md hover:border-primary/30',
                            inCart ? 'border-primary/50 shadow-sm shadow-primary/10' : 'border-border/50'
                          )}
                        >
                          {inCart && (
                            <Badge className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full p-0 text-xs shadow-md">
                              {inCart.quantity}
                            </Badge>
                          )}
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="mb-2.5 h-16 w-full rounded-xl object-cover" />
                          ) : (
                            <div className="mb-2.5 flex h-16 items-center justify-center rounded-xl bg-muted/50">
                              <Package className="h-6 w-6 text-muted-foreground/60" strokeWidth={1.5} />
                            </div>
                          )}
                          <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                          <p className="text-sm font-bold text-primary mt-0.5">{fmt(price)} XAF</p>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* RIGHT — Cart Panel */}
            <div className="flex w-[380px] flex-col bg-background border-l xl:w-[420px]">
              {/* Cart Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Receipt className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-sm font-bold text-foreground">Current Sale</h2>
                  {cart.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold rounded-md">{cart.length}</Badge>
                  )}
                </div>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg h-7 px-2" onClick={clearCart}>
                    Clear All
                  </Button>
                )}
              </div>

              {/* Cart Items */}
              <ScrollArea className="flex-1 px-4 py-3">
                <AnimatePresence>
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-muted-foreground">
                      <ShoppingCart className="mb-3 h-12 w-12 text-muted-foreground/30" strokeWidth={1} />
                      <p className="text-sm font-medium text-muted-foreground/70">Tap a product to add</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map(item => (
                        <motion.div
                          key={item.variant_id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/20 p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{fmt(item.price)} x {item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-border/50" onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}>
                              <Minus className="h-3 w-3" strokeWidth={2} />
                            </Button>
                            <span className="w-7 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg border-border/50" onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}>
                              <Plus className="h-3 w-3" strokeWidth={2} />
                            </Button>
                          </div>
                          <span className="w-20 text-right text-sm font-bold tabular-nums text-foreground">
                            {fmt(item.price * item.quantity)}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => removeItem(item.variant_id)}>
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </ScrollArea>

              {/* Customer & Discount Section */}
              {cart.length > 0 && (
                <div className="space-y-2.5 border-t px-4 py-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <UserCircle className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" strokeWidth={1.5} />
                      <Input placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-9 pl-8 text-sm rounded-lg border-border/50" />
                    </div>
                    <Input placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-9 w-28 text-sm rounded-lg border-border/50" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Discount</span>
                    <Input type="number" min={0} value={globalDiscount || ''} onChange={e => setGlobalDiscount(Number(e.target.value))} className="h-8 w-20 text-sm rounded-lg border-border/50" placeholder="0" />
                    <Button variant={discountType === 'percent' ? 'default' : 'outline'} size="icon" className="h-8 w-8 rounded-lg" onClick={() => setDiscountType('percent')}>
                      <Percent className="h-3 w-3" strokeWidth={2} />
                    </Button>
                    <Button variant={discountType === 'fixed' ? 'default' : 'outline'} size="icon" className="h-8 w-8 rounded-lg" onClick={() => setDiscountType('fixed')}>
                      <Hash className="h-3 w-3" strokeWidth={2} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Totals & Payment */}
              {cart.length > 0 && (
                <div className="border-t px-4 py-4">
                  <div className="mb-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span><span className="tabular-nums font-medium">{fmt(subtotal)} XAF</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span><span className="tabular-nums font-medium">-{fmt(discountAmount)} XAF</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border/50 pt-2 text-xl font-black text-foreground">
                      <span>Total</span><span className="tabular-nums">{fmt(total)} XAF</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      className="flex-col gap-1.5 h-auto py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      onClick={() => checkout('cash')}
                      disabled={isCheckingOut}
                    >
                      <Banknote className="h-5 w-5" strokeWidth={1.5} />
                      <span className="text-[11px] font-bold">Cash</span>
                    </Button>
                    <Button
                      className="flex-col gap-1.5 h-auto py-3.5 rounded-xl shadow-sm"
                      onClick={() => checkout('wallet')}
                      disabled={isCheckingOut}
                    >
                      <Wallet className="h-5 w-5" strokeWidth={1.5} />
                      <span className="text-[11px] font-bold">Wallet QR</span>
                    </Button>
                    <Button
                      className="flex-col gap-1.5 h-auto py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                      onClick={() => checkout('mobile_money')}
                      disabled={isCheckingOut}
                    >
                      <Smartphone className="h-5 w-5" strokeWidth={1.5} />
                      <span className="text-[11px] font-bold">MoMo</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="shifts" className="mt-0 flex-1 overflow-auto p-4">
          <EnterpriseGate isEnterprise={isEnterprise} onUpgrade={() => navigate('/biz/enterprise')}>
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

      {/* Wallet QR Payment Dialog */}
      <WalletQRDialog
        qrData={walletQR}
        onClose={cancelWalletQR}
        onCheckPayment={checkWalletPayment}
      />
    </div>
  );
};

export default MerchantPOSTill;
