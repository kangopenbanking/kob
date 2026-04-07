import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { POS_PRODUCT_ATTRIBUTES } from '@/lib/storefront-data';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface Variant {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  cost_price: number;
  track_inventory: boolean;
}

export default function BusinessProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { merchantId } = useMerchantContext();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taxClass, setTaxClass] = useState('Standard');
  const [variants, setVariants] = useState<Variant[]>([
    { name: 'Default', sku: '', barcode: '', price: 0, cost_price: 0, track_inventory: true }
  ]);

  // Load existing product if editing
  useEffect(() => {
    if (id && merchantId) {
      loadProduct();
    }
  }, [id, merchantId]);

  const loadProduct = async () => {
    const { data: product, error } = await supabase
      .from('pos_products')
      .select(`
        *,
        pos_product_variants(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      toast.error('Failed to load product');
      return;
    }

    setName(product.name);
    setDescription(product.description || '');
    setTaxClass(product.tax_class || 'Standard');

    if (product.pos_product_variants && product.pos_product_variants.length > 0) {
      setVariants(
        product.pos_product_variants.map((v: any) => ({
          id: v.id,
          name: v.name,
          sku: v.sku || '',
          barcode: v.barcode || '',
          price: v.price,
          cost_price: v.cost_price || 0,
          track_inventory: v.track_inventory,
        }))
      );
    }
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      { name: `Variant ${variants.length + 1}`, sku: '', barcode: '', price: 0, cost_price: 0, track_inventory: true }
    ]);
  };

  const removeVariant = (index: number) => {
    if (variants.length === 1) {
      toast.error('Product must have at least one variant');
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof Variant, value: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const handleSubmit = async () => {
    if (!merchantId) {
      toast.error('Merchant not found');
      return;
    }

    if (!name.trim()) {
      toast.error('Product name is required');
      return;
    }

    if (variants.some(v => !v.name.trim() || v.price < 0)) {
      toast.error('All variants must have a name and valid price');
      return;
    }

    setLoading(true);

    try {
      if (id) {
        // Update existing product
        const { error: productError } = await supabase
          .from('pos_products')
          .update({
            name,
            description,
            tax_class: taxClass,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (productError) throw productError;

        // Update variants (simplified - in production you'd handle deletions)
        for (const variant of variants) {
          if (variant.id) {
            await supabase
              .from('pos_product_variants')
              .update({
                name: variant.name,
                sku: variant.sku,
                barcode: variant.barcode,
                price: variant.price,
                cost_price: variant.cost_price,
                track_inventory: variant.track_inventory,
              })
              .eq('id', variant.id);
          }
        }

        toast.success('Product updated');
      } else {
        // Create new product via edge function
        const { data, error } = await supabase.functions.invoke('pos-catalog-products', {
          method: 'POST',
          body: {
            merchant_id: merchantId,
            name,
            description,
            currency: 'XAF',
            tax_class: taxClass,
            source: 'manual',
            variants: variants.map(v => ({
              name: v.name,
              sku: v.sku || null,
              barcode: v.barcode || null,
              price: v.price,
              cost_price: v.cost_price || null,
              track_inventory: v.track_inventory,
            })),
          },
        });

        if (error) throw error;
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
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{id ? 'Edit' : 'New'} Product</h1>
            <p className="text-primary-foreground/80 text-sm">Fill in product details</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Product Name *</label>
              <Input
                placeholder="e.g. Premium T-Shirt"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                placeholder="Product description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tax Class</label>
              <select
                value={taxClass}
                onChange={(e) => setTaxClass(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option>Standard</option>
                <option>Reduced</option>
                <option>Zero-rated</option>
                <option>Exempt</option>
              </select>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Variants</h2>
            <Button size="sm" variant="outline" onClick={addVariant}>
              <Plus className="h-4 w-4 mr-1" />
              Add Variant
            </Button>
          </div>

          <div className="space-y-4">
            {variants.map((variant, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm">Variant {index + 1}</h3>
                  {variants.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeVariant(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <Input
                    placeholder="Variant name *"
                    value={variant.name}
                    onChange={(e) => updateVariant(index, 'name', e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="SKU"
                      value={variant.sku}
                      onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                    />
                    <Input
                      placeholder="Barcode"
                      value={variant.barcode}
                      onChange={(e) => updateVariant(index, 'barcode', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Selling Price (FCFA) *
                      </label>
                      <Input
                        type="number"
                        placeholder="1000"
                        value={variant.price || ''}
                        onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Cost Price (FCFA)
                      </label>
                      <Input
                        type="number"
                        placeholder="500"
                        value={variant.cost_price || ''}
                        onChange={(e) => updateVariant(index, 'cost_price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={variant.track_inventory}
                      onChange={(e) => updateVariant(index, 'track_inventory', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Track inventory for this variant
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? 'Saving...' : id ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </div>
    </div>
  );
}
