import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Palette, Clock, MapPin, Save, ExternalLink, Tag, Eye, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { STORE_CATEGORIES, COUNTRY_CURRENCIES } from '@/lib/storefront-data';
import { STOREFRONT_TEMPLATES, type StorefrontTemplateId } from '@/lib/storefront-templates';
import { CitySelector } from '@/components/storefront/CitySelector';
import { StorePreview } from '@/components/storefront/StorePreview';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { getCanonicalUrl } from '@/config/api';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

export default function BusinessStorefront() {
  const navigate = useNavigate();
  const { merchantId } = useMerchantContext();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [accentColor, setAccentColor] = useState('#c084fc');
  const [region, setRegion] = useState('Centre');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [template, setTemplate] = useState<StorefrontTemplateId>('classic');
  const [isPublished, setIsPublished] = useState(false);
  const [hours, setHours] = useState({
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '10:00', close: '16:00', closed: false },
    sunday: { open: '', close: '', closed: true },
  });

  const selectedCategoryObj = useMemo(() => STORE_CATEGORIES.find(c => c.name === category), [category]);

  useEffect(() => {
    if (!merchantId) return;
    (async () => {
      const { data: merchant } = await supabase.from('gateway_merchants').select('business_name').eq('id', merchantId).single();
      if (merchant) setBusinessName(merchant.business_name || '');
      loadStorefront(merchantId);
    })();
  }, [merchantId]);

  const loadStorefront = async (mId: string) => {
    const { data } = await supabase.from('pos_store_profiles').select('*').eq('merchant_id', mId).single();
    if (data) {
      setTagline(data.store_name || '');
      setDescription(data.description || '');
      setLogoUrl(data.logo_url || '');
      setCoverUrl(data.banner_url || '');
      setCategory(data.category || '');
      setSubCategory(data.sub_category || '');
      setIsPublished(!!data.is_published);
      const brand = data.custom_brand_json as any;
      setPrimaryColor(brand?.primary_color || '#7c3aed');
      setAccentColor(brand?.accent_color || '#c084fc');
      setRegion(brand?.region || 'Centre');
      setCity(data.city || '');
      setAddress(brand?.address || '');
      setPhone(brand?.phone || '');
      setEmail(brand?.email || '');
      if (brand?.template) setTemplate(brand.template);
      if (brand?.operating_hours) setHours(brand.operating_hours as any);
    }
  };

  const handleSave = async () => {
    if (!merchantId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('pos_store_profiles').upsert({
        merchant_id: merchantId,
        store_name: tagline || businessName,
        description, logo_url: logoUrl, banner_url: coverUrl,
        category, sub_category: subCategory,
        city, country: 'CM',
        custom_brand_json: {
          primary_color: primaryColor, accent_color: accentColor, region, address, phone, email,
          operating_hours: hours, template,
        },
      });
      if (error) throw error;
      toast.success('Storefront updated');
    } catch (error: any) {
      toast.error(extractEdgeFunctionError(error, 'Failed to save'));
    } finally {
      setLoading(false);
    }
  };

  const updateDayHours = (day: string, field: string, value: any) => {
    setHours(prev => ({ ...prev, [day]: { ...prev[day as keyof typeof prev], [field]: value } }));
  };

  const storeUrl = getCanonicalUrl(`/app/stores/${merchantId}`);

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-border/40 bg-card p-5">
      <h2 className="font-bold text-[15px] mb-4 flex items-center gap-2 text-foreground">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.8} /> {title}
      </h2>
      {children}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <header className="pt-4 md:pt-0 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Storefront</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Customize your online store</p>
          </div>
          <div className="flex gap-2">
            {merchantId && (
              <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => window.open(storeUrl, '_blank')}>
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </Button>
            )}
            <Button size="sm" className="rounded-xl gap-1.5" onClick={handleSave} disabled={loading}>
              <Save className="h-3.5 w-3.5" /> {loading ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </header>

      <div className={cn(isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-5')}>
        {/* Style Templates */}
        <div className={cn(!isMobile && 'col-span-2')}>
          <Section icon={Layout} title="Storefront Style">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {STOREFRONT_TEMPLATES.map(tpl => {
                const Icon = tpl.icon;
                const active = tpl.id === template;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplate(tpl.id)}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition-all hover:border-primary/60',
                      active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border/40 bg-card',
                    )}
                  >
                    <Icon className={cn('h-5 w-5 mb-2', active ? 'text-primary' : 'text-muted-foreground')} strokeWidth={1.8} />
                    <h3 className="text-sm font-bold text-foreground">{tpl.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{tpl.description}</p>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Live Preview */}
        <div className={cn(!isMobile && 'col-span-2')}>
          <Section icon={Eye} title="Live Preview">
            <div className="bg-muted/30 rounded-xl p-6 flex justify-center">
              <StorePreview
                storeName={tagline || businessName}
                description={description}
                category={category}
                city={city}
                country="CM"
                currency="FCFA"
                logoUrl={logoUrl}
                bannerUrl={coverUrl}
                isPublished={isPublished}
                template={template}
                primaryColor={primaryColor}
              />
            </div>
          </Section>
        </div>

        {/* Branding */}
        <Section icon={Palette} title="Branding">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Business Name</label>
              <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Your Business Name" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Tagline</label>
              <Input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Quality products at great prices" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Description</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell customers about your business…" rows={3} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Primary Color</label>
                <div className="flex gap-2">
                  <Input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-12 h-10 p-1 rounded-xl" />
                  <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 rounded-xl font-mono text-xs" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Accent Color</label>
                <div className="flex gap-2">
                  <Input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-12 h-10 p-1 rounded-xl" />
                  <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="flex-1 rounded-xl font-mono text-xs" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Logo URL</label>
              <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://…" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Cover Image URL</label>
              <Input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://…" className="rounded-xl" />
            </div>
          </div>
        </Section>

        {/* Category & Location */}
        <Section icon={Tag} title="Category & Location">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Main Category</label>
              <select value={category} onChange={e => { setCategory(e.target.value); setSubCategory(''); }} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">Select…</option>
                {STORE_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            {selectedCategoryObj && selectedCategoryObj.subs.length > 0 && (
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Sub-category</label>
                <select value={subCategory} onChange={e => setSubCategory(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="">Select…</option>
                  {selectedCategoryObj.subs.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            )}
            <CitySelector region={region} city={city} onRegionChange={setRegion} onCityChange={setCity} />
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Street Address</label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Rue de la Paix" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Phone</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+237 6XX XX XX XX" className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Email</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@business.cm" className="rounded-xl" />
              </div>
            </div>
          </div>
        </Section>

        {/* Operating Hours */}
        <div className={cn(!isMobile && 'col-span-2')}>
          <Section icon={Clock} title="Operating Hours">
            <div className={cn('gap-2', isMobile ? 'space-y-2' : 'grid grid-cols-2 gap-x-6 gap-y-2')}>
              {Object.entries(hours).map(([day, h]) => (
                <div key={day} className="flex items-center gap-2">
                  <div className="w-20 text-xs font-semibold capitalize text-foreground">{day}</div>
                  <label className="flex items-center gap-1.5 shrink-0">
                    <input type="checkbox" checked={!h.closed} onChange={e => updateDayHours(day, 'closed', !e.target.checked)} className="rounded" />
                    <span className="text-[11px] text-muted-foreground">Open</span>
                  </label>
                  {!h.closed && (
                    <>
                      <Input type="time" value={h.open} onChange={e => updateDayHours(day, 'open', e.target.value)} className="w-24 h-8 text-xs rounded-lg" />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="time" value={h.close} onChange={e => updateDayHours(day, 'close', e.target.value)} className="w-24 h-8 text-xs rounded-lg" />
                    </>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
