import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Upload, Palette, Clock, MapPin, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CAMEROON_CITIES } from '@/lib/storefront-data';

export default function BusinessStorefront() {
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Storefront data
  const [businessName, setBusinessName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [accentColor, setAccentColor] = useState('#c084fc');

  // Location
  const [region, setRegion] = useState('Centre');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Hours
  const [hours, setHours] = useState({
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '10:00', close: '16:00', closed: false },
    sunday: { open: '', close: '', closed: true },
  });

  // Get merchant ID and load storefront
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: merchant } = await supabase
        .from('gateway_merchants')
        .select('id, business_name')
        .eq('user_id', user.id)
        .single();

      if (merchant) {
        setMerchantId(merchant.id);
        setBusinessName(merchant.business_name || '');
        loadStorefront(merchant.id);
      }
    };
    init();
  }, []);

  const loadStorefront = async (mId: string) => {
    const { data } = await supabase
      .from('pos_store_profiles')
      .select('*')
      .eq('merchant_id', mId)
      .single();

    if (data) {
      setTagline(data.tagline || '');
      setDescription(data.description || '');
      setLogoUrl(data.logo_url || '');
      setCoverUrl(data.cover_image_url || '');
      setPrimaryColor(data.brand_primary_color || '#7c3aed');
      setAccentColor(data.brand_accent_color || '#c084fc');
      setRegion(data.region || 'Centre');
      setCity(data.city || '');
      setAddress(data.address || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      if (data.operating_hours) {
        setHours(data.operating_hours as any);
      }
    }
  };

  const handleSave = async () => {
    if (!merchantId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pos_store_profiles')
        .upsert({
          merchant_id: merchantId,
          tagline,
          description,
          logo_url: logoUrl,
          cover_image_url: coverUrl,
          brand_primary_color: primaryColor,
          brand_accent_color: accentColor,
          region,
          city,
          address,
          phone,
          email,
          operating_hours: hours,
        });

      if (error) throw error;

      toast.success('Storefront updated');
      navigate('/business/home');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const updateDayHours = (day: string, field: string, value: any) => {
    setHours(prev => ({
      ...prev,
      [day]: { ...prev[day as keyof typeof prev], [field]: value }
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Storefront</h1>
            <p className="text-primary-foreground/80 text-sm">Customize your online store</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        {/* Branding */}
        <Card className="p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Business Name</label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your Business Name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tagline</label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Quality products at great prices"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell customers about your business..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Primary Color</label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Accent Color</label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Logo URL</label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 200x200px square image
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Cover Image URL</label>
              <Input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 1200x400px banner image
              </p>
            </div>
          </div>
        </Card>

        {/* Location & Contact */}
        <Card className="p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location & Contact
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Region</label>
                <select
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    setCity('');
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.keys(CAMEROON_CITIES).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select city...</option>
                  {CAMEROON_CITIES[region]?.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Street Address</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 123 Rue de la Paix"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Phone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+237 6XX XX XX XX"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@business.cm"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Operating Hours */}
        <Card className="p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Operating Hours
          </h2>
          <div className="space-y-3">
            {Object.entries(hours).map(([day, h]) => (
              <div key={day} className="flex items-center gap-2">
                <div className="w-24 text-sm font-medium capitalize">{day}</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!h.closed}
                    onChange={(e) => updateDayHours(day, 'closed', !e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs">Open</span>
                </label>
                {!h.closed && (
                  <>
                    <Input
                      type="time"
                      value={h.open}
                      onChange={(e) => updateDayHours(day, 'open', e.target.value)}
                      className="w-28"
                    />
                    <span className="text-xs">-</span>
                    <Input
                      type="time"
                      value={h.close}
                      onChange={(e) => updateDayHours(day, 'close', e.target.value)}
                      className="w-28"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={loading} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Storefront'}
        </Button>
      </div>
    </div>
  );
}
