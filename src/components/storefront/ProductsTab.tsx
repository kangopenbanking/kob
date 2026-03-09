import React, { useState, useEffect } from 'react';
import { Package, Search, Loader2, Tag, AlertCircle, Plus, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface ProductsTabProps {
  merchantId: string | null;
  currency: string;
}

export function ProductsTab({ merchantId, currency }: ProductsTabProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const loadProducts = async () => {
    if (!merchantId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('pos_products')
        .select('*, pos_product_variants(*)', { count: 'exact' })
        .eq('merchant_id', merchantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);

      if (search) query = query.ilike('name', `%${search}%`);

      const { data, count, error } = await query;
      if (error) throw error;
      setProducts(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, [merchantId, search]);

  if (!merchantId) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          No merchant account found. Register as a merchant first.
        </CardContent>
      </Card>
    );
  }

  const getLowestPrice = (variants: any[]) => {
    if (!variants?.length) return 0;
    return Math.min(...variants.map((v: any) => v.price || 0));
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Your Products
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} product{total !== 1 ? 's' : ''} in your catalog
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-9 h-9 w-56 rounded-lg text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadProducts} className="gap-1.5 h-9">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!loading && products.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No products yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create products using the Demo Store tab, or connect your WooCommerce store to import products automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Product grid */}
      {!loading && products.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const variants = product.pos_product_variants || [];
            const price = getLowestPrice(variants);
            const variantCount = variants.length;

            return (
              <Card key={product.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                      {product.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{product.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm font-bold text-foreground">
                          {formatPrice(price)} {currency}
                        </span>
                        {variantCount > 1 && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            {variantCount} variants
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-[10px] h-5 capitalize">
                          {product.source}
                        </Badge>
                        {product.tax_class && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            <Tag className="w-2.5 h-2.5 mr-1" /> {product.tax_class}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Variants list */}
                  {variants.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                      {variants.slice(0, 3).map((v: any) => (
                        <div key={v.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate max-w-[60%]">{v.name}</span>
                          <span className="font-medium text-foreground">{formatPrice(v.price)} {currency}</span>
                        </div>
                      ))}
                      {variants.length > 3 && (
                        <p className="text-[10px] text-muted-foreground">+{variants.length - 3} more variants</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
