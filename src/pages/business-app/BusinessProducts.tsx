import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Package, Edit, Trash2, ImageIcon, Grid3X3, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PageGuide } from '@/components/business-app/PageGuide';

export default function BusinessProducts() {
  const navigate = useNavigate();
  const { merchantId } = useMerchantContext();
  const isMobile = useIsMobile();
  const basePath = '/biz';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['business-products', merchantId, search, statusFilter],
    queryFn: async () => {
      if (!merchantId) return [];
      let query = supabase
        .from('pos_products')
        .select('*, pos_product_variants(*)')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      if (search) query = query.ilike('name', `%${search}%`);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!merchantId,
  });

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const { error } = await supabase.from('pos_products').delete().eq('id', productId);
    if (error) toast.error('Could not delete product. It may be referenced in active orders.');
    else { toast.success('Product removed from your catalog'); refetch(); }
  };

  const formatPrice = (n: number) => new Intl.NumberFormat('fr-CM').format(n);

  return (
    <div className="space-y-4 px-5 md:px-0 pt-4 pb-6">
      <PageGuide
        title="Products"
        summary="Build and maintain your catalog — add items, set prices, manage variants, and toggle availability."
        steps={[
          { title: 'Add a product', description: 'Tap New product to enter a name, price, photos, and inventory details.' },
          { title: 'Search and filter', description: 'Find items quickly with the search bar or by Active / Draft status.' },
          { title: 'Edit or remove', description: 'Open any product to update details, change variants, or archive it.' },
        ]}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Products</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            {products?.length || 0} item{(products?.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <div className="flex rounded-xl border border-border/50 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn('p-2 transition-colors', viewMode === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/60')}
              >
                <Grid3X3 className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn('p-2 transition-colors', viewMode === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/60')}
              >
                <List className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          )}
          <Button
            onClick={() => navigate(`${basePath}/products/new`)}
            size="sm"
            className="rounded-full h-9 px-4 gap-1.5 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Add
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={2} />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 rounded-xl border-border/50 bg-muted/40 text-sm"
        />
      </div>

      {/* Status filters */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1">
        {(['all', 'active', 'draft'] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
              statusFilter === status
                ? 'bg-foreground text-background'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted',
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Product Grid / List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-foreground/20 border-t-foreground" />
        </div>
      ) : products?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
            <Package className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold mb-1">No products yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Start building your catalog</p>
          <Button
            className="rounded-full h-10 px-6 font-semibold bg-foreground text-background hover:bg-foreground/90"
            onClick={() => navigate(`${basePath}/products/new`)}
          >
            <Plus className="h-4 w-4 mr-1.5" strokeWidth={2.5} /> Add First Product
          </Button>
        </div>
      ) : viewMode === 'list' && !isMobile ? (
        /* Desktop List View */
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-left">
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Variants</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Price</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {products?.map((product: any) => (
                <tr key={product.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      <span className="font-semibold text-foreground">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      product.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground',
                    )}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{product.pos_product_variants?.length || 0}</td>
                  <td className="px-4 py-3 font-bold text-foreground text-right">
                    {formatPrice(product.pos_product_variants?.[0]?.price || 0)} <span className="text-[10px] font-medium text-muted-foreground">FCFA</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => navigate(`${basePath}/products/${product.id}`)}>
                        <Edit className="h-3.5 w-3.5" strokeWidth={2} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => handleDelete(product.id)}>
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View (mobile default + desktop option) */
        <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4')}>
          {products?.map((product: any, i: number) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              className="group"
            >
              <div className="rounded-2xl border border-border/40 bg-card overflow-hidden transition-all hover:border-border/80 hover:shadow-sm">
                <div className="aspect-square bg-muted/40 flex items-center justify-center relative">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/30" strokeWidth={1.5} />
                  <span className={cn(
                    'absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                    product.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground',
                  )}>
                    {product.status}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-[13px] font-bold text-foreground truncate">{product.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {product.pos_product_variants?.length || 0} variant{(product.pos_product_variants?.length || 0) !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm font-bold text-foreground mt-2">
                    {formatPrice(product.pos_product_variants?.[0]?.price || 0)} <span className="text-[10px] font-medium text-muted-foreground">FCFA</span>
                  </p>
                  <div className="flex gap-1.5 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-xl h-8 text-[11px] font-semibold border-border/50"
                      onClick={(e) => { e.stopPropagation(); navigate(`${basePath}/products/${product.id}`); }}
                    >
                      <Edit className="h-3 w-3 mr-1" strokeWidth={2} /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
