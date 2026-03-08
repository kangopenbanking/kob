import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Store, MapPin, Star, ShoppingBag, Plus, Minus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

const CustomerStoreDetail: React.FC = () => {
  const { merchantId } = useParams<{ merchantId: string }>();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

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
          .select('*, pos_product_variants(*), pos_product_images(image_url)')
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
    if (!user || !merchantId) return;
    setAddingToCart(variantId);
    try {
      const { error } = await supabase.functions.invoke('pos-consumer-cart', {
        body: { action: 'add', merchant_id: merchantId, variant_id: variantId, quantity: 1 },
      });
      if (error) throw error;
      toast.success('Added to cart');
      setCartCount(prev => prev + 1);
    } catch (err: any) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(null);
    }
  };

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
    <div className="pb-24">
      {/* Header / Banner */}
      <div className="relative">
        {store.banner_url ? (
          <img src={store.banner_url} alt="" className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-primary/30 to-primary/5" />
        )}
        <button
          onClick={() => navigate('/app/stores')}
          className="absolute top-4 left-4 p-2 rounded-full bg-background/80 backdrop-blur-sm"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Store info */}
      <div className="px-4 -mt-8 relative z-10">
        <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">{store.store_name}</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />{store.city || 'Douala'}
                </span>
                {store.rating > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-500">
                    <Star className="w-3 h-3 fill-current" />{store.rating.toFixed(1)}
                  </span>
                )}
                {store.category && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{store.category}</span>
                )}
              </div>
            </div>
          </div>
          {store.description && (
            <p className="text-xs text-muted-foreground mt-3">{store.description}</p>
          )}
        </div>
      </div>

      {/* Products */}
      <div className="px-4 mt-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Products ({products.length})</h2>
        {products.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No products available</p>
        ) : (
          <div className="space-y-3">
            {products.map((product, i) => {
              const variants = product.pos_product_variants || [];
              const image = product.pos_product_images?.[0]?.image_url;
              const minPrice = variants.length ? Math.min(...variants.map((v: any) => v.price)) : 0;

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border/50 rounded-xl p-3 flex gap-3"
                >
                  {image ? (
                    <img src={image} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    {product.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{product.description}</p>
                    )}
                    <p className="text-sm font-bold text-primary mt-1">
                      {minPrice.toLocaleString()} XAF
                      {variants.length > 1 && <span className="text-[10px] font-normal text-muted-foreground ml-1">+</span>}
                    </p>
                    {/* Variant buttons */}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {variants.map((v: any) => (
                        <Button
                          key={v.id}
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2 rounded-lg"
                          disabled={addingToCart === v.id}
                          onClick={() => addToCart(v.id)}
                        >
                          {addingToCart === v.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3 mr-0.5" />
                          )}
                          {v.name} · {v.price.toLocaleString()}
                        </Button>
                      ))}
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
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-lg"
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            View Cart ({cartCount} items)
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default CustomerStoreDetail;
