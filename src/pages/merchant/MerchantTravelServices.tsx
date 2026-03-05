import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Bus, Compass, Plane, Train, Plus, Check, Loader2, Database, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ServiceCategory {
  key: string;
  label: string;
  icon: React.ElementType;
  themeColor: string;
  bgColor: string;
  textColor: string;
  available: boolean;
}

const categories: ServiceCategory[] = [
  { key: 'bus', label: 'Bus Travel', icon: Bus, themeColor: '#F5C518', bgColor: 'bg-[hsl(48,90%,52%)]', textColor: 'text-[hsl(0,0%,10%)]', available: true },
  { key: 'tours', label: 'Tours', icon: Compass, themeColor: '#00BCD4', bgColor: 'bg-[hsl(187,100%,42%)]', textColor: 'text-white', available: true },
  { key: 'airlines', label: 'Airlines', icon: Plane, themeColor: '#D32F2F', bgColor: 'bg-[hsl(0,65%,51%)]', textColor: 'text-white', available: false },
  { key: 'trains', label: 'Trains', icon: Train, themeColor: '#212121', bgColor: 'bg-[hsl(0,0%,13%)]', textColor: 'text-white', available: false },
];

interface TravelService {
  id: string;
  service_type: string;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  theme_color: string | null;
  is_active: boolean;
}

const MerchantTravelServices: React.FC = () => {
  const [services, setServices] = useState<TravelService[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupType, setSetupType] = useState<string>('');
  const [setupName, setSetupName] = useState('');
  const [setupDesc, setSetupDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchMerchantAndServices();
  }, []);

  const fetchMerchantAndServices = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: merchant } = await supabase
      .from('gateway_merchants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!merchant) {
      setLoading(false);
      return;
    }

    setMerchantId(merchant.id);

    const { data } = await supabase
      .from('travel_services')
      .select('*')
      .eq('merchant_id', merchant.id);

    setServices((data as any[]) || []);
    setLoading(false);
  };

  const openSetup = (type: string) => {
    const cat = categories.find(c => c.key === type);
    setSetupType(type);
    setSetupName('');
    setSetupDesc('');
    setSetupOpen(true);
  };

  const handleCreate = async () => {
    if (!merchantId || !setupName.trim()) return;
    setSaving(true);

    const cat = categories.find(c => c.key === setupType);
    const { error } = await supabase.from('travel_services').insert({
      merchant_id: merchantId,
      service_type: setupType,
      display_name: setupName.trim(),
      description: setupDesc.trim() || null,
      theme_color: cat?.themeColor || null,
    } as any);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${cat?.label} service created!`);
      setSetupOpen(false);
      fetchMerchantAndServices();
    }
    setSaving(false);
  };

  const toggleActive = async (service: TravelService) => {
    const { error } = await supabase
      .from('travel_services')
      .update({ is_active: !service.is_active } as any)
      .eq('id', service.id);

    if (error) {
      toast.error(error.message);
    } else {
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, is_active: !s.is_active } : s));
    }
  };

  const activeTypes = services.map(s => s.service_type);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Travel Services</h1>
        <p className="text-muted-foreground">Set up and manage your transport & tourism offerings</p>
      </div>

      {/* Category Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((cat) => {
          const existing = services.find(s => s.service_type === cat.key);
          const CatIcon = cat.icon;
          return (
            <Card key={cat.key} className="relative overflow-hidden">
              {!cat.available && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <Badge variant="secondary" className="text-sm">Coming Soon</Badge>
                </div>
              )}
              <CardHeader className="pb-3">
                <div className={`mb-2 flex h-12 w-12 items-center justify-center rounded-xl ${cat.bgColor}`}>
                  <CatIcon className={`h-6 w-6 ${cat.textColor}`} />
                </div>
                <CardTitle className="text-lg">{cat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {existing ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{existing.display_name}</span>
                      <Badge variant={existing.is_active ? 'default' : 'secondary'}>
                        {existing.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={existing.is_active} onCheckedChange={() => toggleActive(existing)} />
                      <span className="text-xs text-muted-foreground">
                        {existing.is_active ? 'Service is live' : 'Service is paused'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => openSetup(cat.key)} disabled={!cat.available} className="w-full" variant="outline">
                    <Plus className="mr-2 h-4 w-4" /> Set Up
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active Services Table */}
      {services.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Services</CardTitle>
            <CardDescription>Manage your registered transport services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {services.map((svc) => {
                const cat = categories.find(c => c.key === svc.service_type);
                const CatIcon = cat?.icon || Bus;
                return (
                  <div key={svc.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cat?.bgColor || 'bg-muted'}`}>
                      <CatIcon className={`h-5 w-5 ${cat?.textColor || 'text-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{svc.display_name}</p>
                      <p className="text-sm text-muted-foreground">{cat?.label} · {svc.description || 'No description'}</p>
                    </div>
                    <Badge variant={svc.is_active ? 'default' : 'secondary'}>
                      {svc.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup Dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up {categories.find(c => c.key === setupType)?.label} Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Agency / Brand Name</Label>
              <Input placeholder="e.g. Touristique Express" value={setupName} onChange={(e) => setSetupName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea placeholder="Brief description of your service..." value={setupDesc} onChange={(e) => setSetupDesc(e.target.value)} rows={3} />
            </div>
            <Button onClick={handleCreate} disabled={!setupName.trim() || saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Create Service
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantTravelServices;
