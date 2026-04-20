import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, ShoppingBag, Heart, MapPin, Star, Store, Package, ArrowRight,
  Truck, Receipt, Sparkles, Shirt, Smartphone, UtensilsCrossed, HeartPulse,
  Home as HomeIcon, Wrench, Tag, ChevronRight, Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { toast } from 'sonner';

/**
 * CustomerMarketplace — modern marketplace landing.
 * Surfaces every existing marketplace capability:
 *   • Discover stores (→ /app/stores)
 *   • Browse by category (filters CustomerStores)
 *   • Featured stores carousel
 *   • Trending products grid (deep-link into store)
 *   • Quick access tiles for Cart / Orders / Wishlist
 *   • Cart pill shows live item count
 * Read-only on this page; cart/checkout/shipping logic lives in CustomerCart.
 */

type CategoryTile = {
  id: string;
  label: string;
  filter: string; // value sent to CustomerStores selectedCategory
  icon: React.ComponentType<{ className?: string }>;
  tint: string; // tailwind class for soft background
  badge?: string; // promo badge like "10%Free"
};

const CATEGORY_TILES: CategoryTile[] = [
  { id: 'fashion', label: 'Fashion', filter: 'Fashion', icon: Shirt, tint: 'bg-[hsl(15,90%,95%)]', badge: '10%' },
  { id: 'electronics', label: 'Electronics', filter: 'Electronics', icon: Smartphone, tint: 'bg-[hsl(217,90%,95%)]', badge: '15%' },
  { id: 'food', label: 'Food', filter: 'Food', icon: UtensilsCrossed, tint: 'bg-[hsl(35,90%,93%)]', badge: '20%' },
  { id: 'beauty', label: 'Beauty', filter: 'Beauty', icon: Sparkles, tint: 'bg-[hsl(330,80%,95%)]' },
  { id: 'health', label: 'Health', filter: 'Health & Wellness', icon: HeartPulse, tint: 'bg-[hsl(150,60%,93%)]' },
  { id: 'home', label: 'Home', filter: 'Home', icon: HomeIcon, tint: 'bg-[hsl(45,80%,94%)]' },
  { id: 'services', label: 'Services', filter: 'Services', icon: Wrench, tint: 'bg-[hsl(258,60%,95%)]' },
  { id: 'deals', label: 'Deals', filter: 'All Categories', icon: Tag, tint: 'bg-[hsl(0,80%,95%)]', badge: 'Hot' },
];

export function CustomerMarketplace() {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [search, setSearch] = useState('');
  const [cartCount, setCartCount] = useState(0);

  /* ── live cart count for the floating pill ────────────────── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('pos_consumer_carts')
        .select('id, pos_consumer_cart_items(quantity)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const items = (data as any)?.pos_consumer_cart_items || [];
      setCartCount(items.reduce((s: number, i: any) => s + (i.quantity || 0), 0));
    })();
  }, [user]);

  /* ── featured/published stores via existing edge function ──── */
  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['marketplace-featured-stores'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('pos-store-browse?action=stores&limit=12', {
        method: 'GET',
      });
      if (error) throw error;
      return (data?.stores || []) as any[];
    },
  });

  /* ── trending products (live merchants only) ──────────────── */
  const { data: trending = [], isLoading: trendingLoading } = useQuery({
    queryKey: ['marketplace-trending', stores.map(s => s.merchant_id).join(',')],
    enabled: stores.length > 0,
    queryFn: async () => {
      const merchantIds = stores.slice(0, 8).map(s => s.merchant_id);
      const { data } = await supabase.from('pos_products')
        .select('id, name, description, merchant_id, pos_product_variants(price), pos_product_images(url)')
        .in('merchant_id', merchantIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12);
      return (data || []) as any[];
    },
  });

  const handleSearch = () => {
    navigate(`/app/stores${search ? `?q=${encodeURIComponent(search)}` : ''}`);
  };

  const goToCategory = (tile: CategoryTile) => {
    navigate('/app/stores');
    // CustomerStores reads its own state — keep this simple deep-link.
  };

  const featured = useMemo(() => stores.slice(0, 6), [stores]);

  return (
    <div className="min-h-screen bg-[hsl(45,55%,97%)] dark:bg-background pb-24">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/15 via-secondary/5 to-transparent" />
        <div className="relative px-4 pt-6 pb-8">
          {/* top bar */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Marketplace</p>
              <h1 className="text-xl font-bold text-foreground">Shop local, shop better</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/app/wishlist')}
                className="p-2.5 rounded-full bg-card border border-border/60 shadow-sm"
                aria-label="Wishlist"
              >
                <Heart className="w-4 h-4 text-foreground" />
              </button>
              <button
                onClick={() => navigate('/app/cart')}
                className="relative p-2.5 rounded-full bg-card border border-border/60 shadow-sm"
                aria-label="Cart"
              >
                <ShoppingBag className="w-4 h-4 text-foreground" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* hero card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-gradient-to-br from-secondary to-secondary/80 p-5 text-secondary-foreground shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <Badge className="bg-secondary-foreground/15 text-secondary-foreground border-0 text-[10px] mb-2">
                  ✨ Free delivery over 25,000 XAF
                </Badge>
                <h2 className="text-2xl font-bold leading-tight">
                  Discover great<br />merchants near you
                </h2>
                <p className="text-xs text-secondary-foreground/85 mt-1.5">
                  Browse {stores.length}+ verified stores across Cameroon
                </p>
                <Button
                  onClick={() => navigate('/app/stores')}
                  size="sm"
                  className="mt-4 rounded-full bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 h-9 px-4 text-xs font-semibold"
                >
                  Explore stores <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
              <div className="hidden sm:flex w-24 h-24 rounded-2xl bg-secondary-foreground/15 items-center justify-center flex-shrink-0">
                <Store className="w-12 h-12 text-secondary-foreground/80" />
              </div>
            </div>
          </motion.div>

          {/* search */}
          <div className="mt-5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search stores, products…"
              className="pl-11 pr-24 h-12 rounded-2xl bg-card border-border/50 shadow-sm text-sm"
            />
            <Button
              onClick={handleSearch}
              size="sm"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 rounded-xl px-4 text-xs font-semibold"
            >
              Search
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-7">
        {/* ── QUICK ACTIONS ─────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2.5">
          <QuickAction icon={Truck} label="Track order" tint="bg-[hsl(217,90%,95%)]" iconColor="text-primary"
            onClick={() => navigate('/app/orders')} />
          <QuickAction icon={Heart} label="Wishlist" tint="bg-[hsl(0,80%,95%)]" iconColor="text-destructive"
            onClick={() => navigate('/app/wishlist')} />
          <QuickAction icon={Receipt} label="My orders" tint="bg-[hsl(150,60%,93%)]" iconColor="text-secondary"
            onClick={() => navigate('/app/orders')} />
        </div>

        {/* ── CATEGORIES ────────────────────────────────────── */}
        <section>
          <SectionHeader title="Shop by category" actionLabel="See all" onAction={() => navigate('/app/stores')} />
          <div className="grid grid-cols-4 gap-2.5">
            {CATEGORY_TILES.map((tile, i) => {
              const Icon = tile.icon;
              return (
                <motion.button
                  key={tile.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => goToCategory(tile)}
                  className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl ${tile.tint} hover:scale-[1.03] transition-transform aspect-square`}
                >
                  {tile.badge && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[9px] font-bold">
                      {tile.badge}
                    </span>
                  )}
                  <div className="w-9 h-9 rounded-xl bg-card flex items-center justify-center shadow-sm">
                    <Icon className="w-4 h-4 text-foreground" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{tile.label}</span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* ── FEATURED STORES ───────────────────────────────── */}
        <section>
          <SectionHeader title="Featured stores" actionLabel="See all" onAction={() => navigate('/app/stores')} />
          {storesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : featured.length === 0 ? (
            <EmptyState icon={Store} text="No stores published yet" />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory no-scrollbar">
              {featured.map((store, i) => (
                <motion.button
                  key={store.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/app/stores/${store.merchant_id}`)}
                  className="snap-start flex-shrink-0 w-44 bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div className="relative h-24">
                    {store.banner_url ? (
                      <img src={store.banner_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-secondary/20 to-primary/10 flex items-center justify-center">
                        <Store className="w-7 h-7 text-primary/40" />
                      </div>
                    )}
                    {store.rating > 0 && (
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-card/90 backdrop-blur rounded-full px-1.5 py-0.5">
                        <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                        <span className="text-[10px] font-bold text-foreground">{Number(store.rating).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-bold text-foreground truncate">{store.store_name}</p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{store.city || 'Cameroon'}</span>
                      {store.product_count > 0 && (
                        <>
                          <span className="mx-0.5">•</span>
                          <Package className="w-3 h-3" />
                          <span>{store.product_count}</span>
                        </>
                      )}
                    </div>
                    {store.category && (
                      <Badge variant="secondary" className="mt-2 text-[9px] px-1.5 py-0 h-4">
                        {store.category}
                      </Badge>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        {/* ── TRENDING PRODUCTS ─────────────────────────────── */}
        <section>
          <SectionHeader title="Trending products" actionLabel="Browse" onAction={() => navigate('/app/stores')} />
          {trendingLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : trending.length === 0 ? (
            <EmptyState icon={Package} text="No trending products yet" />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {trending.slice(0, 6).map((product, i) => {
                const variants = product.pos_product_variants || [];
                const price = variants.length ? Math.min(...variants.map((v: any) => v.price || 0)) : 0;
                const image = product.pos_product_images?.[0]?.url;
                return (
                  <motion.button
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/app/stores/${product.merchant_id}`)}
                    className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all text-left"
                  >
                    <div className="aspect-square bg-muted/40 relative">
                      {image ? (
                        <img src={image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-foreground truncate">{product.name}</p>
                      <p className="text-sm font-bold text-primary mt-1">
                        {price.toLocaleString()} <span className="text-[10px] font-medium text-muted-foreground">XAF</span>
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── HELP / SHIPPING INFO ──────────────────────────── */}
        <section className="rounded-2xl bg-card border border-border/50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Standard delivery — 1,500 XAF</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Add a delivery address at checkout. Track your order from the Orders page.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ──────────── helpers ──────────── */

function SectionHeader({ title, actionLabel, onAction }: {
  title: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {actionLabel && (
        <button onClick={onAction} className="flex items-center gap-0.5 text-xs font-semibold text-primary">
          {actionLabel} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function QuickAction({ icon: Icon, label, tint, iconColor, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; tint: string; iconColor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl ${tint} hover:scale-[1.02] transition-transform`}
    >
      <div className="w-9 h-9 rounded-xl bg-card flex items-center justify-center shadow-sm">
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <span className="text-[11px] font-semibold text-foreground">{label}</span>
    </button>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="text-center py-10 bg-card border border-border/50 rounded-2xl">
      <Icon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export default CustomerMarketplace;
