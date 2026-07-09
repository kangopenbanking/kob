import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Search, Loader2, Tag, Plus, RefreshCw, Pencil, Trash2, X,
  Image as ImageIcon, Upload, Save, ChevronDown, ChevronUp, Layers, SlidersHorizontal,
  DollarSign, BarChart3, Hash,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { POSAttribute } from '@/lib/storefront-data';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { SafeImage } from "@/components/common/SafeImage";

interface ProductsTabProps {
  merchantId: string | null;
  currency: string;
  standardAttributes?: POSAttribute[];
  customAttributes?: { key: string; label: string }[];
}

interface ProductImage {
  id?: string;
  url: string;
  sort_order: number;
  file?: File;
  preview?: string;
}

interface VariantForm {
  id?: string;
  name: string;
  price: string;
  sku: string;
  barcode: string;
  cost_price: string;
  compare_at_price: string;
  attributes: Record<string, string>;
}

const emptyVariant = (): VariantForm => ({
  name: 'Default', price: '', sku: '', barcode: '', cost_price: '', compare_at_price: '', attributes: {},
});

export function ProductsTab({ merchantId, currency, standardAttributes = [], customAttributes = [] }: ProductsTabProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taxClass, setTaxClass] = useState('');
  const [variants, setVariants] = useState<VariantForm[]>([emptyVariant()]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [formTab, setFormTab] = useState('details');

  // Merge standard + custom attributes for the form
  const allAttributes: { key: string; label: string; type: string; options?: string[]; placeholder?: string }[] = [
    ...standardAttributes.filter(a => !['sku', 'barcode', 'cost_price', 'selling_price', 'tax_class'].includes(a.key)),
    ...customAttributes.map(a => ({ ...a, type: 'text' as const, placeholder: '' })),
  ];

  const loadProducts = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('pos_products')
        .select('*, pos_product_variants(*), pos_product_images(*)', { count: 'exact' })
        .eq('merchant_id', merchantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);
      if (search) query = query.ilike('name', `%${search}%`);
      const { data, count, error } = await query;
      if (error) throw error;
      setProducts(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }, [merchantId, search]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const resetForm = () => {
    setName(''); setDescription(''); setTaxClass('');
    setVariants([emptyVariant()]);
    setImages([]);
    setEditingProduct(null);
    setFormTab('details');
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (product: any) => {
    setEditingProduct(product);
    setName(product.name || '');
    setDescription(product.description || '');
    setTaxClass(product.tax_class || '');
    const pvs = (product.pos_product_variants || []).map((v: any) => ({
      id: v.id,
      name: v.name || 'Default',
      price: String(v.price || ''),
      sku: v.sku || '',
      barcode: v.barcode || '',
      cost_price: v.cost_price ? String(v.cost_price) : '',
      compare_at_price: v.compare_at_price ? String(v.compare_at_price) : '',
      attributes: (v.attributes_json && typeof v.attributes_json === 'object' && !Array.isArray(v.attributes_json))
        ? v.attributes_json as Record<string, string>
        : {},
    }));
    setVariants(pvs.length > 0 ? pvs : [emptyVariant()]);
    const pimgs = (product.pos_product_images || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((img: any) => ({ id: img.id, url: img.url, sort_order: img.sort_order }));
    setImages(pimgs);
    setFormTab('details');
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !merchantId) return;
    const remaining = 4 - images.length;
    if (remaining <= 0) { toast.error('Maximum 4 images per product'); return; }
    const toAdd = Array.from(files).slice(0, remaining);
    for (const file of toAdd) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5MB limit`); continue; }
      const preview = URL.createObjectURL(file);
      setImages(prev => [...prev, { url: '', sort_order: prev.length, file, preview }]);
    }
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => {
      const img = prev[idx];
      if (img.preview) URL.revokeObjectURL(img.preview);
      return prev.filter((_, i) => i !== idx).map((img, i) => ({ ...img, sort_order: i }));
    });
  };

  const uploadImageFile = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `products/${merchantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('storefront-assets').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('storefront-assets').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!merchantId || !name.trim()) { toast.error('Product name is required'); return; }
    if (variants.length === 0 || !variants[0].price) { toast.error('At least one variant with a price is required'); return; }

    setSaving(true);
    try {
      setUploading(true);
      const finalImages: ProductImage[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.file) {
          const url = await uploadImageFile(img.file);
          finalImages.push({ url, sort_order: i });
        } else {
          finalImages.push({ id: img.id, url: img.url, sort_order: i });
        }
      }
      setUploading(false);

      if (editingProduct) {
        await (supabase.from('pos_products') as any).update({
          name: name.trim(), description: description.trim() || null,
          tax_class: taxClass || null, updated_at: new Date().toISOString(),
        }).eq('id', editingProduct.id);

        for (const v of variants) {
          const variantPayload = {
            product_id: editingProduct.id, merchant_id: merchantId,
            name: v.name || 'Default', price: Number(v.price) || 0,
            sku: v.sku || null, barcode: v.barcode || null,
            cost_price: v.cost_price ? Number(v.cost_price) : null,
            compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
            attributes_json: Object.keys(v.attributes).length > 0 ? v.attributes : null,
            updated_at: new Date().toISOString(),
          };
          if (v.id) {
            await (supabase.from('pos_product_variants') as any).update(variantPayload).eq('id', v.id);
          } else {
            await (supabase.from('pos_product_variants') as any).insert(variantPayload);
          }
        }

        const existingImgIds = finalImages.filter(i => i.id).map(i => i.id);
        const oldIds = (editingProduct.pos_product_images || []).map((i: any) => i.id);
        const toDelete = oldIds.filter((id: string) => !existingImgIds.includes(id));
        if (toDelete.length > 0) await (supabase.from('pos_product_images') as any).delete().in('id', toDelete);
        for (const img of finalImages) {
          if (img.id) {
            await (supabase.from('pos_product_images') as any).update({ sort_order: img.sort_order }).eq('id', img.id);
          } else {
            await (supabase.from('pos_product_images') as any).insert({ product_id: editingProduct.id, url: img.url, sort_order: img.sort_order });
          }
        }
        toast.success('Product updated');
      } else {
        const { data: newProduct, error: prodErr } = await (supabase.from('pos_products') as any)
          .insert({ merchant_id: merchantId, name: name.trim(), description: description.trim() || null, tax_class: taxClass || null, currency, source: 'manual', status: 'active' })
          .select().single();
        if (prodErr) throw prodErr;

        for (const v of variants) {
          await (supabase.from('pos_product_variants') as any).insert({
            product_id: newProduct.id, merchant_id: merchantId, name: v.name || 'Default',
            price: Number(v.price) || 0, sku: v.sku || null, barcode: v.barcode || null,
            cost_price: v.cost_price ? Number(v.cost_price) : null,
            compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
            attributes_json: Object.keys(v.attributes).length > 0 ? v.attributes : null,
          });
        }

        for (const img of finalImages) {
          await (supabase.from('pos_product_images') as any).insert({ product_id: newProduct.id, url: img.url, sort_order: img.sort_order });
        }
        toast.success('Product created');
      }

      setDialogOpen(false);
      resetForm();
      loadProducts();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to save product'));
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await (supabase.from('pos_products') as any).update({ status: 'deleted', updated_at: new Date().toISOString() }).eq('id', deleteTarget.id);
      toast.success('Product deleted');
      setDeleteTarget(null);
      loadProducts();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to delete'));
    } finally {
      setDeleting(false);
    }
  };

  const updateVariant = (idx: number, field: keyof VariantForm, value: string) => {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };
  const updateVariantAttr = (idx: number, attrKey: string, value: string) => {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, attributes: { ...v.attributes, [attrKey]: value } } : v));
  };
  const addVariant = () => {
    if (variants.length >= 10) return;
    setVariants(prev => [...prev, { ...emptyVariant(), name: `Variant ${prev.length + 1}` }]);
  };
  const removeVariant = (idx: number) => {
    if (variants.length <= 1) return;
    setVariants(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  if (!merchantId) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          No merchant account found. Register as a merchant first.
        </CardContent>
      </Card>
    );
  }

  const getLowestPrice = (variants: any[]) => {
    if (!variants?.length) return 0;
    return Math.min(...variants.map((v: any) => v.price || 0));
  };
  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0 }).format(amount);

  const getFirstImage = (product: any) => {
    const imgs = product.pos_product_images || [];
    if (imgs.length === 0) return null;
    return imgs.sort((a: any, b: any) => a.sort_order - b.sort_order)[0]?.url;
  };

  const getAttrSummary = (product: any) => {
    const pvs = product.pos_product_variants || [];
    if (pvs.length === 0) return [];
    const firstAttrs = pvs[0]?.attributes_json;
    if (!firstAttrs || typeof firstAttrs !== 'object' || Array.isArray(firstAttrs)) return [];
    return Object.entries(firstAttrs as Record<string, string>).filter(([, v]) => v).slice(0, 3);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Your Products
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} product{total !== 1 ? 's' : ''} in your catalog
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-9 h-9 w-56 rounded-lg text-xs" />
          </div>
          <Button variant="outline" size="sm" onClick={loadProducts} className="gap-1.5 h-9">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5 h-9 bg-[hsl(var(--fi-green))] hover:bg-[hsl(var(--fi-green))]/90 text-white">
            <Plus className="w-3.5 h-3.5" /> Add Product
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && products.length === 0 && (
        <Card className="border border-border/40 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No products yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Add your first product, use the Demo Store tab, or import from WooCommerce.
            </p>
            <Button onClick={openCreate} className="mt-4 gap-2 rounded-xl" size="sm">
              <Plus className="w-4 h-4" /> Add Your First Product
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Product grid */}
      {!loading && products.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const pvariants = product.pos_product_variants || [];
            const price = getLowestPrice(pvariants);
            const variantCount = pvariants.length;
            const imgUrl = getFirstImage(product);
            const isExpanded = expandedCards.has(product.id);
            const attrPreview = getAttrSummary(product);

            return (
              <Card key={product.id} className="border border-border/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                {imgUrl && (
                  <div className="h-36 bg-muted overflow-hidden">
                    <SafeImage src={imgUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {!imgUrl && (
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4.5 h-4.5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                        {product.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{product.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(product)}>
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(product)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm font-bold text-foreground">{formatPrice(price)} {currency}</span>
                    {variantCount > 1 && <Badge variant="secondary" className="text-[10px] h-5">{variantCount} variants</Badge>}
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] h-5 capitalize">{product.source}</Badge>
                    {product.tax_class && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        <Tag className="w-2.5 h-2.5 mr-1" /> {product.tax_class}
                      </Badge>
                    )}
                    {(product.pos_product_images || []).length > 0 && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        <ImageIcon className="w-2.5 h-2.5 mr-1" /> {(product.pos_product_images || []).length}
                      </Badge>
                    )}
                  </div>

                  {/* Attribute preview chips */}
                  {attrPreview.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {attrPreview.map(([key, val]) => (
                        <Badge key={key} className="text-[9px] h-4 bg-primary/8 text-primary border-primary/20 font-normal">
                          {key}: {val}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {pvariants.length > 1 && (
                    <>
                      <button onClick={() => toggleExpand(product.id)} className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? 'Hide' : 'Show'} variants
                      </button>
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                          {pvariants.map((v: any) => (
                            <div key={v.id} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground truncate max-w-[60%]">{v.name}</span>
                              <span className="font-medium text-foreground">{formatPrice(v.price)} {currency}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══ CREATE / EDIT DIALOG ═══ */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingProduct ? 'Update product details, variants, images, and attributes.' : 'Fill in the details to list a new product in your catalog.'}
            </DialogDescription>
          </DialogHeader>

          {/* Tabbed form */}
          <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
            <div className="px-6 pt-3">
              <TabsList className="grid w-full grid-cols-4 h-9">
                <TabsTrigger value="details" className="text-xs gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Details
                </TabsTrigger>
                <TabsTrigger value="media" className="text-xs gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" /> Media
                </TabsTrigger>
                <TabsTrigger value="variants" className="text-xs gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Variants
                </TabsTrigger>
                <TabsTrigger value="attributes" className="text-xs gap-1.5 relative">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Attributes
                  {allAttributes.length > 0 && (
                    <span className="ml-1 text-[9px] bg-primary/10 text-primary px-1.5 rounded-full font-bold">{allAttributes.length}</span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="px-6 py-4">
              {/* Details Tab */}
              <TabsContent value="details" className="mt-0 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">Product Name *</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. African Print T-Shirt" className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">Description</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short product description..." className="rounded-xl resize-none" rows={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tax Class</Label>
                    <Select value={taxClass} onValueChange={setTaxClass}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select tax class" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="reduced">Reduced</SelectItem>
                        <SelectItem value="zero">Zero Rate</SelectItem>
                        <SelectItem value="exempt">Exempt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Currency</Label>
                    <Input value={currency} disabled className="h-10 rounded-xl bg-muted" />
                  </div>
                </div>
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    Product Images
                    <span className="text-muted-foreground font-normal">({images.length}/4)</span>
                  </Label>
                  <div className="grid grid-cols-4 gap-3">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl border border-border/60 overflow-hidden bg-muted group/img">
                        <SafeImage src={img.preview || img.url} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                        <button onClick={() => removeImage(idx)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <X className="w-3.5 h-3.5 text-white" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {idx === 0 ? 'Main' : idx + 1}
                        </div>
                      </div>
                    ))}
                    {images.length < 4 && (
                      <label className="aspect-square rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-medium">Add Image</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                      </label>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Max 5MB per image. First image is the main thumbnail.</p>
                </div>
              </TabsContent>

              {/* Variants Tab */}
              <TabsContent value="variants" className="mt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold">Pricing & Variants *</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Use variants for sizes, colors, or bundles</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addVariant} disabled={variants.length >= 10} className="h-7 text-[11px] gap-1 rounded-lg">
                    <Plus className="w-3 h-3" /> Add Variant
                  </Button>
                </div>
                <div className="space-y-3">
                  {variants.map((v, idx) => (
                    <div key={idx} className="rounded-xl border border-border/60 p-4 space-y-3 relative bg-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Hash className="w-3 h-3" /> Variant {idx + 1}
                        </span>
                        {variants.length > 1 && (
                          <button onClick={() => removeVariant(idx)} className="w-6 h-6 rounded-full hover:bg-destructive/10 flex items-center justify-center">
                            <X className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Name</Label>
                          <Input value={v.name} onChange={e => updateVariant(idx, 'name', e.target.value)} placeholder="Default" className="h-9 text-xs rounded-lg" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> Price ({currency}) *
                          </Label>
                          <Input type="number" value={v.price} onChange={e => updateVariant(idx, 'price', e.target.value)} placeholder="0" className="h-9 text-xs rounded-lg" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">SKU</Label>
                          <Input value={v.sku} onChange={e => updateVariant(idx, 'sku', e.target.value)} placeholder="SKU-001" className="h-9 text-xs rounded-lg" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Barcode</Label>
                          <Input value={v.barcode} onChange={e => updateVariant(idx, 'barcode', e.target.value)} placeholder="Optional" className="h-9 text-xs rounded-lg" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" /> Cost Price
                          </Label>
                          <Input type="number" value={v.cost_price} onChange={e => updateVariant(idx, 'cost_price', e.target.value)} placeholder="Optional" className="h-9 text-xs rounded-lg" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Compare-at Price</Label>
                          <Input type="number" value={v.compare_at_price} onChange={e => updateVariant(idx, 'compare_at_price', e.target.value)} placeholder="Optional" className="h-9 text-xs rounded-lg" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Attributes Tab */}
              <TabsContent value="attributes" className="mt-0 space-y-4">
                {allAttributes.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No attributes configured</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      Go to the <strong>Attributes</strong> tab to set up standard and custom product attributes first.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-semibold">Product Attributes</Label>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Set attribute values per variant. These are defined in the Attributes tab.
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] h-5">{allAttributes.length} attributes</Badge>
                    </div>

                    {variants.map((v, vIdx) => (
                      <div key={vIdx} className="space-y-3">
                        {variants.length > 1 && (
                          <div className="flex items-center gap-2">
                            <Separator className="flex-1" />
                            <span className="text-[10px] text-muted-foreground font-semibold bg-background px-2">
                              {v.name || `Variant ${vIdx + 1}`}
                            </span>
                            <Separator className="flex-1" />
                          </div>
                        )}
                        <div className="grid sm:grid-cols-2 gap-3">
                          {allAttributes.map((attr) => (
                            <div key={attr.key} className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">{attr.label}</Label>
                              {attr.type === 'select' && attr.options ? (
                                <Select
                                  value={v.attributes[attr.key] || ''}
                                  onValueChange={(val) => updateVariantAttr(vIdx, attr.key, val)}
                                >
                                  <SelectTrigger className="h-9 text-xs rounded-lg">
                                    <SelectValue placeholder={`Select ${attr.label.toLowerCase()}`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {attr.options.map(opt => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  type={attr.type === 'number' ? 'number' : 'text'}
                                  value={v.attributes[attr.key] || ''}
                                  onChange={e => updateVariantAttr(vIdx, attr.key, e.target.value)}
                                  placeholder={attr.placeholder || `Enter ${attr.label.toLowerCase()}`}
                                  className="h-9 text-xs rounded-lg"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </TabsContent>
            </div>
          </Tabs>

          <Separator />

          <DialogFooter className="flex-col sm:flex-row gap-2 px-6 pb-6 pt-3">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || uploading} className="rounded-xl gap-2 bg-[hsl(var(--fi-green))] hover:bg-[hsl(var(--fi-green))]/90 text-white">
              {saving ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? 'Uploading...' : 'Saving...'}</span>
              ) : (
                <><Save className="w-4 h-4" /> {editingProduct ? 'Update Product' : 'Create Product'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRMATION ═══ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will remove it from your catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
