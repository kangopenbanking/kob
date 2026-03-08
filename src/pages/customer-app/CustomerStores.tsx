import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, Store, ChevronRight, Loader2, ShoppingBag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

const CustomerStores: React.FC = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = ['Food', 'Fashion', 'Electronics', 'Beauty', 'Services', 'Other'];

  useEffect(() => {
    fetchStores();
  }, [search, selectedCategory]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { action: 'stores' };
      if (search) params.search = search;
      if (selectedCategory) params.category = selectedCategory;

      const { data, error } = await supabase.functions.invoke('pos-store-browse', {
        body: null,
        headers: {},
      });
      
      // Use direct query since GET params work differently with invoke
      let query = supabase.from('pos_store_profiles')
        .select('*')
        .eq('is_published', true)
        .order('rating', { ascending: false });

      if (search) query = query.or(`store_name.ilike.%${search}%,description.ilike.%${search}%`);
      if (selectedCategory) query = query.ilike('category', `%${selectedCategory}%`);

      const { data: storeData } = await query;
      setStores(storeData || []);
    } catch (err) {
      console.error('Failed to fetch stores:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Stores</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Browse & shop from local merchants</p>
        </div>
        <button
          onClick={() => navigate('/app/cart')}
          className="relative p-2 rounded-full bg-primary/10 text-primary"
        >
          <ShoppingBag className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search stores..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-muted/50 border-border/50"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            !selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {cat}
          </button>
        ))}
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
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {stores.map((store, i) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/app/stores/${store.merchant_id}`)}
              className="bg-card border border-border/50 rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            >
              {store.banner_url ? (
                <img src={store.banner_url} alt="" className="w-full h-24 object-cover" />
              ) : (
                <div className="w-full h-24 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Store className="w-8 h-8 text-primary/40" />
                </div>
              )}
              <div className="p-3">
                <div className="flex items-start gap-2">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Store className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{store.store_name}</p>
                    {store.category && (
                      <p className="text-[10px] text-muted-foreground">{store.category}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {store.city || 'Douala'}
                  </div>
                  {store.rating > 0 && (
                    <div className="flex items-center gap-0.5 text-[10px] text-amber-500">
                      <Star className="w-3 h-3 fill-current" />
                      {store.rating.toFixed(1)}
                    </div>
                  )}
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
