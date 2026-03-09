import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package, Search, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function BusinessInventory() {
  const [search, setSearch] = useState('');
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Get merchant ID from auth
  useState(() => {
    const getMerchantId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: merchant } = await supabase
        .from('gateway_merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (merchant) setMerchantId(merchant.id);
    };
    getMerchantId();
  });

  // Fetch locations for merchant
  const { data: locations } = useQuery({
    queryKey: ['merchant-locations', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data } = await supabase
        .from('merchant_locations')
        .select('*')
        .eq('merchant_id', merchantId);
      return data || [];
    },
    enabled: !!merchantId,
  });

  const defaultLocation = locations?.[0];

  // Fetch inventory
  const { data: inventory, isLoading, refetch } = useQuery({
    queryKey: ['business-inventory', merchantId, defaultLocation?.id, search],
    queryFn: async () => {
      if (!merchantId || !defaultLocation) return [];

      const { data, error } = await supabase.functions.invoke('pos-inventory', {
        body: {
          merchant_id: merchantId,
          location_id: defaultLocation.id,
          search: search || undefined,
          limit: 100,
          offset: 0,
        },
      });

      if (error) throw error;
      return data?.inventory || [];
    },
    enabled: !!merchantId && !!defaultLocation,
  });

  const handleAdjustInventory = async () => {
    if (!selectedItem || !adjustmentQty) return;

    const qtyDelta = parseInt(adjustmentQty);
    if (isNaN(qtyDelta)) {
      toast.error('Invalid quantity');
      return;
    }

    const { error } = await supabase.functions.invoke('pos-inventory', {
      method: 'POST',
      body: {
        merchant_id: merchantId,
        variant_id: selectedItem.variant_id,
        location_id: selectedItem.location_id,
        quantity_delta: qtyDelta,
        type: 'manual_adjust',
        reason: adjustmentReason || 'Manual adjustment',
      },
    });

    if (error) {
      toast.error('Failed to adjust inventory');
    } else {
      toast.success('Inventory updated');
      setSelectedItem(null);
      setAdjustmentQty('');
      setAdjustmentReason('');
      refetch();
    }
  };

  const lowStockItems = inventory?.filter((item: any) => item.available_quantity < 10) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
        <h1 className="text-2xl font-bold mb-2">Inventory</h1>
        <p className="text-primary-foreground/80 text-sm mb-4">Track stock levels</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="p-3 bg-white/10 border-white/20">
            <p className="text-xs text-primary-foreground/70 mb-1">Total Items</p>
            <p className="text-2xl font-bold">{inventory?.length || 0}</p>
          </Card>
          <Card className="p-3 bg-white/10 border-white/20">
            <p className="text-xs text-primary-foreground/70 mb-1">Low Stock</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{lowStockItems.length}</p>
              {lowStockItems.length > 0 && (
                <AlertTriangle className="h-5 w-5 text-yellow-300" />
              )}
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SKU or product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
      </div>

      {/* Inventory List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : inventory?.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No inventory found</h3>
            <p className="text-muted-foreground">Add products to start tracking stock</p>
          </Card>
        ) : (
          inventory?.map((item: any) => {
            const isLowStock = item.available_quantity < 10;
            return (
              <Card key={item.id} className={`p-4 ${isLowStock ? 'border-yellow-500' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">
                      {item.pos_product_variants?.pos_products?.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {item.pos_product_variants?.name}
                    </p>
                    {item.pos_product_variants?.sku && (
                      <p className="text-xs text-muted-foreground mt-1">
                        SKU: {item.pos_product_variants.sku}
                      </p>
                    )}
                  </div>
                  {isLowStock && (
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="text-lg font-bold">{item.available_quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reserved</p>
                    <p className="text-lg font-bold">{item.reserved_quantity}</p>
                  </div>
                  <div className="ml-auto">
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="text-sm font-semibold">
                      {item.pos_product_variants?.price.toLocaleString()} FCFA
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedItem(item)}
                  className="w-full"
                >
                  Adjust Stock
                </Button>
              </Card>
            );
          })
        )}
      </div>

      {/* Adjustment Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Quantity Change</label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAdjustmentQty('-10')}
                  className="flex-1"
                >
                  <TrendingDown className="h-4 w-4 mr-1" />
                  -10
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAdjustmentQty('-1')}
                  className="flex-1"
                >
                  -1
                </Button>
                <Input
                  type="number"
                  placeholder="0"
                  value={adjustmentQty}
                  onChange={(e) => setAdjustmentQty(e.target.value)}
                  className="w-24 text-center"
                />
                <Button
                  variant="outline"
                  onClick={() => setAdjustmentQty('+1')}
                  className="flex-1"
                >
                  +1
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAdjustmentQty('+10')}
                  className="flex-1"
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  +10
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Reason (optional)</label>
              <Input
                placeholder="e.g. Stock count, damaged goods..."
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
              />
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm">
                Current: <span className="font-bold">{selectedItem?.available_quantity}</span>
              </p>
              {adjustmentQty && !isNaN(parseInt(adjustmentQty)) && (
                <p className="text-sm">
                  New: <span className="font-bold">
                    {selectedItem?.available_quantity + parseInt(adjustmentQty)}
                  </span>
                </p>
              )}
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustInventory} disabled={!adjustmentQty}>
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
