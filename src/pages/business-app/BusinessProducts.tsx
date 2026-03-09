import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Filter, Package, Edit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function BusinessProducts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // Get merchant ID from auth
  useState(() => {
    const getMerchantId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: merchant } = await supabase
        .from('gateway_merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (merchant) setMerchantId(merchant.id);
    };
    getMerchantId();
  });

  // Fetch products
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['business-products', merchantId, search, statusFilter],
    queryFn: async () => {
      if (!merchantId) return [];

      let query = supabase
        .from('pos_products')
        .select(`
          *,
          pos_product_variants(*)
        `)
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!merchantId,
  });

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase
      .from('pos_products')
      .delete()
      .eq('id', productId);

    if (error) {
      toast.error('Failed to delete product');
    } else {
      toast.success('Product deleted');
      refetch();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground rounded-b-3xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Products</h1>
              <p className="text-primary-foreground/80 text-sm mt-1">Manage your catalog</p>
            </div>
            <Button
              onClick={() => navigate('/business/products/new')}
              className="bg-white text-primary hover:bg-white/90 rounded-2xl h-11 px-5 shadow-sm"
            >
              <Plus className="h-5 w-5 mr-2" strokeWidth={2} />
              Add
            </Button>
          </div>

          {/* Search & Filters */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Button variant="outline" className="bg-white">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 mt-4">
            {['all', 'active', 'draft'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-primary'
                    : 'text-primary-foreground/70 hover:text-primary-foreground'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : products?.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-6">Start building your catalog</p>
            <Button onClick={() => navigate('/business/products/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Product
            </Button>
          </Card>
        ) : (
          products?.map((product: any) => (
            <Card key={product.id} className="p-4">
              <div className="flex gap-4">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold truncate">{product.name}</h3>
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        product.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Variants</p>
                      <p className="font-semibold text-sm">
                        {product.pos_product_variants?.length || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Price from</p>
                      <p className="font-semibold text-sm">
                        {product.pos_product_variants?.[0]?.price.toLocaleString()} FCFA
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/business/products/${product.id}`)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(product.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
