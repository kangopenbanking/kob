import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Store, Eye, EyeOff, MapPin, Star, Search, Loader2, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';
import { SafeImage } from "@/components/common/SafeImage";

export function AdminStorefrontSlider() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['admin-storefronts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_store_profiles')
        .select('*, gateway_merchants(business_name, user_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const togglePublished = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase.from('pos_store_profiles').update({ is_published }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-storefronts'] });
      toast.success('Store visibility updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  const filtered = stores.filter((s: any) =>
    s.store_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase()) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  const publishedCount = stores.filter((s: any) => s.is_published).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" /> Storefront Management
            </CardTitle>
            <CardDescription>Manage merchant storefronts visible on the consumer app homepage slider</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{stores.length} stores</Badge>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{publishedCount} live</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Consumer App Preview */}
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Consumer App Homepage Preview — Store Slider</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stores.filter((s: any) => s.is_published).slice(0, 6).map((store: any) => (
              <div key={store.id} className="flex-shrink-0 w-44 rounded-xl overflow-hidden border border-border/40 bg-background shadow-sm">
                <div className="h-20 bg-muted relative">
                  {store.banner_url ? (
                    <SafeImage src={store.banner_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center">
                      <Store className="w-6 h-6 text-[hsl(var(--fi-purple))]/30" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    {store.logo_url ? (
                      <SafeImage src={store.logo_url} alt="" className="w-5 h-5 rounded-md object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-md bg-muted flex items-center justify-center">
                        <Store className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-[11px] font-semibold text-foreground truncate">{store.store_name}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="w-2.5 h-2.5" />
                    <span className="truncate">{store.city || 'N/A'}</span>
                    <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 ml-auto" />
                    <span>{store.rating?.toFixed(1) || '4.8'}</span>
                  </div>
                </div>
              </div>
            ))}
            {publishedCount === 0 && (
              <div className="flex-shrink-0 w-full py-6 text-center text-xs text-muted-foreground">
                No published stores. Toggle stores below to show them on the consumer app.
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stores..." className="pl-9 h-9 text-xs" />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Store</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Location</TableHead>
                  <TableHead className="text-xs">Rating</TableHead>
                  <TableHead className="text-xs">Published</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((store: any) => (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {store.logo_url ? (
                          <SafeImage src={store.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <Store className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold">{store.store_name}</p>
                          <p className="text-[10px] text-muted-foreground">{(store as any).gateway_merchants?.business_name || '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {store.category ? <Badge variant="secondary" className="text-[10px]">{store.category}</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" /> {store.city || '—'}, {store.country}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        {store.rating?.toFixed(1) || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={store.is_published}
                        onCheckedChange={(checked) => togglePublished.mutate({ id: store.id, is_published: checked })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                      No stores found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
