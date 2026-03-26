import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SearchFilter } from '@/components/SearchFilter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MapPin, Store, Heart, Share2, Package, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { SocialShare } from '@/components/customer-app/SocialShare';
import { getCanonicalUrl } from '@/config/api';

export function CustomerMarketplace() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'rating' | 'newest' | 'popular'>('rating');
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch published stores
  const { data: stores, isLoading } = useQuery({
    queryKey: ['marketplace-stores', searchTerm, selectedCity, selectedCategory, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (selectedCity !== 'all') params.set('city', selectedCity);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      params.set('limit', '20');

      const { data, error } = await supabase.functions.invoke('pos-store-browse', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (error) throw error;
      return data?.stores || [];
    },
  });

  const handleToggleFavorite = async (merchantId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Please sign in', description: 'Sign in to save favorites', variant: 'destructive' });
      return;
    }

    const { error } = await (supabase as any).from('customer_favorite_merchants').insert({
      user_id: user.id,
      merchant_id: merchantId,
    });

    if (error && error.code !== '23505') {
      toast({ title: 'Error', description: 'Could not save favorite', variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Store added to favorites' });
    }
  };

  const cityOptions = [
    { label: 'Douala', value: 'douala' },
    { label: 'Yaoundé', value: 'yaounde' },
    { label: 'Bamenda', value: 'bamenda' },
    { label: 'Limbe', value: 'limbe' },
  ];

  const categoryOptions = [
    { label: 'Retail', value: 'retail' },
    { label: 'Food & Beverage', value: 'food_beverage' },
    { label: 'Services', value: 'services' },
    { label: 'Electronics', value: 'electronics' },
  ];

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-xl bg-card p-2"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="text-2xl font-bold">Discover Stores</h1>
            <p className="text-muted-foreground">Browse local merchants and shops</p>
          </div>
        </div>

        {/* Search & Filters */}
        <Card className="p-4 space-y-4">
          <SearchFilter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder="Search stores..."
            filterOptions={cityOptions}
            selectedFilter={selectedCity}
            onFilterChange={setSelectedCity}
          />
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
            >
              All
            </Button>
            {categoryOptions.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2 text-sm">
            <span className="text-muted-foreground">Sort:</span>
            {['rating', 'newest', 'popular'].map((sort) => (
              <button
                key={sort}
                onClick={() => setSortBy(sort as any)}
                className={`capitalize ${sortBy === sort ? 'font-bold text-primary' : 'text-muted-foreground'}`}
              >
                {sort}
              </button>
            ))}
          </div>
        </Card>

        {/* Store Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-64 animate-pulse bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {stores?.map((store: any) => (
              <Card
                key={store.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/app/store/${store.merchant_id}`)}
              >
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt={store.store_name} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-16 w-16 text-muted-foreground" />
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{store.store_name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{store.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(store.merchant_id);
                        }}
                      >
                        <Heart className="h-4 w-4" />
                      </Button>
                      <SocialShare
                        title={store.store_name}
                        text={store.description}
                        url={getCanonicalUrl(`/app/store/${store.merchant_id}`)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {store.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{store.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {store.city && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{store.city}</span>
                      </div>
                    )}
                    {store.product_count > 0 && (
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        <span>{store.product_count}</span>
                      </div>
                    )}
                  </div>

                  {store.category && (
                    <Badge variant="secondary" className="text-xs">
                      {store.category}
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && stores?.length === 0 && (
          <Card className="p-12 text-center">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No stores found matching your criteria</p>
          </Card>
        )}
      </div>
    </div>
  );
}
