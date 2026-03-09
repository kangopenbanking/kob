import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Filter, Package, Edit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate, useParams } from 'react-router-dom';
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
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 h-12 bg-white text-foreground rounded-2xl border-0 shadow-sm"
              />
            </div>
            <Button variant="outline" className="bg-white text-foreground h-12 w-12 rounded-2xl border-0 shadow-sm p-0 flex items-center justify-center">
              <Filter className="h-5 w-5" strokeWidth={1.5} />
            </Button>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 mt-5 overflow-x-auto pb-1 hide-scrollbar">
            {['all', 'active', 'draft'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                  statusFilter === status
                    ? 'bg-white text-primary shadow-sm'
                    : 'bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20'
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
          <Card className="p-12 text-center border-0 shadow-md">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 mx-auto mb-5">
              <Package className="h-10 w-10 text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-8 text-sm">Start building your catalog</p>
            <Button className="rounded-2xl h-12 px-6 font-bold" onClick={() => navigate('/business/products/new')}>
              <Plus className="h-5 w-5 mr-2" strokeWidth={2} />
              Add First Product
            </Button>
          </Card>
        ) : (
          products?.map((product: any) => (
            <Card key={product.id} className="p-5 border-0 shadow-sm cursor-pointer hover:shadow-md transition-all">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center shrink-0">
                  <Package className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-foreground truncate">{product.name}</h3>
                      {product.description && (
                         <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                           {product.description}
                         </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                        product.status === 'active'
                          ? 'bg-[hsl(150,40%,90%)] text-[hsl(150,40%,30%)]'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {product.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-5 mt-3">
                    <div className="bg-muted/50 rounded-xl px-3 py-1.5 flex-1">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Variants</p>
                      <p className="font-bold text-sm text-foreground mt-0.5">
                        {product.pos_product_variants?.length || 0}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-xl px-3 py-1.5 flex-1">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Price from</p>
                      <p className="font-bold text-sm text-foreground mt-0.5 whitespace-nowrap">
                        {new Intl.NumberFormat('fr-CM').format(product.pos_product_variants?.[0]?.price || 0)} FCFA
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl flex-1 h-9 font-bold text-xs"
                      onClick={(e) => { e.stopPropagation(); navigate(`/business/products/${product.id}`); }}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                      className="rounded-xl h-9 px-3 text-[hsl(0,60%,50%)] hover:bg-[hsl(0,60%,95%)] hover:text-[hsl(0,60%,40%)]"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
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
