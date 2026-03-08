import React, { useState, useEffect } from 'react';
import {
  Palette, Key, MapPin, UserCheck, Shield, Plus, Trash2, Loader2,
  Phone, Mail, Clock, CheckCircle2, Globe, Copy, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EnterpriseGate } from './EnterpriseGate';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface EnterpriseFeaturesTabProps {
  isEnterprise: boolean;
  merchantId: string | null;
  profile: any;
  onUpgrade: () => void;
  onProfileUpdate: () => void;
}

const FONT_OPTIONS = ['Inter', 'DM Sans', 'Poppins', 'Lato', 'Roboto', 'Nunito', 'Open Sans', 'Montserrat'];

export function EnterpriseFeaturesTab({ isEnterprise, merchantId, profile, onUpgrade, onProfileUpdate }: EnterpriseFeaturesTabProps) {
  // Branding state
  const brandJson = profile?.custom_brand_json || {};
  const [primaryColor, setPrimaryColor] = useState(brandJson.primary_color || '#7c3aed');
  const [secondaryColor, setSecondaryColor] = useState(brandJson.secondary_color || '#f59e0b');
  const [brandFont, setBrandFont] = useState(brandJson.font || 'Inter');
  const [receiptHeader, setReceiptHeader] = useState(brandJson.receipt_header || '');
  const [receiptFooter, setReceiptFooter] = useState(brandJson.receipt_footer || '');
  const [savingBrand, setSavingBrand] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState('sandbox');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  // Locations state
  const [locations, setLocations] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocCity, setNewLocCity] = useState('');

  // Manager state
  const [manager, setManager] = useState<any>(null);

  useEffect(() => {
    if (isEnterprise && merchantId) {
      loadApiKeys();
      loadLocations();
      loadManager();
    }
  }, [isEnterprise, merchantId]);

  const loadApiKeys = async () => {
    if (!merchantId) return;
    setLoadingKeys(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data } = await supabase.functions.invoke('gateway-merchant-keys', {
        method: 'GET',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: null,
      });
      // The function expects merchant_id as query param, but invoke doesn't support that easily.
      // Use direct fetch instead
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gateway-merchant-keys?merchant_id=${merchantId}`,
        { headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const json = await res.json();
      setApiKeys(json.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingKeys(false); }
  };

  const generateApiKey = async () => {
    if (!merchantId) return;
    setGeneratingKey(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gateway-merchant-keys`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ merchant_id: merchantId, environment: newKeyEnv, label: newKeyLabel || 'Default' }),
        }
      );
      const json = await res.json();
      if (json.api_key) {
        setRevealedKey(json.api_key);
        toast.success('API key generated. Copy it now — it won\'t be shown again.');
        setNewKeyLabel('');
        loadApiKeys();
      } else {
        toast.error(json.detail || 'Failed to generate key');
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setGeneratingKey(false); }
  };

  const revokeKey = async (keyId: string) => {
    if (!merchantId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gateway-merchant-keys`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key_id: keyId, merchant_id: merchantId }),
      });
      toast.success('Key revoked');
      loadApiKeys();
    } catch (err: any) { toast.error(err.message); }
  };

  const loadLocations = async () => {
    if (!merchantId) return;
    setLoadingLocations(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-manage-locations?entity=location&merchant_id=${merchantId}`,
        { headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const json = await res.json();
      setLocations(json.locations || []);
    } catch (err) { console.error(err); }
    finally { setLoadingLocations(false); }
  };

  const addLocation = async () => {
    if (!merchantId || !newLocName.trim()) return;
    setAddingLocation(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-manage-locations?entity=location`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ merchant_id: merchantId, name: newLocName, city: newLocCity || 'Douala' }),
      });
      const json = await res.json();
      if (json.id) {
        toast.success('Location added');
        setNewLocName('');
        setNewLocCity('');
        loadLocations();
      } else {
        toast.error(json.error || 'Failed');
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setAddingLocation(false); }
  };

  const loadManager = async () => {
    if (!profile?.account_manager_id) return;
    const { data } = await supabase.from('profiles').select('full_name, email').eq('id', profile.account_manager_id).maybeSingle();
    setManager(data);
  };

  const saveBranding = async () => {
    if (!profile?.id) return;
    setSavingBrand(true);
    try {
      await (supabase.from('pos_store_profiles') as any).update({
        custom_brand_json: { primary_color: primaryColor, secondary_color: secondaryColor, font: brandFont, receipt_header: receiptHeader, receipt_footer: receiptFooter },
      }).eq('id', profile.id);
      toast.success('Branding saved');
      onProfileUpdate();
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingBrand(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
      {/* 1. Custom Branding */}
      <EnterpriseGate isEnterprise={isEnterprise} onUpgrade={onUpgrade}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} /> Custom Branding
            </CardTitle>
            <CardDescription className="text-xs">Customise colours, fonts, and receipt branding for your store</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Primary Colour</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer" />
                  <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Secondary Colour</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer" />
                  <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="text-xs font-mono" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Brand Font</Label>
              <Select value={brandFont} onValueChange={setBrandFont}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Receipt Header Text</Label>
                <Textarea value={receiptHeader} onChange={e => setReceiptHeader(e.target.value)} placeholder="Welcome to our store!" rows={2} className="text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Receipt Footer Text</Label>
                <Textarea value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} placeholder="Thank you for your purchase!" rows={2} className="text-xs" />
              </div>
            </div>
            {/* Preview */}
            <div className="p-4 rounded-xl border bg-muted/30">
              <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">Preview</p>
              <div className="p-4 rounded-lg bg-card border text-center space-y-1" style={{ fontFamily: brandFont }}>
                <div className="h-2 w-20 rounded-full mx-auto" style={{ backgroundColor: primaryColor }} />
                <p className="text-xs font-bold mt-2" style={{ color: primaryColor }}>{profile?.store_name || 'Your Store'}</p>
                <p className="text-[10px] text-muted-foreground">{receiptHeader || 'Receipt header text'}</p>
                <div className="border-t border-dashed my-2" />
                <p className="text-[10px] text-muted-foreground">{receiptFooter || 'Receipt footer text'}</p>
                <div className="h-1.5 w-12 rounded-full mx-auto mt-1" style={{ backgroundColor: secondaryColor }} />
              </div>
            </div>
            <Button onClick={saveBranding} disabled={savingBrand} className="bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white rounded-xl gap-2">
              {savingBrand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
              Save Branding
            </Button>
          </CardContent>
        </Card>
      </EnterpriseGate>

      {/* 2. API Access */}
      <EnterpriseGate isEnterprise={isEnterprise} onUpgrade={onUpgrade}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Key className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} /> API Access
            </CardTitle>
            <CardDescription className="text-xs">Generate and manage API keys for programmatic access to your POS data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generate key */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Input value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)} placeholder="Key label (e.g. Mobile App)" className="text-xs flex-1" />
              <Select value={newKeyEnv} onValueChange={setNewKeyEnv}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={generateApiKey} disabled={generatingKey} className="bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white rounded-xl gap-2">
                {generatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Generate Key
              </Button>
            </div>

            {/* Revealed key */}
            {revealedKey && (
              <div className="p-3 rounded-xl border border-[hsl(var(--fi-amber))]/30 bg-[hsl(var(--fi-amber))]/5 space-y-2">
                <p className="text-xs font-semibold text-[hsl(var(--fi-amber))]">⚠ Copy this key now — it won't be shown again</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted p-2 rounded-lg flex-1 break-all font-mono">{revealedKey}</code>
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(revealedKey); toast.success('Copied'); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Key list */}
            {loadingKeys ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : apiKeys.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No API keys yet. Generate one above.</p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((k: any) => (
                  <div key={k.id} className="flex items-center justify-between p-3 rounded-xl border bg-card">
                    <div className="flex items-center gap-3 min-w-0">
                      <Key className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{k.label || 'Unnamed'}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{k.api_key_prefix}•••</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={k.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {k.is_active ? k.environment : 'Revoked'}
                      </Badge>
                      {k.is_active && (
                        <Button size="icon" variant="ghost" onClick={() => revokeKey(k.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Endpoint info */}
            <div className="p-3 rounded-xl border bg-muted/30 space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">API Base URL</p>
              <code className="text-xs font-mono text-foreground">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/</code>
              <p className="text-[10px] text-muted-foreground mt-1">Use your API key in the <code className="bg-muted px-1 rounded">Authorization: Bearer</code> header</p>
            </div>
          </CardContent>
        </Card>
      </EnterpriseGate>

      {/* 3. Multi-location Inventory */}
      <EnterpriseGate isEnterprise={isEnterprise} onUpgrade={onUpgrade}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} /> Multi-location Inventory
            </CardTitle>
            <CardDescription className="text-xs">Manage inventory across multiple physical store locations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input value={newLocName} onChange={e => setNewLocName(e.target.value)} placeholder="Location name (e.g. Main Branch)" className="text-xs flex-1" />
              <Input value={newLocCity} onChange={e => setNewLocCity(e.target.value)} placeholder="City (e.g. Douala)" className="text-xs w-40" />
              <Button onClick={addLocation} disabled={addingLocation || !newLocName.trim()} className="bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white rounded-xl gap-2">
                {addingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Location
              </Button>
            </div>

            {loadingLocations ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : locations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No locations configured. Add your first location above.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {locations.map((loc: any) => (
                  <div key={loc.id} className="p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{loc.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{loc.city || 'Douala'}, {loc.country || 'CM'}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{loc.currency_default || 'XAF'}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
                      <Globe className="w-3 h-3" /> {loc.timezone || 'Africa/Douala'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </EnterpriseGate>

      {/* 4. Dedicated Account Manager */}
      <EnterpriseGate isEnterprise={isEnterprise} onUpgrade={onUpgrade}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} /> Dedicated Account Manager
            </CardTitle>
            <CardDescription className="text-xs">Your personal point of contact for support, onboarding, and growth</CardDescription>
          </CardHeader>
          <CardContent>
            {manager ? (
              <div className="p-4 rounded-xl border bg-card space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-[hsl(var(--fi-purple))]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{manager.full_name || 'Account Manager'}</p>
                    <p className="text-xs text-muted-foreground">{manager.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5 rounded-lg">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5 rounded-lg">
                    <Phone className="w-3.5 h-3.5" /> Request Callback
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed bg-muted/20 text-center">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Pending Assignment</p>
                <p className="text-xs text-muted-foreground mt-1">Your dedicated account manager will be assigned within 24 hours of Enterprise activation.</p>
                <Button size="sm" variant="outline" className="mt-4 text-xs gap-1.5 rounded-lg">
                  <Phone className="w-3.5 h-3.5" /> Request Callback
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </EnterpriseGate>

      {/* 5. SLA Guarantee */}
      <EnterpriseGate isEnterprise={isEnterprise} onUpgrade={onUpgrade}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} /> SLA Guarantee
            </CardTitle>
            <CardDescription className="text-xs">Enterprise-grade service level agreement for your business</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Uptime', value: '99.9%', desc: 'Guaranteed platform availability', icon: CheckCircle2 },
                { label: 'Response Time', value: '< 2hrs', desc: 'Priority support response', icon: Clock },
                { label: 'Recovery', value: '< 4hrs', desc: 'Incident resolution target', icon: RefreshCw },
              ].map((sla) => (
                <div key={sla.label} className="p-4 rounded-xl border bg-card text-center">
                  <sla.icon className="w-6 h-6 text-[hsl(var(--fi-purple))] mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-2xl font-bold text-foreground">{sla.value}</p>
                  <p className="text-xs font-medium text-foreground mt-1">{sla.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sla.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl border bg-muted/30 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">SLA Terms</p>
              <p>• Service credits applied automatically if uptime drops below 99.9% in any calendar month.</p>
              <p>• Priority escalation path for critical issues affecting business operations.</p>
              <p>• Dedicated Slack/WhatsApp channel for real-time communication.</p>
              <p>• Monthly SLA compliance report delivered to your dashboard.</p>
            </div>
          </CardContent>
        </Card>
      </EnterpriseGate>
    </motion.div>
  );
}
