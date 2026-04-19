import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, Tag, Layers, Image as ImageIcon, Package, Hash, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { STORE_CATEGORIES } from '@/lib/storefront-data';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { ImageUpload } from '@/components/storefront/ImageUpload';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Variant {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  cost_price: number;
  track_inventory: boolean;
}

interface ProductImage { id?: string; url: string; sort_order: number }

export default function BusinessProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { merchantId } = useMerchantContext();
  const [loading, setLoading] = useState(false);

  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taxClass, setTaxClass] = useState('Standard');
  const [status, setStatus] = useState<'active' | 'draft'>('active');

  // Marketplace category
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [customSubCategory, setCustomSubCategory] = useState('');

  // Images & variants
  const [images, setImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<Variant[]>([
    { name: 'Default', sku: '', barcode: '', price: 0, cost_price: 0, track_inventory: true }
  ]);

  const selectedCategoryObj = STORE_CATEGORIES.find(c => c.name === category);

  useEffect(() => {
    if (id && merchantId) loadProduct();
  }, [id, merchantId]);

  const loadProduct = async () => {
    const { data: product, error } = await supabase
      .from('pos_products')
      .select(`*, pos_product_variants(*), pos_product_images(*), pos_product_category_links(category_id, pos_categories(name, parent_id))`)
      .eq('id', id)
      .single();
    if (error) { toast.error('Failed to load product'); return; }

    setName(product.name);
    setDescription(product.description || '');
    setTaxClass(product.tax_class || 'Standard');
    setStatus((product.status as any) || 'active');

    const links = (product as any).pos_product_category_links || [];
    if (links.length > 0) {
      const names = links.map((l: any) => l.pos_categories?.name).filter(Boolean);
      const main = names.find((n: string) => STORE_CATEGORIES.some(c => c.name === n));
      const sub = names.find((n: string) => n !== main);
      if (main) setCategory(main);
      if (sub) setSubCategory(sub);
    }

    if (product.pos_product_images?.length) {
      setImages(product.pos_product_images.map((img: any) => ({ id: img.id, url: img.url, sort_order: img.sort_order || 0 })));
    }
    if (product.pos_product_variants?.length) {
      setVariants(product.pos_product_variants.map((v: any) => ({
        id: v.id, name: v.name, sku: v.sku || '', barcode: v.barcode || '',
        price: v.price, cost_price: v.cost_price || 0, track_inventory: v.track_inventory,
      })));
    }
  };

  const addImage = () => setImages([...images, { url: '', sort_order: images.length }]);
  const removeImage = (i: number) => setImages(images.filter((_, idx) => idx !== i));
  const updateImage = (i: number, url: string) => setImages(images.map((img, idx) => idx === i ? { ...img, url } : img));

  const addVariant = () => setVariants([...variants, { name: `Variant ${variants.length + 1}`, sku: '', barcode: '', price: 0, cost_price: 0, track_inventory: true }]);
  const removeVariant = (i: number) => {
    if (variants.length === 1) { toast.error('Product must have at least one variant'); return; }
    setVariants(variants.filter((_, idx) => idx !== i));
  };
  const updateVariant = (i: number, field: keyof Variant, value: any) => {
    setVariants(variants.map((v, idx) => idx === i ? { ...v, [field]: value } : v));
  };

  /** Ensure category exists and return its id (creating parent + child if needed). */
  const ensureCategoryId = async (mId: string, name: string, parentId: string | null = null) => {
    const { data: existing } = await supabase
      .from('pos_categories').select('id').eq('merchant_id', mId).eq('name', name)
      .is('parent_id', parentId as any)
      .maybeSingle();
    if (existing?.id) return existing.id as string;
    const { data: created, error } = await supabase
      .from('pos_categories').insert({ merchant_id: mId, name, parent_id: parentId }).select('id').single();
    if (error) throw error;
    return created.id as string;
  };

  const syncCategoryLinks = async (productId: string, mId: string) => {
    const ids: string[] = [];
    if (category) {
      const parentId = await ensureCategoryId(mId, category, null);
      ids.push(parentId);
      const sub = customSubCategory.trim() || subCategory;
      if (sub) {
        const childId = await ensureCategoryId(mId, sub, parentId);
        ids.push(childId);
      }
    }
    // Replace existing links
    await supabase.from('pos_product_category_links').delete().eq('product_id', productId);
    if (ids.length) {
      await supabase.from('pos_product_category_links').insert(ids.map(category_id => ({ product_id: productId, category_id })));
    }
  };

  const syncImages = async (productId: string) => {
    // Replace strategy: delete existing, insert non-empty
    await supabase.from('pos_product_images').delete().eq('product_id', productId);
    const valid = images.filter(i => i.url.trim());
    if (valid.length) {
      await supabase.from('pos_product_images').insert(valid.map((img, idx) => ({
        product_id: productId, url: img.url, sort_order: idx,
      })));
    }
  };

  const handleSubmit = async () => {
    if (!merchantId) { toast.error('Merchant not found'); return; }
    if (!name.trim()) { toast.error('Product name is required'); return; }
    if (variants.some(v => !v.name.trim() || v.price < 0)) {
      toast.error('All variants must have a name and valid price'); return;
    }

    setLoading(true);
    try {
      let productId = id as string | undefined;

      if (productId) {
        const { error: pErr } = await supabase.from('pos_products').update({
          name, description, tax_class: taxClass, status, updated_at: new Date().toISOString(),
        }).eq('id', productId);
        if (pErr) throw pErr;

        for (const v of variants) {
          if (v.id) {
            await supabase.from('pos_product_variants').update({
              name: v.name, sku: v.sku || null, barcode: v.barcode || null,
              price: v.price, cost_price: v.cost_price || null, track_inventory: v.track_inventory,
            }).eq('id', v.id);
          } else {
            await supabase.from('pos_product_variants').insert({
              product_id: productId, name: v.name, sku: v.sku || null, barcode: v.barcode || null,
              price: v.price, cost_price: v.cost_price || null, track_inventory: v.track_inventory,
            });
          }
        }
      } else {
        const { data, error } = await supabase.functions.invoke('pos-catalog-products', {
          method: 'POST',
          body: {
            merchant_id: merchantId, name, description, currency: 'XAF', tax_class: taxClass, source: 'manual',
            variants: variants.map(v => ({
              name: v.name, sku: v.sku || null, barcode: v.barcode || null,
              price: v.price, cost_price: v.cost_price || null, track_inventory: v.track_inventory,
            })),
          },
        });
        if (error) throw error;
        productId = (data as any)?.product?.id || (data as any)?.id;
        if (!productId) throw new Error('Could not determine product id');
      }

      await syncCategoryLinks(productId!, merchantId);
      await syncImages(productId!);

      toast.success(id ? 'Product updated' : 'Product created');
      navigate('/biz/products');
    } catch (error: any) {
      toast.error(extractEdgeFunctionError(error, 'Failed to save product'));
    } finally {
      setLoading(false);
    }
  };

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <Card className="p-5 rounded-2xl border-border/40">
      <h2 className="font-bold text-[15px] mb-4 flex items-center gap-2 text-foreground">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.8} /> {title}
      </h2>
      {children}
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="border-b border-border/40 bg-card/40 backdrop-blur-xl px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-1 hover:bg-muted/60">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{id ? 'Edit Product' : 'New Product'}</h1>
            <p className="text-xs text-muted-foreground">Catalog item with variants, images, and category</p>
          </div>
          <Badge variant={status === 'active' ? 'default' : 'secondary'} className="rounded-full">{status}</Badge>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-5 max-w-3xl mx-auto">
        <Section icon={FileText} title="Basic Information">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Product Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium T-Shirt" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Tell customers about this product…" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="active">Active (visible)</option>
                  <option value="draft">Draft (hidden)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tax Class</label>
                <select value={taxClass} onChange={(e) => setTaxClass(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option>Standard</option><option>Reduced</option><option>Zero-rated</option><option>Exempt</option>
                </select>
              </div>
            </div>
          </div>
        </Section>

        <Section icon={Tag} title="Marketplace Category">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Main Category</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setSubCategory(''); setCustomSubCategory(''); }}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a category…</option>
                {STORE_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <AnimatePresence>
              {selectedCategoryObj && selectedCategoryObj.subs.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Sub-category</label>
                  <select
                    value={subCategory}
                    onChange={(e) => { setSubCategory(e.target.value); setCustomSubCategory(''); }}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select a sub-category…</option>
                    {selectedCategoryObj.subs.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Custom Sub-category (optional)</label>
              <Input
                value={customSubCategory}
                onChange={(e) => setCustomSubCategory(e.target.value)}
                placeholder="Enter your own (overrides selection)"
                className="rounded-xl"
              />
            </div>
          </div>
        </Section>

        <Section icon={ImageIcon} title="Product Images">
          <div className="space-y-3">
            {images.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No images yet — add up to 6 to showcase this product.</p>
            )}
            {images.map((img, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <ImageUpload
                    label={`Image ${i + 1}`}
                    value={img.url}
                    onChange={(url) => updateImage(i, url)}
                    folder="products"
                    previewClass="w-20 h-20 rounded-lg object-cover"
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive shrink-0" onClick={() => removeImage(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {images.length < 6 && (
              <Button variant="outline" size="sm" onClick={addImage} className="rounded-xl gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Image
              </Button>
            )}
          </div>
        </Section>

        <Section icon={Layers} title="Variants & Pricing">
          <div className="space-y-4">
            {variants.map((variant, index) => (
              <div key={index} className={cn('rounded-xl border border-border/40 p-4 bg-muted/20', variants.length > 1 && 'space-y-3')}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" /> Variant {index + 1}
                  </h3>
                  {variants.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => removeVariant(index)} className="text-destructive h-8 w-8 p-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  <Input placeholder="Variant name (e.g. Small, Red)" value={variant.name} onChange={(e) => updateVariant(index, 'name', e.target.value)} className="rounded-xl" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="SKU (optional)" value={variant.sku} onChange={(e) => updateVariant(index, 'sku', e.target.value)} className="rounded-xl" />
                    <Input placeholder="Barcode (optional)" value={variant.barcode} onChange={(e) => updateVariant(index, 'barcode', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Selling Price (FCFA) *
                      </label>
                      <Input type="number" placeholder="1000" value={variant.price || ''} onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)} className="rounded-xl" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Cost Price (FCFA)</label>
                      <Input type="number" placeholder="500" value={variant.cost_price || ''} onChange={(e) => updateVariant(index, 'cost_price', parseFloat(e.target.value) || 0)} className="rounded-xl" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input type="checkbox" checked={variant.track_inventory} onChange={(e) => updateVariant(index, 'track_inventory', e.target.checked)} className="rounded" />
                    Track inventory for this variant
                  </label>
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addVariant} className="rounded-xl gap-1.5 w-full">
              <Plus className="h-4 w-4" /> Add Variant
            </Button>
          </div>
        </Section>

        <div className="flex gap-2 sticky bottom-4 z-10">
          <Button variant="outline" onClick={() => navigate(-1)} className="flex-1 rounded-xl h-11">Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1 rounded-xl h-11">
            {loading ? 'Saving…' : id ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </div>
    </div>
  );
}
