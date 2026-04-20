import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Heart, Store, Package, Trash2, ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

export function CustomerWishlist() {
  const { user } = useCustomerAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: favoriteStores, refetch: refetchStores } = useQuery({
    queryKey: ['favorite-stores', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: favorites, error } = await (supabase as any)
        .from('customer_favorite_merchants')
        .select('id, created_at, merchant_id')
        .eq('user_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      const merchantIds = (favorites || []).map((f: any) => f.merchant_id).filter(Boolean);
      let merchants: any[] = [];
      if (merchantIds.length > 0) {
        const { data: m } = await supabase.from('gateway_merchants').select('id, business_name').in('id', merchantIds);
        merchants = m || [];
      }
      return (favorites || []).map((fav: any) => ({ ...fav, merchant: merchants.find((m: any) => m.id === fav.merchant_id) }));
    },
  });

  const { data: wishlistProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['wishlist-products', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: wishlist, error } = await (supabase as any)
        .from('customer_wishlist_items').select('id, created_at, product_id')
        .eq('user_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      const productIds = (wishlist || []).map((w: any) => w.product_id).filter(Boolean);
      let products: any[] = []; let images: any[] = [];
      if (productIds.length > 0) {
        const { data: p } = await (supabase as any).from('pos_products').select('id, name, description, merchant_id').in('id', productIds);
        products = p || [];
        const { data: img } = await (supabase as any).from('pos_product_images').select('product_id, url').in('product_id', productIds);
        images = img || [];
      }
      return (wishlist || []).map((item: any) => ({
        ...item,
        product: { ...products.find((p: any) => p.id === item.product_id), images: images.filter((img: any) => img.product_id === item.product_id) },
      }));
    },
  });

  const handleRemoveStore = async (favoriteId: string) => {
    const { error } = await (supabase as any).from('customer_favorite_merchants').delete().eq('id', favoriteId);
    if (!error) { toast({ title: 'Removed', description: 'Store removed from favorites' }); refetchStores(); }
  };

  const handleRemoveProduct = async (wishlistId: string) => {
    const { error } = await (supabase as any).from('customer_wishlist_items').delete().eq('id', wishlistId);
    if (!error) { toast({ title: 'Removed', description: 'Item removed from wishlist' }); refetchProducts(); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background flex items-center justify-center px-6">
        <div className="bg-card rounded-3xl p-10 text-center max-w-sm w-full ring-1 ring-border/40 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 flex items-center justify-center mb-4">
            <Heart className="h-6 w-6 text-rose-500" />
          </div>
          <h2 className="text-lg font-bold tracking-tight mb-1">Sign in required</h2>
          <p className="text-sm text-muted-foreground mb-5">Save your favorite shops and products</p>
          <Button onClick={() => navigate('/app/auth')} className="w-full h-11 rounded-2xl font-semibold">Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="px-5 pt-7">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-center">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Saved</p>
            <h1 className="text-[22px] font-bold tracking-tight leading-tight">Wishlist</h1>
          </div>
        </div>

        <Tabs defaultValue="products" className="w-full mt-5">
          <TabsList className="grid w-full grid-cols-2 bg-card border border-border/60 rounded-2xl p-1 h-11">
            <TabsTrigger value="products" className="rounded-xl text-[13px] font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background">
              <Package className="h-3.5 w-3.5 mr-1.5" />Products ({wishlistProducts?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="stores" className="rounded-xl text-[13px] font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background">
              <Store className="h-3.5 w-3.5 mr-1.5" />Stores ({favoriteStores?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-5">
            {wishlistProducts && wishlistProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3.5">
                {wishlistProducts.map((item: any, i: number) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="bg-card rounded-3xl overflow-hidden ring-1 ring-border/40 group"
                  >
                    <div className="aspect-square bg-muted/30 relative">
                      {item.product?.images?.[0]?.url ? (
                        <img src={item.product.images[0].url} alt={item.product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center"><Package className="h-9 w-9 text-muted-foreground/40" /></div>
                      )}
                      <button
                        onClick={() => handleRemoveProduct(item.id)}
                        className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-sm"
                      >
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="text-[13px] font-semibold text-foreground line-clamp-1">{item.product?.name}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{item.product?.description}</p>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/app/stores/${item.product?.merchant_id}`)}
                        className="w-full h-8 mt-2.5 text-[11px] rounded-xl font-semibold"
                      >
                        View store
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyCard icon={Package} label="No products saved yet" cta="Browse marketplace" onClick={() => navigate('/app/stores')} />
            )}
          </TabsContent>

          <TabsContent value="stores" className="mt-5 space-y-3">
            {favoriteStores && favoriteStores.length > 0 ? (
              favoriteStores.map((fav: any, i: number) => (
                <motion.div
                  key={fav.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-2xl p-4 ring-1 ring-border/40 flex items-center gap-4"
                >
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Store className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{fav.merchant?.business_name || 'Store'}</p>
                    <p className="text-[11px] text-muted-foreground">Saved</p>
                  </div>
                  <button
                    onClick={() => navigate(`/app/stores/${fav.merchant?.id}`)}
                    className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"
                  >
                    <ChevronRight className="h-4 w-4 text-foreground" />
                  </button>
                  <button
                    onClick={() => handleRemoveStore(fav.id)}
                    className="text-muted-foreground/60 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ))
            ) : (
              <EmptyCard icon={Store} label="No favorite stores yet" cta="Discover stores" onClick={() => navigate('/app/stores')} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyCard({ icon: Icon, label, cta, onClick }: { icon: any; label: string; cta: string; onClick: () => void }) {
  return (
    <div className="bg-card rounded-3xl p-12 text-center ring-1 ring-border/40 mt-2">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <Button onClick={onClick} className="mt-5 h-11 px-6 rounded-2xl font-semibold">{cta}</Button>
    </div>
  );
}
