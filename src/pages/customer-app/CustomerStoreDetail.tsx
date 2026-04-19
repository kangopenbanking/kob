import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Store, MapPin, Star, ShoppingBag, Plus, Heart, Loader2, Grid3X3, List, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const CustomerStoreDetail: React.FC = () => {
  const { merchantId } = useParams<{ merchantId: string }>();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  useEffect(() => {
    if (merchantId) {
      fetchStoreAndProducts();
      fetchCartCount();
    }
  }, [merchantId]);

  const fetchStoreAndProducts = async () => {
    setLoading(true);
    try {
      const [storeRes, productsRes] = await Promise.all([
        supabase.from('pos_store_profiles')
          .select('*').eq('merchant_id', merchantId!).eq('is_published', true).single(),
        supabase.from('pos_products')
          .select('*, pos_product_variants(*), pos_product_images(url)')
          .eq('merchant_id', merchantId!)
          .eq('status', 'active')
          .order('name'),
      ]);
      setStore(storeRes.data);
      setProducts(productsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCartCount = async () => {
    if (!user) return;
    const { data } = await supabase.from('pos_consumer_carts')
      .select('pos_consumer_cart_items(quantity)')
      .eq('user_id', user.id)
      .eq('merchant_id', merchantId!)
      .eq('status', 'active')
      .maybeSingle();
    const total = (data?.pos_consumer_cart_items || []).reduce((s: number, i: any) => s + i.quantity, 0);
    setCartCount(total);
  };

  const addToCart = async (variantId: string) => {
    if (!user) {
      toast.error('Please sign in to add items to your cart');
      return;
    }
    if (!merchantId) return;
    setAddingToCart(variantId);
    try {
      const { error } = await supabase.functions.invoke('pos-consumer-cart', {
        body: { action: 'add', merchant_id: merchantId, variant_id: variantId, quantity: 1 },
      });
      if (error) throw error;
      toast.success('Item added to your cart 🛒');
      setCartCount(prev => prev + 1);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Could not add item to cart. Please try again.'));
    } finally {
      setAddingToCart(null);
    }
  };

  const filteredProducts = products.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="px-4 pt-6 text-center">
        <Store className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Store not found</p>
        <Button variant="ghost" onClick={() => navigate('/app/stores')} className="mt-4">Back to Stores</Button>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* Header Banner */}
      <div className="relative">
        {store.banner_url ? (
          <img src={store.banner_url} alt="" className="w-full h-44 object-cover" />
        ) : (
          <div className="w-full h-44 bg-gradient-to-br from-primary/30 via-primary/15 to-accent/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <button
          onClick={() => navigate('/app/stores')}
          className="absolute top-4 left-4 p-2 rounded-full bg-background/80 backdrop-blur-sm shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <button className="absolute top-4 right-4 p-2 rounded-full bg-background/80 backdrop-blur-sm shadow-sm">
          <Heart className="w-4 h-4 text-primary" />
        </button>
      </div>

      {/* Store info card */}
      <div className="px-4 -mt-12 relative z-10">
        <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover ring-2 ring-primary/20" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="w-6 h-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">{store.store_name}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />{store.city || 'Douala'}
                </span>
                {store.rating > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-500 font-medium">
                    <Star className="w-3 h-3 fill-current" />{store.rating.toFixed(1)}
                  </span>
                )}
                {store.category && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">{store.category}</Badge>
                )}
              </div>
            </div>
          </div>
          {store.description && (
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{store.description}</p>
          )}
        </div>
      </div>

      {/* Tabs: Details / Products */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Products</h2>
            <Badge variant="outline" className="text-[10px] rounded-full">{filteredProducts.length}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Product search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 rounded-xl bg-muted/50 border-border/50 text-sm"
          />
        </div>

        {filteredProducts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No products available</p>
        ) : viewMode === 'grid' ? (
          /* Grid View — inspired by reference images */
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product, i) => {
              const variants = product.pos_product_variants || [];
              const image = product.pos_product_images?.[0]?.url;
              const minPrice = variants.length ? Math.min(...variants.map((v: any) => v.price)) : 0;
              const maxPrice = variants.length ? Math.max(...variants.map((v: any) => v.price)) : 0;
              const defaultVariant = variants[0];

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border/50 rounded-2xl overflow-hidden group hover:shadow-lg transition-all"
                >
                  {/* Product image */}
                  <div className="relative aspect-square bg-muted/30">
                    {image ? (
                      <img src={image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <button className="absolute top-2 right-2 p-1 rounded-full bg-background/80 backdrop-blur-sm">
                      <Heart className="w-3 h-3 text-muted-foreground" />
                    </button>
                    {variants.length > 1 && (
                      <Badge className="absolute top-2 left-2 text-[9px] px-1.5 py-0 bg-amber-400 text-amber-900 hover:bg-amber-400">
                        {variants.length} variants
                      </Badge>
                    )}
                  </div>
                  {/* Product info */}
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      {minPrice !== maxPrice ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground line-through">{maxPrice.toLocaleString()}</span>
                          <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 flex items-center gap-0.5">
                            <ShoppingBag className="w-2.5 h-2.5" />
                            {minPrice.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 flex items-center gap-0.5">
                          <ShoppingBag className="w-2.5 h-2.5" />
                          {minPrice.toLocaleString()} XAF
                        </span>
                      )}
                    </div>
                    {/* Quick add button */}
                    {defaultVariant && (
                      <Button
                        size="sm"
                        className="w-full mt-2 h-7 text-[10px] rounded-lg gap-1"
                        disabled={addingToCart === defaultVariant.id}
                        onClick={(e) => { e.stopPropagation(); addToCart(defaultVariant.id); }}
                      >
                        {addingToCart === defaultVariant.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                        Add to Cart
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* List View — inspired by cart reference image */
          <div className="space-y-2.5">
            {filteredProducts.map((product, i) => {
              const variants = product.pos_product_variants || [];
              const image = product.pos_product_images?.[0]?.url;
              const minPrice = variants.length ? Math.min(...variants.map((v: any) => v.price)) : 0;

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border/50 rounded-xl p-3 flex gap-3"
                >
                  {image ? (
                    <img src={image} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    {product.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <Badge variant="outline" className="text-xs font-bold text-primary border-primary/30 rounded-full px-2">
                        {minPrice.toLocaleString()} XAF
                      </Badge>
                      <div className="flex gap-1">
                        {variants.slice(0, 2).map((v: any) => (
                          <Button
                            key={v.id}
                            size="sm"
                            variant="outline"
                            className="h-6 text-[9px] px-2 rounded-lg"
                            disabled={addingToCart === v.id}
                            onClick={() => addToCart(v.id)}
                          >
                            {addingToCart === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
                            {v.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-20 left-0 right-0 max-w-lg mx-auto px-4 z-50"
        >
          <Button
            onClick={() => navigate('/app/cart')}
            className="w-full h-12 rounded-2xl font-semibold shadow-lg gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            View Cart ({cartCount} items)
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default CustomerStoreDetail;
