import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, Star, Store, ShoppingBag, Loader2, Heart,
  SlidersHorizontal, X, Sparkles, TrendingUp, ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

const CATEGORIES = ['All', 'Fashion', 'Electronics', 'Food', 'Beauty', 'Health', 'Home', 'Services'];

const CustomerStores: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'name'>('rating');
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('customer_favorite_merchants')
        .select('merchant_id')
        .eq('user_id', user.id);
      if (data) setFavourites(new Set(data.map((f: any) => f.merchant_id)));

      const { data: cart } = await supabase
        .from('pos_consumer_carts')
        .select('pos_consumer_cart_items(quantity)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      const total = (cart?.pos_consumer_cart_items || []).reduce((s: number, i: any) => s + i.quantity, 0);
      setCartCount(total);
    })();
  }, [user]);

  useEffect(() => {
    fetchStores();
  }, [search, selectedCategory, sortBy, minRating]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const { data: activeSubs } = await supabase
        .from('pos_store_subscriptions')
        .select('merchant_id')
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString());

      const ids = (activeSubs || []).map(s => s.merchant_id);
      if (!ids.length) { setStores([]); setLoading(false); return; }

      let q = supabase.from('pos_store_profiles').select('*')
        .eq('is_published', true).in('status', ['approved']).in('merchant_id', ids);
      if (search) q = q.or(`store_name.ilike.%${search}%,description.ilike.%${search}%`);
      if (selectedCategory !== 'All') q = q.ilike('category', `%${selectedCategory}%`);
      if (minRating > 0) q = q.gte('rating', minRating);
      q = sortBy === 'rating' ? q.order('rating', { ascending: false }) : q.order('store_name', { ascending: true });

      const { data } = await q;
      setStores(data || []);
    } catch (err) {
      console.error('Failed to fetch stores:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavourite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error('Please sign in to save favorites'); return; }
    const isFav = favourites.has(id);
    setFavourites(prev => {
      const next = new Set(prev);
      isFav ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      if (isFav) {
        await (supabase as any).from('customer_favorite_merchants')
          .delete().eq('user_id', user.id).eq('merchant_id', id);
      } else {
        const { error } = await (supabase as any).from('customer_favorite_merchants')
          .insert({ user_id: user.id, merchant_id: id });
        if (error && error.code !== '23505') throw error;
      }
    } catch {
      setFavourites(prev => {
        const next = new Set(prev);
        isFav ? next.add(id) : next.delete(id);
        return next;
      });
      toast.error('Could not update favorite');
    }
  };

  const featured = useMemo(() => stores.slice(0, 5), [stores]);
  const rest = useMemo(() => {
  const tr = useHarvestedT('customer');tr('stores.slice(5), [stores]);

  return
    <div className="pb-28 bg-gradient-to-b from-muted/30 via-background to-background min-h-screen">
      {/* ─── Premium hero ─── */}
      <div className="px-5 pt-7 pb-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Discover</p>
            <h1 className="text-[28px] leading-tight font-bold text-foreground tracking-tight mt-0.5">
              Shop nearby
            </h1>
          </div>
          <button
            onClick={() => navigate('/app/cart
            className="relative h-11 w-11 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-center hover:shadow-md transition-shadow"
          >
            <ShoppingBag className="w-[18px] h-[18px] text-foreground" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search bar — soft pill */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
            <Input
              placeholder="Search stores, brands, products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-4 h-12 rounded-2xl bg-card border-border/60 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40"
            />
          </div>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl shrink-0 border-border/60 bg-card shadow-sm">
                <SlidersHorizontal className="w-[18px] h-[18px]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-card">
              <SheetHeader>
                <SheetTitle className="text-lg font-bold">Refine</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-7">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Category</p>
                  <div className="space-y-2.5">
                    {CATEGORIES.filter(c => c !== 'All').map(cat => (
                      <label key={cat} className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={selectedCategory === cat}
                          onCheckedChange={() => setSelectedCategory(selectedCategory === cat ? 'All' : cat)}
                        />
                        <span className="text-sm text-foreground">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Minimum Rating</p>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setMinRating(star === minRating ? 0 : star)}>
                        <Star className={`w-6 h-6 ${star <= minRating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Sort by</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['rating', 'name'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setSortBy(opt)}
                        className={`h-10 rounded-xl text-sm font-medium capitalize transition ${
                          sortBy === opt ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={() => setFilterOpen(false)} className="w-full h-12 rounded-2xl">
                  Apply
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* ─── Category pills ─── */}
      <div className="flex gap-2 overflow-x-auto pb-3 px-5 no-scrollbar snap-x">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 h-9 rounded-full text-[13px] font-semibold whitespace-nowrap snap-start transition-all ${
              selectedCategory === cat
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-card text-muted-foreground border border-border/60'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Active filters */}
      {minRating > 0 && (
        <div className="px-5 pb-3">
          <Badge variant="secondary" className="gap-1 text-xs rounded-full px-3 py-1">
            {minRating}★ & up
            <X className="w-3 h-3 cursor-pointer" onClick={() => setMinRating(0)} />
          </Badge>
        </div>
      )}

      {/* ─── Loading / empty ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-20 px-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <Store className="w-7 h-7 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-semibold text-foreground">No stores found</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different search or filter</p>
        </div>
      ) : (
        <>
          {/* Featured carousel */}
          {featured.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between px-5 mb-3">
                <h2 className="text-[15px] font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Featured
                </h2>
                <button className="text-xs font-medium text-muted-foreground flex items-center">
                  See all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto px-5 pb-2 no-scrollbar snap-x">
                {featured.map((store, i) => (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/app/stores/${store.merchant_id}`)}
                    className="relative flex-shrink-0 w-[78%] sm:w-[60%] snap-start cursor-pointer rounded-3xl overflow-hidden shadow-lg ring-1 ring-border/40 group"
                  >
                    {store.banner_url ? (
                      <img src={store.banner_url} alt="" className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-44 bg-gradient-to-br from-primary/30 via-primary/15 to-accent/10 flex items-center justify-center">
                        <Store className="w-10 h-10 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                    <button
                      onClick={(e) => toggleFavourite(store.id, e)}
                      className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-sm"
                    >
                      <Heart className={`w-4 h-4 ${favourites.has(store.id) ? 'text-rose-500 fill-rose-500' : 'text-foreground'}`} />
                    </button>

                    {store.rating > 0 && (
                      <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/95 backdrop-blur rounded-full px-2.5 py-1 shadow-sm">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-[11px] font-bold text-foreground">{store.rating.toFixed(1)}</span>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <div className="flex items-center gap-2.5">
                        {store.logo_url ? (
                          <img src={store.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover ring-2 ring-white/80" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                            <Store className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-bold truncate leading-tight">{store.store_name}</p>
                          <p className="text-[11px] opacity-85 truncate">
                            {store.category || 'Store'} · {store.city || 'Douala'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* All stores grid */}
          {rest.length > 0 && (
            <div className="px-5 mt-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-bold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  All stores
                </h2>
                <span className="text-[11px] text-muted-foreground font-medium">{rest.length} found</span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {rest.map((store, i) => (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.3 }}
                    onClick={() => navigate(`/app/stores/${store.merchant_id}`)}
                    className="bg-card rounded-3xl overflow-hidden cursor-pointer ring-1 ring-border/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <div className="relative">
                      {store.banner_url ? (
                        <img src={store.banner_url} alt="" className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 flex items-center justify-center">
                          <Store className="w-8 h-8 text-primary/30" />
                        </div>
                      )}
                      <button
                        onClick={(e) => toggleFavourite(store.id, e)}
                        className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-sm"
                      >
                        <Heart className={`w-3.5 h-3.5 ${favourites.has(store.id) ? 'text-rose-500 fill-rose-500' : 'text-foreground'}`} />
                      </button>
                      {store.rating > 0 && (
                        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-white/95 backdrop-blur rounded-full px-2 py-0.5">
                          <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                          <span className="text-[10px] font-bold text-foreground">{store.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-[13px] font-bold text-foreground truncate leading-tight">{store.store_name}</p>
                      {store.category && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{store.category}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                        <MapPin className="w-2.5 h-2.5" />
                        <span className="truncate">{store.city || 'Douala'}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerStores;
