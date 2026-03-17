import React, { useState, useEffect } from 'react';
import { usePOSTill } from '@/hooks/usePOSTill';
import { POSReceipt } from '@/components/pos/POSReceipt';
import { WalletQRDialog } from '@/components/pos/WalletQRDialog';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { ShiftManager } from '@/components/pos/ShiftManager';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Banknote,
  Wallet, Smartphone, Package, ChevronUp, Percent, Hash, UserCircle,
  ScanBarcode, Clock, Crown, ArrowRight, Lock, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useIsMobile } from '@/hooks/use-mobile';

const fmt = (n: number) => new Intl.NumberFormat('fr-CM', { minimumFractionDigits: 0 }).format(n);

const TILL_VISITED_KEY = 'biz-till-visited';

const BusinessTill: React.FC = () => {
  const { merchantId: paramMerchantId } = useMerchantContext();
  const isMobile = useIsMobile();
  const [cartOpen, setCartOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('till');
  const [showEnterpriseIntro, setShowEnterpriseIntro] = useState(false);

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

  // Show enterprise intro popup on first visit for non-enterprise users
  useEffect(() => {
    if (merchant && !isEnterprise) {
      const visited = localStorage.getItem(TILL_VISITED_KEY);
      if (!visited) {
        setShowEnterpriseIntro(true);
        localStorage.setItem(TILL_VISITED_KEY, 'true');
      }
    }
  }, [merchant, isEnterprise]);

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

  const handleEnterpriseAction = (action: string) => {
    if (isEnterprise) {
      if (action === 'scanner') setScannerOpen(true);
      if (action === 'shifts') setActiveTab('shifts');
    } else {
      toast.info('Upgrade to Enterprise to unlock this feature');
    }
  };

  return (
    <div className="px-5 md:px-0 pt-2 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">POS Till</h1>
      </div>

      {/* Enterprise Quick Actions */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => handleEnterpriseAction('scanner')}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-all',
            isEnterprise
              ? 'border-border/40 bg-card hover:bg-muted/60 active:scale-[0.98]'
              : 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10',
          )}
        >
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            isEnterprise ? 'bg-primary/10' : 'bg-amber-500/10',
          )}>
            <ScanBarcode className={cn('h-4 w-4', isEnterprise ? 'text-primary' : 'text-amber-600')} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Barcode Scanner</p>
            {!isEnterprise && <p className="text-[10px] text-amber-600 flex items-center gap-0.5"><Crown className="h-2.5 w-2.5" /> Enterprise</p>}
          </div>
        </button>

        <button
          onClick={() => handleEnterpriseAction('shifts')}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-all',
            isEnterprise
              ? 'border-border/40 bg-card hover:bg-muted/60 active:scale-[0.98]'
              : 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10',
          )}
        >
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            isEnterprise ? 'bg-primary/10' : 'bg-amber-500/10',
          )}>
            <Clock className={cn('h-4 w-4', isEnterprise ? 'text-primary' : 'text-amber-600')} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Shift Mgmt</p>
            {!isEnterprise && <p className="text-[10px] text-amber-600 flex items-center gap-0.5"><Crown className="h-2.5 w-2.5" /> Enterprise</p>}
          </div>
        </button>
      </div>

      {/* Active Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'till' ? (
          <motion.div
            key="till"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col space-y-4"
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={till.searchQuery}
                onChange={e => till.setSearchQuery(e.target.value)}
                className="pl-9 h-11 rounded-xl border-border/50 bg-muted/40 text-sm"
              />
            </div>

            {/* Products Grid */}
            <div className={cn('grid gap-2.5', isMobile ? 'grid-cols-2' : 'grid-cols-3 lg:grid-cols-4')}>
              {till.productsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
                ))
              ) : till.products.length === 0 ? (
                <div className="col-span-full flex flex-col items-center py-16 text-muted-foreground">
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
                        'relative cursor-pointer rounded-2xl border border-border/40 bg-card p-3 transition-all active:bg-muted hover:border-border/80',
                        inCart && 'ring-2 ring-primary'
                      )}
                    >
                      {inCart && (
                        <Badge className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]">
                          {inCart.quantity}
                        </Badge>
                      )}
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="mb-2 h-12 w-full rounded-xl object-cover" />
                      ) : (
                        <div className="mb-2 flex h-12 items-center justify-center rounded-xl bg-muted/60">
                          <Package className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <p className="truncate text-xs font-semibold text-foreground">{product.name}</p>
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
                    className={cn(
                      'z-30 flex items-center justify-between rounded-2xl bg-primary p-4 text-primary-foreground shadow-xl',
                      isMobile ? 'fixed bottom-20 left-3 right-3' : 'sticky bottom-4',
                    )}
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
                <SheetContent side={isMobile ? 'bottom' : 'right'} className={cn(
                  isMobile ? 'max-h-[85vh] rounded-t-[2rem] border-t-0' : 'w-[420px]',
                  'px-5 pb-8',
                )}>
                  {isMobile && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />}
                  <SheetHeader className="pb-2">
                    <SheetTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-primary" /> Cart
                      <Button variant="ghost" size="sm" className="ml-auto text-xs text-destructive" onClick={till.clearCart}>Clear</Button>
                    </SheetTitle>
                  </SheetHeader>

                  <div className="max-h-[30vh] space-y-2 overflow-y-auto">
                    {till.cart.map(item => (
                      <div key={item.variant_id} className="flex items-center gap-2 rounded-xl border border-border/40 bg-card p-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{fmt(item.price)} ea</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => till.updateQuantity(item.variant_id, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => till.updateQuantity(item.variant_id, item.quantity + 1)}>
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
                        <Input placeholder="Customer" value={till.customerName} onChange={e => till.setCustomerName(e.target.value)} className="h-9 pl-8 text-sm rounded-xl" />
                      </div>
                      <Input placeholder="Phone" value={till.customerPhone} onChange={e => till.setCustomerPhone(e.target.value)} className="h-9 w-24 text-sm rounded-xl" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Discount</span>
                      <Input type="number" min={0} value={till.globalDiscount || ''} onChange={e => till.setGlobalDiscount(Number(e.target.value))} className="h-9 w-16 text-sm rounded-xl" />
                      <Button variant={till.discountType === 'percent' ? 'default' : 'outline'} size="icon" className="h-8 w-8 rounded-lg" onClick={() => till.setDiscountType('percent')}><Percent className="h-3 w-3" /></Button>
                      <Button variant={till.discountType === 'fixed' ? 'default' : 'outline'} size="icon" className="h-8 w-8 rounded-lg" onClick={() => till.setDiscountType('fixed')}><Hash className="h-3 w-3" /></Button>
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
                    <div className="flex justify-between border-t border-border/30 pt-1 text-lg font-bold">
                      <span>Total</span><span>{fmt(till.total)} XAF</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Button className="flex-col gap-1 h-auto py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" onClick={() => { setCartOpen(false); till.checkout('cash'); }} disabled={till.isCheckingOut}>
                      <Banknote className="h-5 w-5" /><span className="text-xs">Cash</span>
                    </Button>
                    <Button className="flex-col gap-1 h-auto py-3 rounded-xl" onClick={() => { setCartOpen(false); till.checkout('wallet'); }} disabled={till.isCheckingOut}>
                      <Wallet className="h-5 w-5" /><span className="text-xs">Scan Pay</span>
                    </Button>
                    <Button className="flex-col gap-1 h-auto py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl" onClick={() => { setCartOpen(false); till.checkout('mobile_money'); }} disabled={till.isCheckingOut}>
                      <Smartphone className="h-5 w-5" /><span className="text-xs">MoMo</span>
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="shifts"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {isEnterprise && merchantId ? (
              <ShiftManager merchantId={merchantId} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                  <Lock className="h-7 w-7 text-amber-600" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">Enterprise Feature</h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-4">
                  Upgrade to Enterprise to unlock shift management, cash drawer tracking, and end-of-day reports.
                </p>
                <Button
                  onClick={() => toast.info('Upgrade to Enterprise')}
                  className="rounded-xl gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Crown className="h-4 w-4" /> Upgrade <ArrowRight className="h-4 w-4" />
                </Button>
                <button onClick={() => setActiveTab('till')} className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  ← Back to Till
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barcode Scanner */}
      {isEnterprise && (
        <BarcodeScanner isOpen={scannerOpen} onOpenChange={setScannerOpen} onScan={till.lookupByBarcode} />
      )}

      {/* Wallet QR Payment Dialog */}
      <WalletQRDialog
        qrData={till.walletQR}
        onClose={till.cancelWalletQR}
        onCheckPayment={till.checkWalletPayment}
      />

      {/* Enterprise Intro Popup — first visit only */}
      <Dialog open={showEnterpriseIntro} onOpenChange={setShowEnterpriseIntro}>
        <DialogContent className="max-w-sm rounded-2xl p-6">
          <DialogHeader className="text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 mb-3">
              <Sparkles className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-lg">Unlock Pro POS Features</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Enterprise merchants get access to barcode scanning, shift management, and advanced cash drawer tracking — all built into this till.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-2">
            {[
              { icon: ScanBarcode, label: 'Camera barcode & SKU scanning' },
              { icon: Clock, label: 'Staff shift & cash drawer tracking' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <f.icon className="h-4 w-4 text-amber-600" strokeWidth={1.8} />
                </div>
                <p className="text-sm font-medium text-foreground">{f.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setShowEnterpriseIntro(false)}
            >
              Maybe Later
            </Button>
            <Button
              className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              onClick={() => { setShowEnterpriseIntro(false); toast.info('Upgrade to Enterprise'); }}
            >
              <Crown className="h-4 w-4" /> Upgrade
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessTill;
