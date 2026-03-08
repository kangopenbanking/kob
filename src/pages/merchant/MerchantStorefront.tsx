import React, { useState, useEffect } from 'react';
import { Store, Eye, EyeOff, QrCode, Upload, Save, Loader2, CheckCircle2, Crown, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

const CATEGORIES = ['Food', 'Fashion', 'Electronics', 'Beauty', 'Health & Wellness', 'Home', 'Services', 'Other'];
const CITIES = ['Douala', 'Yaoundé', 'Bamenda', 'Bafoussam', 'Buea', 'Limbe', 'Kribi', 'Garoua', 'Maroua'];

export default function MerchantStorefront() {
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [qrAmount, setQrAmount] = useState('');

  // Form state
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get merchant
      const { data: merchant } = await supabase.from('gateway_merchants')
        .select('id').eq('user_id', user.id).maybeSingle();
      if (!merchant) { setLoading(false); return; }
      setMerchantId(merchant.id);

      // Get store profile
      const { data: sp } = await supabase.from('pos_store_profiles')
        .select('*').eq('merchant_id', merchant.id).maybeSingle();
      if (sp) {
        setProfile(sp);
        setStoreName(sp.store_name || '');
        setDescription(sp.description || '');
        setCategory(sp.category || '');
        setCity(sp.city || '');
        setLogoUrl(sp.logo_url || '');
        setBannerUrl(sp.banner_url || '');
        setIsPublished(sp.is_published || false);
      }

      // Get subscription
      const { data: sub } = await supabase.from('pos_store_subscriptions')
        .select('*, pos_subscription_plans(*)')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .maybeSingle();
      setSubscription(sub);

      // Get available plans
      const { data: p } = await supabase.from('pos_subscription_plans')
        .select('*').eq('is_active', true).order('price');
      setPlans(p || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!merchantId) return;
    setSaving(true);
    try {
      const payload = {
        merchant_id: merchantId,
        store_name: storeName,
        description,
        category,
        city,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        is_published: isPublished,
        country: 'CM',
        updated_at: new Date().toISOString(),
      };

      if (profile) {
        await supabase.from('pos_store_profiles').update(payload).eq('id', profile.id);
      } else {
        const { data } = await supabase.from('pos_store_profiles').insert(payload).select().single();
        setProfile(data);
      }
      toast.success('Storefront saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!merchantId) return;
    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-store-subscription', {
        body: { merchant_id: merchantId, plan_id: planId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      toast.success('Subscription activated!');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Subscription failed');
    } finally {
      setSubscribing(false);
    }
  };

  const qrPayload = merchantId ? JSON.stringify({
    type: 'kob_pos_pay',
    merchant_id: merchantId,
    amount: qrAmount ? Number(qrAmount) : undefined,
    currency: 'XAF',
    store_name: storeName,
  }) : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Storefront</h1>
        <p className="text-muted-foreground">Manage your store on the consumer marketplace</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Store Profile</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="qr">QR Payments</TabsTrigger>
        </TabsList>

        {/* Store Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                Store Profile
              </CardTitle>
              <CardDescription>
                Configure your store's appearance on the consumer app marketplace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Store Name *</Label>
                  <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="My Store" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell customers about your store..." rows={3} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>
                      {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Logo URL</Label>
                  <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>

              <div>
                <Label>Banner URL</Label>
                <Input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="https://..." />
              </div>

              {/* Publish toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  {isPublished ? <Eye className="w-5 h-5 text-primary" /> : <EyeOff className="w-5 h-5 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium">Published</p>
                    <p className="text-xs text-muted-foreground">
                      {isPublished ? 'Your store is visible to consumers' : 'Your store is hidden from the marketplace'}
                    </p>
                  </div>
                </div>
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
              </div>

              {isPublished && !subscription && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    An active subscription is required for your store to appear on the marketplace.
                  </p>
                </div>
              )}

              <Button onClick={handleSave} disabled={saving || !storeName} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="space-y-4">
            {subscription ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-500" />
                    Active Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl">
                    <div>
                      <p className="font-semibold text-foreground">{subscription.pos_subscription_plans?.name}</p>
                      <p className="text-sm text-muted-foreground">{subscription.pos_subscription_plans?.price?.toLocaleString()} XAF / {subscription.pos_subscription_plans?.duration_days} days</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Expires: {new Date(subscription.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20">Active</Badge>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Marketplace Subscription</CardTitle>
                    <CardDescription>Subscribe to list your store on the consumer marketplace</CardDescription>
                  </CardHeader>
                </Card>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plans.map(plan => (
                    <Card key={plan.id} className="relative overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <h3 className="text-lg font-bold">{plan.name}</h3>
                        <p className="text-3xl font-extrabold text-primary mt-2">
                          {plan.price?.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">XAF</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{plan.duration_days} days</p>
                        {plan.features_json && (
                          <ul className="mt-4 space-y-1.5">
                            {(Array.isArray(plan.features_json) ? plan.features_json : []).map((f: string, i: number) => (
                              <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        )}
                        <Button
                          className="w-full mt-4"
                          disabled={subscribing}
                          onClick={() => handleSubscribe(plan.id)}
                        >
                          {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {plans.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-full text-center py-8">
                      No subscription plans available yet. Contact support.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* QR Payments Tab */}
        <TabsContent value="qr">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                QR Code Payments
              </CardTitle>
              <CardDescription>Generate QR codes for in-store payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Amount (optional)</Label>
                    <Input
                      type="number"
                      value={qrAmount}
                      onChange={e => setQrAmount(e.target.value)}
                      placeholder="Leave empty for any amount"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Leave empty to generate a static QR that lets customers enter any amount.
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1">
                    <p><strong>How it works:</strong></p>
                    <p>1. Customer opens the KOB app and scans the QR code</p>
                    <p>2. The app shows your store name and the payment amount</p>
                    <p>3. Customer confirms and pays directly from their wallet</p>
                    <p>4. Funds are instantly credited to your merchant wallet</p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center p-6 bg-background rounded-xl border border-border">
                  {merchantId ? (
                    <>
                      <QRCodeSVG value={qrPayload} size={180} level="M" />
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        {qrAmount ? `${Number(qrAmount).toLocaleString()} XAF` : 'Any amount'} · {storeName || 'Your Store'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Create a merchant account first</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
