import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, Upload, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { STORE_CATEGORIES } from '@/lib/storefront-data';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
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

interface ProductImage {
  id?: string;
  url: string;
  sort_order: number;
}

const MAX_IMAGES = 6;
const BUCKET = 'storefront-assets';

export default function BusinessProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { merchantId } = useMerchantContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taxClass, setTaxClass] = useState('Standard');
  const [status, setStatus] = useState<'active' | 'draft'>('active');

  // Categorization
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [customSubCategory, setCustomSubCategory] = useState('');

  const [images, setImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<Variant[]>([
    { name: 'Default', sku: '', barcode: '', price: 0, cost_price: 0, track_inventory: true },
  ]);

  const selectedCat = STORE_CATEGORIES.find((c) => c.name === category);
  const subOptions = selectedCat?.subs || [];
  const usingCustomCategory = category === '__custom__';
  const usingCustomSubCategory = subCategory === '__custom__';

  useEffect(() => {
    if (id && merchantId) loadProduct();
  }, [id, merchantId]);

  const loadProduct = async () => {
    const { data: product, error } = await supabase
      .from('pos_products')
      .select(`*, pos_product_variants(*), pos_product_images(*)`)
      .eq('id', id)
      .single();

    if (error || !product) {
      toast.error('Failed to load product');
      return;
    }

    setName(product.name);
    setDescription(product.description || '');
    setTaxClass(product.tax_class || 'Standard');
    setStatus((product.status as any) || 'active');

    const cat = (product as any).category as string | null;
    const sub = (product as any).sub_category as string | null;
    if (cat) {
      const known = STORE_CATEGORIES.find((c) => c.name === cat);
      if (known) {
        setCategory(cat);
        if (sub) {
          const knownSub = known.subs.find((s) => s.name === sub);
          if (knownSub) setSubCategory(sub);
          else { setSubCategory('__custom__'); setCustomSubCategory(sub); }
        }
      } else {
        setCategory('__custom__');
        setCustomCategory(cat);
        if (sub) { setSubCategory('__custom__'); setCustomSubCategory(sub); }
      }
    }

    if (product.pos_product_variants?.length) {
      setVariants(product.pos_product_variants.map((v: any) => ({
        id: v.id, name: v.name, sku: v.sku || '', barcode: v.barcode || '',
        price: v.price, cost_price: v.cost_price || 0, track_inventory: v.track_inventory,
      })));
    }

    const pimgs = (product.pos_product_images || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((img: any) => ({ id: img.id, url: img.url, sort_order: img.sort_order }));
    setImages(pimgs);
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { toast.error(`Maximum ${MAX_IMAGES} images allowed`); return; }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const newImgs: ProductImage[] = [];
      for (const file of toUpload) {
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5MB`); continue; }
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/products/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
        newImgs.push({ url: publicUrl, sort_order: images.length + newImgs.length });
      }
      setImages((prev) => [...prev, ...newImgs]);
      if (newImgs.length) toast.success(`${newImgs.length} image(s) uploaded`);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Upload failed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx).map((img, i) => ({ ...img, sort_order: i })));
  };

  const addVariant = () => setVariants([...variants, {
    name: `Variant ${variants.length + 1}`, sku: '', barcode: '', price: 0, cost_price: 0, track_inventory: true,
  }]);

  const removeVariant = (index: number) => {
    if (variants.length === 1) { toast.error('Product must have at least one variant'); return; }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof Variant, value: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const resolveCategory = () => usingCustomCategory ? customCategory.trim() : (category || null);
  const resolveSubCategory = () => usingCustomSubCategory ? customSubCategory.trim() : (subCategory && subCategory !== '__custom__' ? subCategory : null);

  const handleSubmit = async () => {
    if (!merchantId) { toast.error('Merchant not found'); return; }
    if (!name.trim()) { toast.error('Product name is required'); return; }
    if (variants.some((v) => !v.name.trim() || v.price < 0)) {
      toast.error('All variants must have a name and valid price');
      return;
    }

    setLoading(true);
    try {
      const cat = resolveCategory();
      const sub = resolveSubCategory();

      if (id) {
        // ---- UPDATE existing product ----
        const { error: productError } = await (supabase
          .from('pos_products') as any)
          .update({
            name, description, tax_class: taxClass, status,
            category: cat, sub_category: sub,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (productError) throw productError;

        // Variants: update existing, INSERT newly added (previously dropped — bug fix)
        for (const variant of variants) {
          if (variant.id) {
            await supabase.from('pos_product_variants').update({
              name: variant.name, sku: variant.sku || null, barcode: variant.barcode || null,
              price: variant.price, cost_price: variant.cost_price || null,
              track_inventory: variant.track_inventory,
            }).eq('id', variant.id);
          } else {
            await supabase.from('pos_product_variants').insert({
              product_id: id, merchant_id: merchantId,
              name: variant.name, sku: variant.sku || null, barcode: variant.barcode || null,
              price: variant.price, cost_price: variant.cost_price || null,
              track_inventory: variant.track_inventory,
            });
          }
        }

        // Images: diff existing vs current
        const { data: existingImgs } = await (supabase.from('pos_product_images') as any)
          .select('id').eq('product_id', id);
        const keepIds = images.filter((i) => i.id).map((i) => i.id);
        const toDelete = (existingImgs || []).filter((e: any) => !keepIds.includes(e.id)).map((e: any) => e.id);
        if (toDelete.length) await (supabase.from('pos_product_images') as any).delete().in('id', toDelete);
        for (const img of images) {
          if (img.id) {
            await (supabase.from('pos_product_images') as any).update({ sort_order: img.sort_order }).eq('id', img.id);
          } else {
            await (supabase.from('pos_product_images') as any).insert({
              product_id: id, url: img.url, sort_order: img.sort_order,
            });
          }
        }

        toast.success('Product updated');
      } else {
        // ---- CREATE new product ----
        const { data, error } = await supabase.functions.invoke('pos-catalog-products', {
          method: 'POST',
          body: {
            merchant_id: merchantId, name, description, currency: 'XAF',
            tax_class: taxClass, source: 'manual',
            variants: variants.map((v) => ({
              name: v.name, sku: v.sku || null, barcode: v.barcode || null,
              price: v.price, cost_price: v.cost_price || null, track_inventory: v.track_inventory,
            })),
          },
        });
        if (error) throw error;

        const newProductId = data?.product?.id || data?.id;
        if (newProductId) {
          // Patch category/sub_category/status (edge function may not accept them yet)
          await (supabase.from('pos_products') as any)
            .update({ category: cat, sub_category: sub, status })
            .eq('id', newProductId);

          // Persist images
          if (images.length) {
            await (supabase.from('pos_product_images') as any).insert(
              images.map((img, i) => ({ product_id: newProductId, url: img.url, sort_order: i })),
            );
          }
        }

        toast.success('Product created');
      }

      navigate('/biz/products');
    } catch (error: any) {
      toast.error(extractEdgeFunctionError(error, 'Failed to save product'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6" /></button>
          <div>
            <h1 className="text-2xl font-bold">{id ? 'Edit' : 'New'} Product</h1>
            <p className="text-primary-foreground/80 text-sm">Fill in product details</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Basic Info */}
        <Card className="p-4">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Product Name *</label>
              <Input placeholder="e.g. Premium T-Shirt" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea placeholder="Product description..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-2 block">Tax Class</label>
                <select value={taxClass} onChange={(e) => setTaxClass(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option>Standard</option><option>Reduced</option><option>Zero-rated</option><option>Exempt</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'draft')}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="active">Active (visible to customers)</option>
                  <option value="draft">Draft (hidden)</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Categorization */}
        <Card className="p-4">
          <h2 className="font-semibold mb-1">Marketplace Category</h2>
          <p className="text-xs text-muted-foreground mb-4">Helps customers find your product on the marketplace.</p>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory(''); }}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select a category...</option>
                {STORE_CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                <option value="__custom__">+ Add custom category</option>
              </select>
              {usingCustomCategory && (
                <Input className="mt-2" placeholder="Type your custom category"
                  value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
              )}
            </div>

            {category && (
              <div>
                <label className="text-sm font-medium mb-2 block">Sub-category</label>
                <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={usingCustomCategory && !customCategory.trim()}>
                  <option value="">Select a sub-category...</option>
                  {subOptions.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                  <option value="__custom__">+ Add custom sub-category</option>
                </select>
                {usingCustomSubCategory && (
                  <Input className="mt-2" placeholder="Type your custom sub-category"
                    value={customSubCategory} onChange={(e) => setCustomSubCategory(e.target.value)} />
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Images */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Product Images</h2>
            <span className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Upload up to {MAX_IMAGES} images. First image is the main thumbnail.</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border/50 bg-muted">
                <img src={img.url} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                {i === 0 && (
                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded font-semibold">Main</div>
                )}
                <button type="button" onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-background/90 rounded-full p-1 shadow hover:bg-destructive hover:text-destructive-foreground transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className={cn('aspect-square rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors',
                  uploading && 'opacity-50 cursor-not-allowed')}>
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                <span className="text-[10px]">{uploading ? 'Uploading…' : 'Add'}</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { handleImageUpload(e.target.files); }} />
          {images.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ImageIcon className="w-3.5 h-3.5" /> No images yet — products with photos sell better.
            </div>
          )}
        </Card>

        {/* Variants */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Variants</h2>
            <Button size="sm" variant="outline" onClick={addVariant}>
              <Plus className="h-4 w-4 mr-1" /> Add Variant
            </Button>
          </div>
          <div className="space-y-4">
            {variants.map((variant, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm">Variant {index + 1}</h3>
                  {variants.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => removeVariant(index)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  <Input placeholder="Variant name *" value={variant.name}
                    onChange={(e) => updateVariant(index, 'name', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="SKU" value={variant.sku}
                      onChange={(e) => updateVariant(index, 'sku', e.target.value)} />
                    <Input placeholder="Barcode" value={variant.barcode}
                      onChange={(e) => updateVariant(index, 'barcode', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Selling Price (FCFA) *</label>
                      <Input type="number" placeholder="1000" value={variant.price || ''}
                        onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Cost Price (FCFA)</label>
                      <Input type="number" placeholder="500" value={variant.cost_price || ''}
                        onChange={(e) => updateVariant(index, 'cost_price', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={variant.track_inventory}
                      onChange={(e) => updateVariant(index, 'track_inventory', e.target.checked)}
                      className="rounded border-gray-300" />
                    Track inventory for this variant
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? 'Saving...' : id ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </div>
    </div>
  );
}
