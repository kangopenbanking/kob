import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, Store, ShoppingBag, Loader2, Heart, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const categories = ['All Categories', 'Fashion', 'Electronics', 'Food', 'Beauty', 'Health & Wellness', 'Home', 'Services'];

const CustomerStores: React.FC = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState([0, 100000]);
  const [minRating, setMinRating] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'name'>('rating');

  useEffect(() => {
    fetchStores();
  }, [search, selectedCategory, sortBy]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      // Step 1: Get merchant_ids with active subscriptions
      const { data: activeSubs } = await supabase
        .from('pos_store_subscriptions')
        .select('merchant_id')
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString());

      const activeSubMerchantIds = (activeSubs || []).map(s => s.merchant_id);

      if (activeSubMerchantIds.length === 0) {
        setStores([]);
        setLoading(false);
        return;
      }

      // Step 2: Query stores that are published, approved, AND have active subscription
      let query = supabase.from('pos_store_profiles')
        .select('*')
        .eq('is_published', true)
        .in('status', ['approved']) // only moderation-approved stores
        .in('merchant_id', activeSubMerchantIds);

      if (search) query = query.or(`store_name.ilike.%${search}%,description.ilike.%${search}%`);
      if (selectedCategory !== 'All Categories') query = query.ilike('category', `%${selectedCategory}%`);
      if (minRating > 0) query = query.gte('rating', minRating);

      query = sortBy === 'rating'
        ? query.order('rating', { ascending: false })
        : query.order('store_name', { ascending: true });

      const { data } = await query;
      setStores(data || []);
    } catch (err) {
      console.error('Failed to fetch stores:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavourite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavourites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Stores</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Browse & shop from local merchants</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/app/cart')}
            className="relative p-2.5 rounded-full bg-primary/10 text-primary"
          >
            <ShoppingBag className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-muted/50 border-border/50"
          />
        </div>
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-card">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold text-primary">Filter</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              {/* Search in filter */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Search</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Type to search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 rounded-lg bg-muted/50 text-sm"
                  />
                </div>
              </div>

              {/* Product categories */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Product categories</p>
                <div className="space-y-2">
                  {categories.filter(c => c !== 'All Categories').map(cat => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedCategory === cat}
                        onCheckedChange={() => setSelectedCategory(selectedCategory === cat ? 'All Categories' : cat)}
                      />
                      <span className="text-sm text-muted-foreground">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Rating</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setMinRating(star === minRating ? 0 : star)}
                      className="text-lg"
                    >
                      <Star
                        className={`w-5 h-5 ${star <= minRating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={() => { fetchStores(); setFilterOpen(false); }} className="w-full rounded-xl">
                Apply Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Active filter tags */}
      {(selectedCategory !== 'All Categories' || minRating > 0) && (
        <div className="flex gap-1.5 flex-wrap">
          {selectedCategory !== 'All Categories' && (
            <Badge variant="secondary" className="gap-1 text-xs rounded-full px-2.5 py-0.5">
              {selectedCategory}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategory('All Categories')} />
            </Badge>
          )}
          {minRating > 0 && (
            <Badge variant="secondary" className="gap-1 text-xs rounded-full px-2.5 py-0.5">
              {minRating}★ & up
              <X className="w-3 h-3 cursor-pointer" onClick={() => setMinRating(0)} />
            </Badge>
          )}
        </div>
      )}

      {/* Sort */}
      <div className="flex justify-end">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="text-xs text-muted-foreground bg-transparent border-none cursor-pointer focus:outline-none"
        >
          <option value="rating">Sort by Rating</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Store grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-16">
          <Store className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No stores found</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {stores.map((store, i) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              onClick={() => navigate(`/app/stores/${store.merchant_id}`)}
              className="group bg-card border border-border/50 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
            >
              {/* Image */}
              <div className="relative">
                {store.banner_url ? (
                  <img src={store.banner_url} alt="" className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 flex items-center justify-center">
                    <Store className="w-8 h-8 text-primary/30" />
                  </div>
                )}
                {/* Favourite heart */}
                <button
                  onClick={(e) => toggleFavourite(store.id, e)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm"
                >
                  <Heart className={`w-3.5 h-3.5 ${favourites.has(store.id) ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                </button>
                {/* Rating badge */}
                {store.rating > 0 && (
                  <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-background/80 backdrop-blur-sm rounded-full px-1.5 py-0.5">
                    <span className="text-[10px] font-bold text-foreground">{store.rating.toFixed(1)}/5</span>
                    <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-3">
                <div className="flex items-start gap-2">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 ring-1 ring-border" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Store className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{store.store_name}</p>
                    {store.category && (
                      <p className="text-[10px] text-muted-foreground">{store.category}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {store.city || 'Douala'}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerStores;
