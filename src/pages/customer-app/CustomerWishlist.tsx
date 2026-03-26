import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Heart, Store, Package, Trash2, ShoppingCart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

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
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const merchantIds = (favorites || []).map((f: any) => f.merchant_id).filter(Boolean);
      let merchants: any[] = [];
      if (merchantIds.length > 0) {
        const { data: m } = await supabase
          .from('gateway_merchants')
          .select('id, business_name')
          .in('id', merchantIds);
        merchants = m || [];
      }

      return (favorites || []).map((fav: any) => ({
        ...fav,
        merchant: merchants.find((m: any) => m.id === fav.merchant_id),
      }));
    },
  });

  const { data: wishlistProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['wishlist-products', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: wishlist, error } = await (supabase as any)
        .from('customer_wishlist_items')
        .select('id, created_at, product_id')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const productIds = (wishlist || []).map((w: any) => w.product_id).filter(Boolean);
      let products: any[] = [];
      let images: any[] = [];
      if (productIds.length > 0) {
        const { data: p } = await (supabase as any)
          .from('pos_products')
          .select('id, name, description, merchant_id')
          .in('id', productIds);
        products = p || [];

        const { data: img } = await (supabase as any)
          .from('pos_product_images')
          .select('product_id, url')
          .in('product_id', productIds);
        images = img || [];
      }

      return (wishlist || []).map((item: any) => ({
        ...item,
        product: {
          ...products.find((p: any) => p.id === item.product_id),
          images: images.filter((img: any) => img.product_id === item.product_id),
        },
      }));
    },
  });

  const handleRemoveStore = async (favoriteId: string) => {
    const { error } = await (supabase as any)
      .from('customer_favorite_merchants')
      .delete()
      .eq('id', favoriteId);

    if (!error) {
      toast({ title: 'Removed', description: 'Store removed from favorites' });
      refetchStores();
    }
  };

  const handleRemoveProduct = async (wishlistId: string) => {
    const { error } = await (supabase as any)
      .from('customer_wishlist_items')
      .delete()
      .eq('id', wishlistId);

    if (!error) {
      toast({ title: 'Removed', description: 'Item removed from wishlist' });
      refetchProducts();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20">
        <Card className="p-12 text-center max-w-md mx-auto mt-20">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to view your wishlist</p>
          <Button onClick={() => navigate('/app/auth')}>Sign In</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-xl bg-card p-2"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="text-2xl font-bold">My Wishlist</h1>
            <p className="text-muted-foreground">Saved stores and products</p>
          </div>
        </div>

        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Products ({wishlistProducts?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="stores">
              <Store className="h-4 w-4 mr-2" />
              Stores ({favoriteStores?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4 mt-6">
            {wishlistProducts && wishlistProducts.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {wishlistProducts.map((item: any) => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="aspect-square bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      {item.product?.images?.[0]?.url ? (
                        <img src={item.product.images[0].url} alt={item.product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-16 w-16 text-muted-foreground" />
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold">{item.product?.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.product?.description}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => navigate(`/app/product/${item.product?.id}`)}>
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveProduct(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No products in your wishlist yet</p>
                <Button className="mt-4" onClick={() => navigate('/app/marketplace')}>Browse Products</Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stores" className="space-y-4 mt-6">
            {favoriteStores && favoriteStores.length > 0 ? (
              <div className="space-y-4">
                {favoriteStores.map((fav: any) => (
                  <Card key={fav.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                        <Store className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{fav.merchant?.business_name || 'Store'}</h3>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => navigate(`/app/store/${fav.merchant?.id}`)}>Visit</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveStore(fav.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No favorite stores yet</p>
                <Button className="mt-4" onClick={() => navigate('/app/marketplace')}>Discover Stores</Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
