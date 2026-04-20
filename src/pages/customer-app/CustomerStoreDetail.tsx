import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Store, MapPin, Star, ShoppingBag, Plus, Heart, Loader2,
  Grid3X3, List, Search, Share2, Clock, Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
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
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    if (merchantId) { fetchStoreAndProducts(); fetchCartCount(); }
  }, [merchantId]);

  const fetchStoreAndProducts = async () => {
    setLoading(true);
    try {
      const [storeRes, productsRes] = await Promise.all([
        supabase.from('pos_store_profiles')
          .select('*').eq('merchant_id', merchantId!).eq('is_published', true).single(),
        supabase.from('pos_products')
          .select('*, pos_product_variants(*), pos_product_images(url)')
          .eq('merchant_id', merchantId!).eq('status', 'active').order('name'),
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
      .eq('user_id', user.id).eq('merchant_id', merchantId!).eq('status', 'active').maybeSingle();
    const total = (data?.pos_consumer_cart_items || []).reduce((s: number, i: any) => s + i.quantity, 0);
    setCartCount(total);
  };

  const addToCart = async (variantId: string) => {
    if (!user) { toast.error('Please sign in to add items to your cart'); return; }
    if (!merchantId) return;
    setAddingToCart(variantId);
    try {
      const { error } = await supabase.functions.invoke('pos-consumer-cart', {
        body: { action: 'add', merchant_id: merchantId, variant_id: variantId, quantity: 1 },
      });
      if (error) throw error;
      toast.success('Added to cart');
      setCartCount(prev => prev + 1);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Could not add item to cart.'));
    } finally {
      setAddingToCart(null);
    }
  };

  const productCategories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  const filteredProducts = products.filter(p =>
    (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (activeCategory === 'All' || p.category === activeCategory)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="px-4 pt-12 text-center">
        <Store className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Store not found</p>
        <Button variant="ghost" onClick={() => navigate('/app/stores className="mt-4">Back to Stores</Button>
      </div>
    );
  }

  return (
    <div className="pb-32 bg-gradient-to-b from-background to-muted/20 min-h-screen">
      {/* ─── Hero banner ─── */}
      <div className="relative">
        {store.banner_url ? (
          <img src={store.banner_url} alt="" className="w-full h-56 object-cover" />
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-primary/40 via-primary/20 to-accent/15" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

        <button
          onClick={() => navigate('/app/stores
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-white/95 backdrop-blur shadow-sm flex items-center justify-center"
        >
          <ArrowLeft className="w-[18px] h-[18px] text-foreground" />
        </button>
        <div className="absolute top-4 right-4 flex gap-2">
          <button className="h-10 w-10 rounded-full bg-white/95 backdrop-blur shadow-sm flex items-center justify-center">
            <Share2 className="w-[16px] h-[16px] text-foreground" />
          </button>
          <button className="h-10 w-10 rounded-full bg-white/95 backdrop-blur shadow-sm flex items-center justify-center">
            <Heart className="w-[16px] h-[16px] text-rose-500" />
          </button>
        </div>
      </div>

      {/* ─── Store header card ─── */}
      <div className="px-5 -mt-20 relative z-10">
        <div className="bg-card rounded-3xl p-5 shadow-xl ring-1 ring-border/40">
          <div className="flex items-start gap-4">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-background shadow-md -mt-10" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center ring-2 ring-background shadow-md -mt-10">
                <Store className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0 pt-0.5">
              <h1 className="text-[20px] leading-tight font-bold text-foreground tracking-tight truncate">{store.store_name}</h1>
              <div className="flex items-center gap-3 mt-1.5 text-[12px] text-muted-foreground">
                {store.rating > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />{store.rating.toFixed(1)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{store.city || 'Douala'}
                </span>
                {store.category && (
                  <Badge variant="secondary" className="text-[10px] rounded-full font-medium">{store.category}</Badge>
                )}
              </div>
            </div>
          </div>
          {store.description && (
            <p className="text-[12.5px] text-muted-foreground mt-4 leading-relaxed line-clamp-3">{store.description}</p>
          )}

          {/* Quick info row */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-medium text-foreground">Open now</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Truck className="w-3.5 h-3.5 text-primary" />
              <span>Delivery in 30–60 min</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search ─── */}
      <div className="px-5 mt-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-muted-foreground" />
          <Input
            placeholder="Search products in this store…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-11 rounded-2xl bg-card border-border/60 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* ─── Category pills ─── */}
      {productCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 px-5 mt-3 no-scrollbar snap-x">
          {productCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 h-8 rounded-full text-[12px] font-semibold whitespace-nowrap snap-start transition-all ${
                activeCategory === cat
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-card text-muted-foreground border border-border/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ─── View toggle ─── */}
      <div className="px-5 mt-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">
          Products <span className="text-muted-foreground font-medium">· {filteredProducts.length}</span>
        </h2>
        <div className="flex items-center gap-1 bg-card border border-border/60 rounded-xl p-1">
          <button
            onClick={() => setViewMode('grid
            className={`h-7 w-7 rounded-lg flex items-center justify-center transition ${
              viewMode === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list
            className={`h-7 w-7 rounded-lg flex items-center justify-center transition ${
              viewMode === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Products ─── */}
      <div className="px-5 mt-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
              <ShoppingBag className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-semibold text-foreground">No products yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Check back soon</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3.5">
            {filteredProducts.map((product, i) => {
              const variants = product.pos_product_variants || [];
              const image = product.pos_product_images?.[0]?.url;
              const minPrice = variants.length ? Math.min(...variants.map((v: any) => v.price)) : 0;
              const maxPrice = variants.length ? Math.max(...variants.map((v: any) => {
  const tr = useHarvestedT('customer');tr('v.price)) : 0;
              const defaultVariant = variants[0];

              return
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="bg-card rounded-3xl overflow-hidden ring-1 ring-border/40 hover:shadow-lg transition-all duration-300"
                >
                  <div className="relative aspect-square bg-muted/30">
                    {image ? (
                      <img src={image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-9 h-9 text-muted-foreground/30" />
                      </div>
                    )}
                    <button className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-sm">
                      <Heart className="w-3.5 h-3.5 text-foreground" />
                    </button>
                    {variants.length > 1 && (
                      <Badge className="absolute top-2.5 left-2.5 text-[9px] px-2 py-0 rounded-full bg-foreground text-background hover:bg-foreground">
                        {variants.length} options
                      </Badge>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[13px] font-semibold text-foreground line-clamp-1 leading-tight">{product.name}</p>
                    <div className="flex items-baseline gap-1.5 mt-1.5">
                      <span className="text-[14px] font-bold text-foreground">{minPrice.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">XAF</span>
                      {minPrice !== maxPrice && (
                        <span className="text-[10px] text-muted-foreground">+</span>
                      )}
                    </div>
                    {defaultVariant && (
                      <Button
                        size="sm"
                        className="w-full mt-2.5 h-8 text-[11px] rounded-xl gap-1 font-semibold"
                        disabled={addingToCart === defaultVariant.id}
                        onClick={(e) => { e.stopPropagation(); addToCart(defaultVariant.id); }}
                      >
                        {addingToCart === defaultVariant.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <><Plus className="w-3 h-3" />Add</>
                        )}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product, i) => {
              const variants = product.pos_product_variants || [];
              const image = product.pos_product_images?.[0]?.url;
              const minPrice = variants.length ? Math.min(...variants.map((v: any) => {
  const tr = useHarvestedT('customer');tr('v.price)) : 0;
              const defaultVariant = variants[0];

              return
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="bg-card rounded-2xl p-3 flex gap-3 ring-1 ring-border/40 items-center"
                >
                  {image ? (
                    <img src={image} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{product.name}</p>
                    {product.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-sm font-bold text-foreground">
                        {minPrice.toLocaleString()} <span className="text-[10px] text-muted-foreground font-medium">XAF</span>
                      </span>
                      {defaultVariant && (
                        <Button
                          size="sm"
                          className="h-8 px-3 text-[11px] rounded-xl gap-1 font-semibold"
                          disabled={addingToCart === defaultVariant.id}
                          onClick={() => addToCart(defaultVariant.id)}
                        >
                          {addingToCart === defaultVariant.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <><Plus className="w-3 h-3" />Add</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Floating cart bar ─── */}
      {cartCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-20 left-0 right-0 max-w-lg mx-auto px-4 z-50"
        >
          <Button
            onClick={() => navigate('/app/cart
            className="w-full h-13 rounded-2xl font-semibold shadow-2xl gap-2 bg-foreground text-background hover:bg-foreground/90 py-3.5"
          >
            <ShoppingBag className="w-4 h-4" />
            View cart · {cartCount} {cartCount === 1 ? 'item' : 'items'}
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default CustomerStoreDetail;
