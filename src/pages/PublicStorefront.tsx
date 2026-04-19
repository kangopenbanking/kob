import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Store, MapPin, Star, ShoppingBag, Clock, Package, ArrowLeft, Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

export default function PublicStorefront() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!merchantId) return;
    loadStore();
  }, [merchantId]);

  useEffect(() => {
    if (!merchantId) return;
    loadProducts();
  }, [merchantId, search]);

  const loadStore = async () => {
    setLoading(true);
    try {
      // Public storefront visibility must match the in-app marketplace rule:
      // published + moderation-approved.
      const { data } = await supabase
        .from('pos_store_profiles')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('is_published', true)
        .eq('status', 'approved')
        .maybeSingle();
      setStore(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      let query = supabase
        .from('pos_products')
        .select('*, pos_product_variants(*)')
        .eq('merchant_id', merchantId!)
        .eq('status', 'active')
        .order('name')
        .limit(100);

      if (search) query = query.ilike('name', `%${search}%`);

      const { data } = await query;
      setProducts(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0 }).format(amount);

  const getLowestPrice = (variants: any[]) => {
    if (!variants?.length) return 0;
    return Math.min(...variants.map((v: any) => v.price || 0));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <Store className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-lg font-bold text-foreground">Store Not Found</h1>
          <p className="text-sm text-muted-foreground mt-1">This store may not be published or does not exist.</p>
          <Link to="/">
            <Button variant="outline" className="mt-4 gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const currency = store.currency || 'XAF';

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      <div className="relative h-48 sm:h-64 bg-muted">
        {store.banner_url ? (
          <img src={store.banner_url} alt="Store banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/20 flex items-center justify-center">
            <Store className="w-16 h-16 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      </div>

      {/* Store info */}
      <div className="max-w-5xl mx-auto px-4 -mt-16 relative z-10">
        <div className="flex items-end gap-4">
          <div className="w-20 h-20 rounded-2xl border-4 border-background overflow-hidden bg-muted shadow-md flex-shrink-0">
            {store.logo_url ? (
              <img src={store.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <Store className="w-8 h-8 text-primary" />
              </div>
            )}
          </div>
          <div className="pb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{store.store_name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {store.category && <Badge variant="secondary" className="text-xs">{store.category}</Badge>}
              {store.city && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" /> {store.city}, {store.country || 'CM'}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {store.rating?.toFixed(1) || '4.8'}
              </span>
            </div>
          </div>
        </div>

        {store.description && (
          <p className="text-sm text-muted-foreground mt-4 max-w-2xl leading-relaxed">{store.description}</p>
        )}

        {/* Search */}
        <div className="mt-6 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-10 h-10 rounded-xl"
            />
          </div>
          <Badge variant="outline" className="text-xs h-10 px-4">
            <ShoppingBag className="w-3.5 h-3.5 mr-1.5" /> {products.length} products
          </Badge>
        </div>

        {/* Products */}
        <div className="mt-6 pb-12">
          {products.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No products available</p>
                <p className="text-xs text-muted-foreground mt-1">This store hasn't listed any products yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => {
                const variants = product.pos_product_variants || [];
                const price = getLowestPrice(variants);
                return (
                  <Card key={product.id} className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <CardContent className="p-0">
                      <div className="h-32 bg-primary/5 flex items-center justify-center">
                        <Package className="w-8 h-8 text-primary/30" />
                      </div>
                      <div className="p-4">
                        <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                        {product.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-base font-bold text-foreground">
                            {formatPrice(price)} {currency}
                          </span>
                          {variants.length > 1 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {variants.length} variants
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
