import React, { useState, useEffect, useMemo } from 'react';
import {
  Store, Eye, EyeOff, QrCode, Save, Loader2, CheckCircle2,
  Crown, AlertCircle, Globe, MapPin, Tag, Image, FileText,
  Download, Printer, Sparkles, Shield, Zap, Users, BarChart3,
  ArrowRight, CreditCard, Smartphone, Wallet, RefreshCw, Copy, Check,
  BookOpen, ChevronRight, Circle, Plus, X, Package, Settings, HelpCircle,
  ListChecks, Layers, DollarSign, Monitor, Truck, Hash, Clock, MapPinIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { useSupportedCountries } from '@/hooks/useSupportedCountries';
import {
  STORE_CATEGORIES, getAllCitiesForCountry, getCitiesByRegion,
  POS_PRODUCT_ATTRIBUTES, COUNTRY_CURRENCIES, type POSAttribute,
} from '@/lib/storefront-data';

import posKob from '@/assets/pos-kob.webp';
import posPaymentSuccess from '@/assets/pos-payment-success.webp';
import { ImageUpload } from '@/components/storefront/ImageUpload';
import { StorePreview, StorePreviewDialog } from '@/components/storefront/StorePreview';
import { ShippingForm } from '@/components/storefront/ShippingForm';
import { DemoStoreTab } from '@/components/storefront/DemoStoreTab';
import { EnterpriseFeaturesTab } from '@/components/storefront/EnterpriseFeaturesTab';
import { EnterpriseUpgradeModal } from '@/components/storefront/EnterpriseUpgradeModal';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } }),
};

// ─── Guide Steps ───
const GUIDE_STEPS = [
  { id: 'profile', title: 'Set Up Your Store Profile', icon: Store, description: 'Enter your store name, description, category, and location. This is how customers will find and recognise you on the marketplace.', tips: ['Choose a clear, memorable store name', 'Write a short description that highlights what makes you unique', 'Pick the correct category so customers can find you easily'] },
  { id: 'brand', title: 'Upload Brand Assets', icon: Image, description: 'Add your logo and a banner image to make your storefront stand out. Professional visuals build customer trust.', tips: ['Use a square logo (min 200×200px)', 'Banner should be wide (1200×400px recommended)', 'Use high-quality images with good lighting'] },
  { id: 'country', title: 'Select Country & Currency', icon: Globe, description: 'Choose your country and operating currency. Cameroon (XAF) is the default but you can serve customers in other supported countries.', tips: ['Currency determines how prices display to customers', 'You can change this anytime before going live'] },
  { id: 'category', title: 'Choose Category & Sub-Category', icon: Tag, description: 'Select a main category and optional sub-category that best describes your business. This helps the marketplace organise stores for customers.', tips: ['You can add a custom sub-category if none fits', 'Categories affect search ranking and discoverability'] },
  { id: 'attributes', title: 'Configure Product Attributes', icon: Package, description: 'Set up the product attributes you\'ll use in your POS system: SKU, barcode, weight, unit, pricing, stock levels, and more.', tips: ['Attributes help you track inventory accurately', 'Set low-stock alerts to avoid running out', 'Use SKU codes for easy product identification'] },
  { id: 'subscribe', title: 'Subscribe to a Plan', icon: Crown, description: 'Choose a subscription plan to publish your store on the KOB consumer marketplace and start receiving orders.', tips: ['You can upgrade or change plans anytime', 'Premium plans include analytics and priority placement'] },
  { id: 'publish', title: 'Publish & Go Live', icon: Eye, description: 'Toggle your store to "Published" and you\'re live! Customers can now discover your store, browse products, and pay via wallet or QR.', tips: ['Make sure your profile is 100% complete before publishing', 'Share your QR code at your physical store counter'] },
];

export default function MerchantStorefront() {
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [qrAmount, setQrAmount] = useState('');
  const [qrCopied, setQrCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('guide');

  // Profile form
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [customSubCategory, setCustomSubCategory] = useState('');
  const [showCustomSub, setShowCustomSub] = useState(false);
  const [city, setCity] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [country, setCountry] = useState('CM');
  const [currency, setCurrency] = useState('XAF');

  // POS attributes
  const [customAttributes, setCustomAttributes] = useState<{ key: string; label: string }[]>([]);
  const [newAttrLabel, setNewAttrLabel] = useState('');

  // Guide
  const [expandedStep, setExpandedStep] = useState<string | null>('profile');

  const { data: supportedCountries = [] } = useSupportedCountries();

  // Derived
  const cities = useMemo(() => getAllCitiesForCountry(country), [country]);
  const cityRegions = useMemo(() => getCitiesByRegion(country), [country]);
  const selectedCategoryObj = useMemo(() => STORE_CATEGORIES.find(c => c.name === category), [category]);
  const currencyInfo = COUNTRY_CURRENCIES[country] || { currency: 'XAF', symbol: 'FCFA' };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const info = COUNTRY_CURRENCIES[country];
    if (info) setCurrency(info.currency);
  }, [country]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id).maybeSingle();
      if (!merchant) { setLoading(false); return; }
      setMerchantId(merchant.id);
      const { data: sp } = await supabase.from('pos_store_profiles').select('*').eq('merchant_id', merchant.id).maybeSingle();
      if (sp) {
        setProfile(sp);
        setStoreName(sp.store_name || '');
        setDescription(sp.description || '');
        setCategory(sp.category || '');
        setCity(sp.city || '');
        setLogoUrl(sp.logo_url || '');
        setBannerUrl(sp.banner_url || '');
        setIsPublished(sp.is_published || false);
        setCountry(sp.country || 'CM');
      }
      const { data: sub } = await supabase.from('pos_store_subscriptions').select('*, pos_subscription_plans(*)').eq('merchant_id', merchant.id).eq('status', 'active').maybeSingle();
      setSubscription(sub);
      const { data: p } = await supabase.from('pos_subscription_plans').select('*').eq('is_active', true).order('price');
      setPlans(p || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!merchantId) return;
    setSaving(true);
    try {
      const payload = {
        merchant_id: merchantId, store_name: storeName, description, category,
        city, logo_url: logoUrl, banner_url: bannerUrl, is_published: isPublished,
        country, updated_at: new Date().toISOString(),
      };
      if (profile) {
        await supabase.from('pos_store_profiles').update(payload).eq('id', profile.id);
      } else {
        const { data } = await supabase.from('pos_store_profiles').insert(payload).select().single();
        setProfile(data);
      }
      toast.success('Storefront saved successfully');
    } catch (err: any) { toast.error(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleSubscribe = async (planId: string) => {
    if (!merchantId) return;
    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-store-subscription', { body: { merchant_id: merchantId, plan_id: planId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      toast.success('Subscription activated!');
      loadData();
    } catch (err: any) { toast.error(err.message || 'Subscription failed'); }
    finally { setSubscribing(false); }
  };

  const addCustomAttribute = () => {
    if (!newAttrLabel.trim()) return;
    setCustomAttributes(prev => [...prev, { key: `custom_${Date.now()}`, label: newAttrLabel.trim() }]);
    setNewAttrLabel('');
  };

  const removeCustomAttribute = (key: string) => {
    setCustomAttributes(prev => prev.filter(a => a.key !== key));
  };

  const qrPayload = merchantId ? JSON.stringify({
    type: 'kob_pos_pay', merchant_id: merchantId,
    amount: qrAmount ? Number(qrAmount) : undefined,
    currency, store_name: storeName,
  }) : '';

  const copyQr = () => {
    navigator.clipboard.writeText(qrPayload);
    setQrCopied(true);
    toast.success('QR data copied');
    setTimeout(() => setQrCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--fi-purple))]" />
      </div>
    );
  }

  const profileComplete = storeName && category && city && description;
  const completionPct = [storeName, category, city, description, logoUrl, bannerUrl].filter(Boolean).length / 6 * 100;
  const resolvedSubCategory = showCustomSub ? customSubCategory : subCategory;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8 bg-[hsl(var(--fi-purple))]">
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Store className="w-7 h-7 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{storeName || 'Your Storefront'}</h1>
              <p className="text-white/70 text-sm mt-0.5">Manage your marketplace presence and accept payments</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {subscription ? (
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-3 py-1.5 text-xs font-medium">
                <Crown className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> Active Plan
              </Badge>
            ) : (
              <Badge variant="outline" className="border-white/30 text-white/80 px-3 py-1.5 text-xs">No Subscription</Badge>
            )}
            {isPublished && (
              <Badge className="bg-emerald-500/30 text-white border-emerald-400/30 backdrop-blur-sm px-3 py-1.5 text-xs">
                <Globe className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> Live
              </Badge>
            )}
          </div>
        </div>
        <div className="relative mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/60 font-medium">Profile completeness</span>
            <span className="text-xs text-white font-semibold">{Math.round(completionPct)}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-secondary" initial={{ width: 0 }} animate={{ width: `${completionPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Status', value: isPublished ? 'Published' : 'Draft', icon: isPublished ? Eye : EyeOff, color: isPublished ? 'hsl(var(--fi-green))' : 'hsl(var(--muted-foreground))' },
          { label: 'Subscription', value: subscription ? 'Active' : 'None', icon: Crown, color: subscription ? 'hsl(var(--fi-amber))' : 'hsl(var(--muted-foreground))' },
          { label: 'Category', value: category || 'Not set', icon: Tag, color: 'hsl(var(--fi-purple))' },
          { label: 'Location', value: city ? `${city}, ${country}` : 'Not set', icon: MapPin, color: 'hsl(var(--fi-blue))' },
        ].map((stat, i) => (
          <motion.div key={stat.label} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                    <stat.icon className="w-4 h-4" style={{ color: stat.color }} strokeWidth={1.5} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-sm font-semibold text-foreground truncate">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="bg-muted/60 p-1 rounded-xl h-auto flex-wrap">
          <TabsTrigger value="guide" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5 text-xs font-medium gap-2">
            <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} /> Setup Guide
          </TabsTrigger>
          <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5 text-xs font-medium gap-2">
            <Store className="w-3.5 h-3.5" strokeWidth={1.5} /> Store Profile
          </TabsTrigger>
          <TabsTrigger value="attributes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5 text-xs font-medium gap-2">
            <Package className="w-3.5 h-3.5" strokeWidth={1.5} /> POS Attributes
          </TabsTrigger>
          <TabsTrigger value="subscription" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5 text-xs font-medium gap-2">
            <Crown className="w-3.5 h-3.5" strokeWidth={1.5} /> Subscription
          </TabsTrigger>
          <TabsTrigger value="qr" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5 text-xs font-medium gap-2">
            <QrCode className="w-3.5 h-3.5" strokeWidth={1.5} /> QR Payments
          </TabsTrigger>
          <TabsTrigger value="preview" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5 text-xs font-medium gap-2">
            <Monitor className="w-3.5 h-3.5" strokeWidth={1.5} /> Store Preview
          </TabsTrigger>
          <TabsTrigger value="shipping" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5 text-xs font-medium gap-2">
            <Truck className="w-3.5 h-3.5" strokeWidth={1.5} /> Shipping
          </TabsTrigger>
          <TabsTrigger value="demo" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5 text-xs font-medium gap-2">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} /> Demo Store
          </TabsTrigger>
          <TabsTrigger value="enterprise" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2.5 text-xs font-medium gap-2">
            <Crown className="w-3.5 h-3.5" strokeWidth={1.5} /> Enterprise
          </TabsTrigger>
        </TabsList>

        {/* ── Setup Guide ── */}
        <TabsContent value="guide">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-3">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      Storefront Setup Guide
                    </CardTitle>
                    <CardDescription className="text-xs">Follow these steps to set up your store and start selling on KOB</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-5">
                    {GUIDE_STEPS.map((step, i) => {
                      const isExpanded = expandedStep === step.id;
                      const StepIcon = step.icon;
                      return (
                        <div key={step.id} className="rounded-xl border border-border/50 overflow-hidden">
                          <button
                            onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[hsl(var(--fi-purple))]/10">
                              <span className="text-xs font-bold text-[hsl(var(--fi-purple))]">{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground">{step.title}</p>
                            </div>
                            <StepIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                            <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} strokeWidth={1.5} />
                          </button>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.2 }}
                              className="px-4 pb-4 border-t border-border/30">
                              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{step.description}</p>
                              {step.tips.length > 0 && (
                                <ul className="mt-3 space-y-1.5">
                                  {step.tips.map((tip, j) => (
                                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--fi-purple))] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <Button variant="outline" size="sm" className="mt-3 text-xs gap-1.5 rounded-lg h-8"
                                onClick={() => {
                                  if (step.id === 'subscribe') setActiveTab('subscription');
                                  else if (step.id === 'publish' || step.id === 'profile' || step.id === 'brand' || step.id === 'country' || step.id === 'category') setActiveTab('profile');
                                  else if (step.id === 'attributes') setActiveTab('attributes');
                                }}>
                                Go to this step <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Guide Sidebar */}
              <div className="space-y-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <HelpCircle className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      <p className="text-sm font-semibold text-foreground">Quick Tips</p>
                    </div>
                    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                      <p>• Complete all profile fields for better marketplace visibility.</p>
                      <p>• A subscription is required to appear in the consumer app.</p>
                      <p>• Print your QR code and place it at your checkout counter.</p>
                      <p>• Set accurate product attributes for reliable POS inventory.</p>
                      <p>• Default currency is <strong>XAF</strong> (Cameroon). Change it under Store Profile.</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="relative">
                    <img src={posKob} alt="KOB POS Terminal" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute bottom-3 left-3">
                      <p className="text-white text-xs font-bold">KOB POS Terminal</p>
                      <p className="text-white/70 text-[10px]">Accept payments in-store</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ── Store Profile ── */}
        <TabsContent value="profile">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {/* Basic Info */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Store Name</Label>
                        <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="e.g. Chez Marie" className="h-10 rounded-lg border-border/60" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                        <Select value={category} onValueChange={v => { setCategory(v); setSubCategory(''); setShowCustomSub(false); }}>
                          <SelectTrigger className="h-10 rounded-lg border-border/60"><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            {STORE_CATEGORIES.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Sub-Category */}
                    {selectedCategoryObj && selectedCategoryObj.subs.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Sub-Category</Label>
                        {!showCustomSub ? (
                          <div className="flex gap-2">
                            <Select value={subCategory} onValueChange={setSubCategory}>
                              <SelectTrigger className="h-10 rounded-lg border-border/60 flex-1"><SelectValue placeholder="Select sub-category (optional)" /></SelectTrigger>
                              <SelectContent>
                                {selectedCategoryObj.subs.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg flex-shrink-0" onClick={() => setShowCustomSub(true)} title="Add custom">
                              <Plus className="w-4 h-4" strokeWidth={1.5} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Input value={customSubCategory} onChange={e => setCustomSubCategory(e.target.value)} placeholder="Enter custom sub-category" className="h-10 rounded-lg border-border/60 flex-1" />
                            <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg flex-shrink-0" onClick={() => { setShowCustomSub(false); setCustomSubCategory(''); }} title="Back to list">
                              <X className="w-4 h-4" strokeWidth={1.5} />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                      <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell customers what makes your store special..." rows={3} className="rounded-lg border-border/60 resize-none" />
                    </div>

                    {/* Country & Currency */}
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Country</Label>
                        <Select value={country} onValueChange={v => { setCountry(v); setCity(''); }}>
                          <SelectTrigger className="h-10 rounded-lg border-border/60"><SelectValue placeholder="Select country" /></SelectTrigger>
                          <SelectContent>
                            {supportedCountries.length > 0 ? (
                              supportedCountries.map(c => (
                                <SelectItem key={`${c.code}-${c.country}`} value={c.code}>{c.flag} {c.country}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="CM">🇨🇲 Cameroon</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Currency</Label>
                        <Input value={`${currencyInfo.currency} (${currencyInfo.symbol})`} disabled className="h-10 rounded-lg bg-muted/40" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">City / Town</Label>
                        {cities.length > 0 ? (
                          <Select value={city} onValueChange={setCity}>
                            <SelectTrigger className="h-10 rounded-lg border-border/60"><SelectValue placeholder="Select city" /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(cityRegions).map(([region, regionCities]) => (
                                <React.Fragment key={region}>
                                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{region}</div>
                                  {regionCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </React.Fragment>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Enter city name" className="h-10 rounded-lg border-border/60" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Brand Assets */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Image className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      Brand Assets
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ImageUpload
                      label="Store Logo"
                      value={logoUrl}
                      onChange={setLogoUrl}
                      folder="logos"
                      placeholder="Upload logo or paste URL"
                      previewClass="w-16 h-16 rounded-xl object-cover"
                    />
                    <ImageUpload
                      label="Cover / Banner Image"
                      value={bannerUrl}
                      onChange={setBannerUrl}
                      folder="banners"
                      placeholder="Upload banner or paste URL"
                      previewClass="w-full h-24 rounded-lg object-cover"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {isPublished ? <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> : <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />}
                        <span className="text-sm font-semibold text-foreground">{isPublished ? 'Published' : 'Draft'}</span>
                      </div>
                      <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {isPublished ? 'Your store is visible on the KOB consumer marketplace.' : 'Toggle to publish your store and start receiving orders.'}
                    </p>
                    {isPublished && !subscription && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">Subscribe to a plan to appear on the marketplace.</p>
                      </div>
                    )}
                    <Button onClick={handleSave} disabled={saving || !storeName}
                      className="w-full gap-2 rounded-lg h-10 text-xs font-semibold bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" strokeWidth={1.5} />}
                      Save Changes
                    </Button>
                  </div>
                </Card>

                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="relative">
                    <img src={posKob} alt="KOB POS Terminal" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute bottom-3 left-3">
                      <p className="text-white text-xs font-bold">KOB POS Terminal</p>
                      <p className="text-white/70 text-[10px]">Accept payments in-store</p>
                    </div>
                  </div>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">Quick Actions</p>
                    {[
                      { label: 'Setup Guide', action: () => setActiveTab('guide'), icon: BookOpen },
                      { label: 'Store Preview', action: () => setActiveTab('preview'), icon: Monitor },
                      { label: 'Generate QR Code', action: () => setActiveTab('qr'), icon: QrCode },
                      { label: 'Manage Subscription', action: () => setActiveTab('subscription'), icon: Crown },
                      { label: 'POS Attributes', action: () => setActiveTab('attributes'), icon: Package },
                    ].map((item) => (
                      <button key={item.label} onClick={item.action}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-xs text-foreground hover:bg-muted/50 transition-colors text-left">
                        <item.icon className="w-3.5 h-3.5 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                        {item.label}
                        <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto" strokeWidth={1.5} />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ── POS Attributes ── */}
        <TabsContent value="attributes">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">
            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {/* Built-in Attributes */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      Standard Product Attributes
                    </CardTitle>
                    <CardDescription className="text-xs">These are the built-in attributes available for every product in your POS system.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {POS_PRODUCT_ATTRIBUTES.map((attr) => (
                        <div key={attr.key} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/10">
                          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center flex-shrink-0">
                            {attr.type === 'number' ? <DollarSign className="w-3.5 h-3.5 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} /> :
                             attr.type === 'select' ? <Layers className="w-3.5 h-3.5 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} /> :
                             <Tag className="w-3.5 h-3.5 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{attr.label}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {attr.type === 'select' ? `Options: ${attr.options?.join(', ')}` : `Type: ${attr.type} ${attr.placeholder ? `• e.g. ${attr.placeholder}` : ''}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Custom Attributes */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Settings className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      Custom Attributes
                    </CardTitle>
                    <CardDescription className="text-xs">Add your own product attributes to support your specific business needs.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input value={newAttrLabel} onChange={e => setNewAttrLabel(e.target.value)} placeholder="e.g. Origin Country, Fabric Type..."
                        className="h-10 rounded-lg border-border/60 flex-1" onKeyDown={e => e.key === 'Enter' && addCustomAttribute()} />
                      <Button onClick={addCustomAttribute} disabled={!newAttrLabel.trim()}
                        className="h-10 gap-1.5 rounded-lg text-xs bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white">
                        <Plus className="w-4 h-4" strokeWidth={1.5} /> Add
                      </Button>
                    </div>
                    {customAttributes.length > 0 ? (
                      <div className="space-y-2">
                        {customAttributes.map(attr => (
                          <div key={attr.key} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/10">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center">
                                <Tag className="w-3 h-3 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                              </div>
                              <span className="text-xs font-medium text-foreground">{attr.label}</span>
                              <Badge variant="outline" className="text-[10px]">Custom</Badge>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeCustomAttribute(attr.key)}>
                              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" strokeWidth={1.5} />
                        No custom attributes yet. Add one above.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Attributes Sidebar */}
              <div className="space-y-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <HelpCircle className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      <p className="text-sm font-semibold text-foreground">About Attributes</p>
                    </div>
                    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                      <p>Attributes define the data fields available for each product you create in the POS system.</p>
                      <p><strong>Standard attributes</strong> (SKU, price, stock, etc.) are always available for all products.</p>
                      <p><strong>Custom attributes</strong> let you track additional info specific to your business, such as origin, material, or certification.</p>
                      <p>Attributes are used during product creation and appear on receipts and inventory reports.</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-foreground mb-2">Summary</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Standard attributes</span>
                        <span className="font-semibold text-foreground">{POS_PRODUCT_ATTRIBUTES.length}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Custom attributes</span>
                        <span className="font-semibold text-foreground">{customAttributes.length}</span>
                      </div>
                      <div className="border-t border-border/40 pt-2 flex justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Total</span>
                        <span className="font-bold text-foreground">{POS_PRODUCT_ATTRIBUTES.length + customAttributes.length}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ── Subscription ── */}
        <TabsContent value="subscription">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">
            {subscription ? (
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="p-1 bg-[hsl(var(--fi-purple))]">
                  <div className="bg-card rounded-xl p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[hsl(var(--fi-purple))]">
                          <Crown className="w-6 h-6 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-foreground">{subscription.pos_subscription_plans?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {subscription.pos_subscription_plans?.price?.toLocaleString()} {currency} / {subscription.pos_subscription_plans?.duration_days} days
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-3 py-1">Active</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Started</p>
                        <p className="text-sm font-semibold text-foreground mt-1">{new Date(subscription.starts_at).toLocaleDateString()}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Expires</p>
                        <p className="text-sm font-semibold text-foreground mt-1">{new Date(subscription.expires_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="mt-4 gap-2 text-xs rounded-lg" onClick={loadData}>
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} /> Refresh Status
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <>
                <div className="text-center max-w-lg mx-auto">
                  <h2 className="text-xl font-bold text-foreground">Choose Your Plan</h2>
                  <p className="text-sm text-muted-foreground mt-1">Get listed on the KOB consumer marketplace and start receiving orders</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plans.map((plan, i) => {
                    const isPremium = i === plans.length - 1;
                    return (
                      <motion.div key={plan.id} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                        <Card className={`border-0 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-lg relative ${isPremium ? 'ring-2 ring-[hsl(var(--fi-purple))]/30' : ''}`}>
                          {isPremium && <div className="absolute top-0 inset-x-0 h-1 bg-[hsl(var(--fi-purple))]" />}
                          <CardContent className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPremium ? 'bg-[hsl(var(--fi-purple))]' : 'bg-muted'}`}>
                                {isPremium ? <Sparkles className="w-4.5 h-4.5 text-white" strokeWidth={1.5} /> : <Shield className="w-4.5 h-4.5 text-muted-foreground" strokeWidth={1.5} />}
                              </div>
                              {isPremium && <Badge className="text-[10px] bg-[hsl(var(--fi-purple))]/10 text-[hsl(var(--fi-purple))] border-[hsl(var(--fi-purple))]/20">Popular</Badge>}
                            </div>
                            <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                            <div className="mt-2 flex items-baseline gap-1">
                              <span className="text-2xl font-extrabold text-foreground">{plan.price?.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground">{currency} / {plan.duration_days}d</span>
                            </div>
                            {plan.features_json && (
                              <ul className="mt-4 space-y-2">
                                {(Array.isArray(plan.features_json) ? plan.features_json : []).map((f: string, j: number) => (
                                  <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--fi-purple))] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <Button
                              className={`w-full mt-5 rounded-lg h-10 text-xs font-semibold gap-2 ${isPremium ? 'bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white' : ''}`}
                              disabled={subscribing} onClick={() => handleSubscribe(plan.id)} variant={isPremium ? 'default' : 'outline'}>
                              {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Get Started <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} /></>}
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                  {plans.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                        <Crown className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-medium text-foreground">No plans available</p>
                      <p className="text-xs text-muted-foreground mt-1">Subscription plans will appear here once configured by the platform admin.</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="grid sm:grid-cols-3 gap-4 mt-2">
              {[
                { icon: Users, title: 'Consumer Visibility', desc: 'Appear in the KOB marketplace for thousands of consumers', color: 'hsl(var(--fi-blue))' },
                { icon: Wallet, title: 'Wallet Payments', desc: 'Accept instant wallet payments with zero processing delay', color: 'hsl(var(--fi-green))' },
                { icon: BarChart3, title: 'Analytics', desc: 'Track orders, revenue, and customer engagement metrics', color: 'hsl(var(--fi-purple))' },
              ].map((f, i) => (
                <motion.div key={f.title} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${f.color}12` }}>
                        <f.icon className="w-4.5 h-4.5" style={{ color: f.color }} strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* ── QR Payments ── */}
        <TabsContent value="qr">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-5">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      Generate QR Code
                    </CardTitle>
                    <CardDescription className="text-xs">Create payment QR codes for your customers</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Payment Amount ({currency})</Label>
                      <Input type="number" value={qrAmount} onChange={e => setQrAmount(e.target.value)} placeholder="Leave empty for flexible amount" className="h-10 rounded-lg border-border/60" />
                      <p className="text-[10px] text-muted-foreground">Empty = customer enters their own amount at scan time</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Store</Label>
                      <Input value={storeName || 'Not configured'} disabled className="h-10 rounded-lg bg-muted/40" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-foreground mb-3">How QR Payments Work</p>
                    <div className="space-y-3">
                      {[
                        { step: '1', text: 'Display the QR code at your counter or on receipts', icon: Smartphone },
                        { step: '2', text: 'Customer opens KOB app and scans the code', icon: QrCode },
                        { step: '3', text: 'Customer confirms payment from their wallet', icon: Wallet },
                        { step: '4', text: 'Funds are instantly credited to your account', icon: CreditCard },
                      ].map((s) => (
                        <div key={s.step} className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[hsl(var(--fi-purple))]">
                            <span className="text-[10px] font-bold text-white">{s.step}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <s.icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                            <p className="text-xs text-muted-foreground">{s.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-5">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center">
                      {merchantId ? (
                        <>
                          <div className="p-6 rounded-2xl bg-white border border-border/30 shadow-sm">
                            <QRCodeSVG value={qrPayload} size={200} level="M" fgColor="hsl(267, 84%, 42%)" bgColor="white" />
                          </div>
                          <div className="text-center mt-4 space-y-1">
                            <p className="text-sm font-semibold text-foreground">{storeName || 'Your Store'}</p>
                            <p className="text-xs text-muted-foreground">
                              {qrAmount ? `${Number(qrAmount).toLocaleString()} ${currency}` : 'Flexible amount'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-4 w-full">
                            <Button variant="outline" className="flex-1 gap-2 rounded-lg h-9 text-xs" onClick={copyQr}>
                              {qrCopied ? <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
                              {qrCopied ? 'Copied' : 'Copy Data'}
                            </Button>
                            <Button variant="outline" className="flex-1 gap-2 rounded-lg h-9 text-xs" onClick={() => window.print()}>
                              <Printer className="w-3.5 h-3.5" strokeWidth={1.5} /> Print
                            </Button>
                            <Button variant="outline" className="flex-1 gap-2 rounded-lg h-9 text-xs">
                              <Download className="w-3.5 h-3.5" strokeWidth={1.5} /> Save
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                            <QrCode className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
                          </div>
                          <p className="text-sm font-medium text-foreground">No Merchant Account</p>
                          <p className="text-xs text-muted-foreground mt-1">Set up your merchant profile first</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="relative">
                    <img src={posPaymentSuccess} alt="POS Payment" className="w-full h-44 object-cover" />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-white text-sm font-bold">Seamless POS Payments</p>
                      <p className="text-white/70 text-[11px] mt-0.5">Accept mobile, card, and QR payments at your store</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ── Store Preview ── */}
        <TabsContent value="preview">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-5">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      Consumer App Preview
                    </CardTitle>
                    <CardDescription className="text-xs">This is how your store appears to customers on the KOB marketplace</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StorePreview
                      storeName={storeName}
                      description={description}
                      category={category}
                      city={city}
                      country={country}
                      currency={currency}
                      logoUrl={logoUrl}
                      bannerUrl={bannerUrl}
                      isPublished={isPublished}
                      rating={profile?.rating}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <HelpCircle className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      <p className="text-sm font-semibold text-foreground">Preview Tips</p>
                    </div>
                    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                      <p>• The preview shows how your store card looks in the consumer app homepage slider.</p>
                      <p>• <strong>Banner image</strong> is the large cover photo at the top — use a high-quality wide image (1200×400px).</p>
                      <p>• <strong>Logo</strong> appears as a small icon overlaying the banner — use a square image (200×200px minimum).</p>
                      <p>• Fill in your <strong>category</strong> and <strong>location</strong> for better discoverability.</p>
                      <p>• A compelling <strong>description</strong> helps customers decide to visit your store.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <p className="text-xs font-semibold text-foreground">Store Checklist</p>
                    {[
                      { done: !!storeName, label: 'Store name set' },
                      { done: !!description, label: 'Description added' },
                      { done: !!category, label: 'Category selected' },
                      { done: !!city, label: 'Location configured' },
                      { done: !!logoUrl, label: 'Logo uploaded' },
                      { done: !!bannerUrl, label: 'Cover image uploaded' },
                      { done: !!subscription, label: 'Subscription active' },
                      { done: isPublished, label: 'Store published' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2.5">
                        <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${item.done ? 'text-emerald-500' : 'text-muted-foreground/30'}`} strokeWidth={1.5} />
                        <span className={`text-xs ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Button onClick={() => setActiveTab('profile')} variant="outline" className="w-full gap-2 text-xs rounded-lg">
                  <Settings className="w-3.5 h-3.5" strokeWidth={1.5} /> Edit Store Profile
                </Button>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ── Shipping Management ── */}
        <TabsContent value="shipping">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      Confirm Shipping
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Notify customers that their order has been shipped. A shipping confirmation email will be sent automatically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ShippingForm storeName={storeName} currency={currency} merchantId={merchantId} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <HelpCircle className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      <p className="text-sm font-semibold text-foreground">Shipping Guide</p>
                    </div>
                    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                      <p>• Enter the order ID and the customer will receive an email and in-app notification.</p>
                      <p>• Add a tracking number and carrier so customers can follow their package.</p>
                      <p>• Provide an estimated delivery date to manage expectations.</p>
                      <p>• Shipping confirmations build trust and reduce "where is my order?" inquiries.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-foreground mb-3">Supported Carriers</p>
                    <div className="space-y-2">
                      {['DHL Express', 'EMS Cameroon', 'CamPost', 'FedEx', 'Aramex', 'Custom / Local'].map(c => (
                        <div key={c} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Truck className="w-3 h-3 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                          {c}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ── Demo Store ── */}
        <TabsContent value="demo">
          <DemoStoreTab merchantId={merchantId} onDataChanged={loadData} />
        </TabsContent>

        {/* ── Enterprise ── */}
        <TabsContent value="enterprise">
          <EnterpriseFeaturesTab
            isEnterprise={((subscription as any)?.pos_subscription_plans?.tier === 'enterprise') || ((subscription as any)?.pos_subscription_plans?.name || '').toLowerCase().includes('enterprise')}
            merchantId={merchantId}
            profile={profile}
            onUpgrade={() => setActiveTab('subscription')}
            onProfileUpdate={loadData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
