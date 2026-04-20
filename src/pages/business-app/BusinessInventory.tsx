import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package, Search, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageGuide } from '@/components/business-app/PageGuide';

export default function BusinessInventory() {
  const [search, setSearch] = useState('');
  const { merchantId } = useMerchantContext();
  const isMobile = useIsMobile();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const { data: locations } = useQuery({
    queryKey: ['merchant-locations', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data } = await supabase.from('merchant_locations').select('*').eq('merchant_id', merchantId);
      return data || [];
    },
    enabled: !!merchantId,
  });

  const defaultLocation = locations?.[0];

  const { data: inventory, isLoading, refetch } = useQuery({
    queryKey: ['business-inventory', merchantId, defaultLocation?.id, search],
    queryFn: async () => {
      if (!merchantId || !defaultLocation) return [];
      const { data, error } = await supabase.functions.invoke('pos-inventory', {
        body: { merchant_id: merchantId, location_id: defaultLocation.id, search: search || undefined, limit: 100, offset: 0 },
      });
      if (error) throw error;
      return data?.inventory || [];
    },
    enabled: !!merchantId && !!defaultLocation,
  });

  const handleAdjustInventory = async () => {
    if (!selectedItem || !adjustmentQty) return;
    const qtyDelta = parseInt(adjustmentQty);
    if (isNaN(qtyDelta)) { toast.error('Please enter a valid number for the quantity adjustment'); return; }
    const { error } = await supabase.functions.invoke('pos-inventory', {
      method: 'POST',
      body: { merchant_id: merchantId, variant_id: selectedItem.variant_id, location_id: selectedItem.location_id, quantity_delta: qtyDelta, type: 'manual_adjust', reason: adjustmentReason || 'Manual adjustment' },
    });
    if (error) { toast.error('Could not adjust inventory. Please try again.'); }
    else { toast.success(`Stock ${qtyDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(qtyDelta)} units`); setSelectedItem(null); setAdjustmentQty(''); setAdjustmentReason(''); refetch(); }
  };

  const lowStockItems = inventory?.filter((item: any) => item.available_quantity < 10) || [];

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <PageGuide
        title="Inventory"
        summary="Track stock levels across products, spot low-stock items, and adjust quantities with a clear audit trail."
        steps={[
          { title: 'Search for an item', description: 'Use the search bar to find a product or variant in your active location.' },
          { title: 'Watch low-stock alerts', description: 'Items below threshold are highlighted so you can reorder before selling out.' },
          { title: 'Adjust quantities', description: 'Open an item to add or remove stock with a reason — every change is logged.' },
        ]}
      />
      {/* Header */}
      <header className="pt-4 md:pt-0 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Inventory</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Track stock levels</p>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-2xl border border-border/40 bg-card p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 mb-3">
            <Package className="h-4 w-4 text-sky-600" strokeWidth={1.8} />
          </div>
          <p className="text-lg font-bold text-foreground">{inventory?.length || 0}</p>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Total Items</p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={1.8} />
          </div>
          <p className={cn('text-lg font-bold', lowStockItems.length > 0 ? 'text-amber-600' : 'text-foreground')}>{lowStockItems.length}</p>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Low Stock</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={2} />
        <Input placeholder="Search SKU or product name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl border-border/50 bg-muted/40 text-sm" />
      </div>

      {/* Inventory List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : !inventory?.length ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
            <Package className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold mb-1">No inventory found</h3>
          <p className="text-sm text-muted-foreground">Add products to start tracking stock</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {inventory.map((item: any, i: number) => {
              const isLowStock = item.available_quantity < 10;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    'rounded-2xl border bg-card p-4 transition-colors',
                    isLowStock ? 'border-amber-500/40' : 'border-border/40'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-foreground truncate">
                          {item.pos_product_variants?.pos_products?.name}
                        </p>
                        {isLowStock && (
                          <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 border-0">Low</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.pos_product_variants?.name}</p>
                      {item.pos_product_variants?.sku && (
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">SKU: {item.pos_product_variants.sku}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="rounded-xl bg-muted/40 px-3 py-2 text-center flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Available</p>
                      <p className={cn('text-base font-bold', isLowStock ? 'text-amber-600' : 'text-foreground')}>{item.available_quantity}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 px-3 py-2 text-center flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reserved</p>
                      <p className="text-base font-bold text-foreground">{item.reserved_quantity}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 px-3 py-2 text-center flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Price</p>
                      <p className="text-base font-bold text-foreground">{item.pos_product_variants?.price?.toLocaleString()}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl h-9 text-xs font-semibold border-border/50"
                    onClick={() => setSelectedItem(item)}
                  >
                    Adjust Stock
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* Adjustment Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={cn(
          isMobile ? 'max-h-[85vh] rounded-t-[2rem] border-t-0' : 'w-[420px]',
          'overflow-y-auto px-5 pb-10',
        )}>
          <SheetHeader className="pb-2">
            {isMobile && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />}
            <SheetTitle className="text-left">Adjust Inventory</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quantity Change</label>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={() => setAdjustmentQty('-10')}>
                  <TrendingDown className="h-4 w-4 mr-1" /> -10
                </Button>
                <Button variant="outline" className="rounded-xl h-10" onClick={() => setAdjustmentQty('-1')}>-1</Button>
                <Input type="number" placeholder="0" value={adjustmentQty} onChange={(e) => setAdjustmentQty(e.target.value)} className="w-20 text-center rounded-xl h-10" />
                <Button variant="outline" className="rounded-xl h-10" onClick={() => setAdjustmentQty('+1')}>+1</Button>
                <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={() => setAdjustmentQty('+10')}>
                  <TrendingUp className="h-4 w-4 mr-1" /> +10
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reason (optional)</label>
              <Input placeholder="e.g. Stock count, damaged goods..." value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} className="rounded-xl" />
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-sm">Current: <span className="font-bold">{selectedItem?.available_quantity}</span></p>
              {adjustmentQty && !isNaN(parseInt(adjustmentQty)) && (
                <p className="text-sm mt-1">New: <span className="font-bold">{selectedItem?.available_quantity + parseInt(adjustmentQty)}</span></p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setSelectedItem(null)}>Cancel</Button>
              <Button className="flex-1 rounded-xl h-11 bg-foreground text-background hover:bg-foreground/90" onClick={handleAdjustInventory} disabled={!adjustmentQty}>Confirm</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
