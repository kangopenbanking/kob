import React, { useState, useEffect, useMemo } from 'react';
import {
  Store, Eye, EyeOff, QrCode, Save, Loader2, CheckCircle2,
  Crown, AlertCircle, Globe, MapPin, Tag, Image, FileText,
  Download, Printer, Sparkles, Shield, Zap, Users, BarChart3,
  ArrowRight, CreditCard, Smartphone, Wallet, RefreshCw, Copy, Check,
  BookOpen, ChevronRight, Circle, Plus, X, Package, Settings, HelpCircle,
  ListChecks, Layers, DollarSign, Monitor, Truck, Hash, Clock, MapPinIcon,
  ExternalLink, ChevronDown, Search, LayoutGrid, Plug
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
import { motion, AnimatePresence } from 'framer-motion';
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
import { ProductsTab } from '@/components/storefront/ProductsTab';
import { WooConnectTab } from '@/components/storefront/WooConnectTab';
import { getCanonicalUrl } from '@/config/api';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } }),
};

const GUIDE_STEPS = [
  { id: 'profile', title: 'Set Up Your Store Profile', icon: Store, description: 'Enter your store name, description, category, and location.', tips: ['Choose a clear, memorable store name', 'Write a short description that highlights what makes you unique', 'Pick the correct category so customers can find you easily'], color: 'hsl(var(--fi-purple))' },
  { id: 'brand', title: 'Upload Brand Assets', icon: Image, description: 'Add your logo and a banner image to make your storefront stand out.', tips: ['Use a square logo (min 200×200px)', 'Banner should be wide (1200×400px recommended)', 'Use high-quality images with good lighting'], color: 'hsl(var(--fi-blue))' },
  { id: 'country', title: 'Select Country & Currency', icon: Globe, description: 'Choose your country and operating currency.', tips: ['Currency determines how prices display to customers', 'You can change this anytime before going live'], color: 'hsl(var(--fi-teal))' },
  { id: 'category', title: 'Choose Category', icon: Tag, description: 'Select a main category and optional sub-category.', tips: ['You can add a custom sub-category if none fits', 'Categories affect search ranking and discoverability'], color: 'hsl(var(--fi-amber))' },
  { id: 'attributes', title: 'Configure Attributes', icon: Package, description: 'Set up the product attributes for your POS system.', tips: ['Attributes help you track inventory accurately', 'Set low-stock alerts to avoid running out'], color: 'hsl(var(--fi-green))' },
  { id: 'subscribe', title: 'Subscribe to a Plan', icon: Crown, description: 'Choose a subscription plan to publish your store.', tips: ['You can upgrade or change plans anytime', 'Premium plans include analytics and priority placement'], color: 'hsl(var(--fi-purple))' },
  { id: 'publish', title: 'Publish & Go Live', icon: Eye, description: 'Toggle your store to Published and you\'re live!', tips: ['Make sure your profile is 100% complete before publishing', 'Share your QR code at your physical store counter'], color: 'hsl(var(--secondary))' },
];

const TAB_ITEMS = [
  { value: 'guide', label: 'Setup', icon: BookOpen, color: '--fi-purple' },
  { value: 'profile', label: 'Profile', icon: Store, color: '--fi-blue' },
  { value: 'products', label: 'Products', icon: Layers, color: '--fi-green' },
  { value: 'attributes', label: 'Attributes', icon: Package, color: '--fi-amber' },
  { value: 'subscription', label: 'Plans', icon: Crown, color: '--fi-purple' },
  { value: 'qr', label: 'QR Pay', icon: QrCode, color: '--fi-teal' },
  { value: 'preview', label: 'Preview', icon: Monitor, color: '--fi-blue' },
  { value: 'shipping', label: 'Shipping', icon: Truck, color: '--fi-amber' },
  { value: 'woo-connect', label: 'Integrations', icon: Plug, color: '--fi-green' },
  { value: 'demo', label: 'Demo', icon: Sparkles, color: '--fi-purple' },
  { value: 'enterprise', label: 'Enterprise', icon: Crown, color: '--fi-teal' },
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
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

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

  const [customAttributes, setCustomAttributes] = useState<{ key: string; label: string }[]>([]);
  const [newAttrLabel, setNewAttrLabel] = useState('');
  const [expandedStep, setExpandedStep] = useState<string | null>('profile');
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  const { data: supportedCountries = [] } = useSupportedCountries();

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
        setSubCategory((sp as any).sub_category || '');
        const savedAttrs = (sp as any).custom_attributes_json;
        if (Array.isArray(savedAttrs) && savedAttrs.length > 0) {
          setCustomAttributes(savedAttrs);
        }
      }
      // Fetch most recent subscription (active or expired) to show renewal prompts
      const { data: sub } = await supabase.from('pos_store_subscriptions').select('*, pos_subscription_plans(*)').eq('merchant_id', merchant.id).in('status', ['active', 'expired']).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setSubscription(sub);
      const { data: p } = await supabase.from('pos_subscription_plans').select('*').eq('is_active', true).order('price');
      setPlans(p || []);
      // Fetch wallet balance
      const { data: wallets } = await supabase.from('gateway_merchant_wallets').select('available_balance, currency').eq('merchant_id', merchant.id);
      const wb = wallets?.find((w: any) => w.currency === (sp?.country === 'CM' ? 'XAF' : 'XAF'));
      setWalletBalance(wb?.available_balance || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!merchantId) return;
    setSaving(true);
    try {
      const effectiveSubCategory = showCustomSub ? customSubCategory : subCategory;
      const payload: Record<string, any> = {
        merchant_id: merchantId, store_name: storeName, description, category,
        city, logo_url: logoUrl, banner_url: bannerUrl, is_published: isPublished,
        country, updated_at: new Date().toISOString(),
        sub_category: effectiveSubCategory || null,
        custom_attributes_json: customAttributes.length > 0 ? customAttributes : [],
      };
      if (profile) {
        await (supabase.from('pos_store_profiles') as any).update(payload).eq('id', profile.id);
      } else {
        const { data } = await (supabase.from('pos_store_profiles') as any).insert(payload).select().single();
        setProfile(data);
      }
      toast.success('Storefront saved successfully');
    } catch (err: any) { toast.error(extractEdgeFunctionError(err, 'Failed to save')); }
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
    } catch (err: any) { toast.error(extractEdgeFunctionError(err, 'Subscription failed')); }
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

  const qrPayloadUrl = merchantId
    ? `https://kangopenbanking.com/pay?d=${encodeURIComponent(btoa(qrPayload))}`
    : '';

  const copyQr = () => {
    navigator.clipboard.writeText(qrPayload);
    setQrCopied(true);
    toast.success('QR data copied');
    setTimeout(() => setQrCopied(false), 2000);
  };

  const downloadQr = () => {
    const svgEl = document.querySelector('#kob-qr-code svg') as SVGElement | null;
    if (!svgEl) { toast.error('QR code not found'); return; }
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    canvas.width = 440; canvas.height = 440;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new window.Image();
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 440, 440);
      ctx.drawImage(img, 0, 0, 440, 440);
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${storeName || 'kob'}-qr.png`; a.click();
        URL.revokeObjectURL(url);
        toast.success('QR code downloaded');
      }, 'image/png');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePublishToggle = (checked: boolean) => {
    if (!checked && isPublished) {
      setShowUnpublishConfirm(true);
    } else {
      setIsPublished(checked);
    }
  };

  const confirmUnpublish = () => {
    setIsPublished(false);
    setShowUnpublishConfirm(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const profileComplete = storeName && category && city && description;
  const completionPct = [storeName, category, city, description, logoUrl, bannerUrl].filter(Boolean).length / 6 * 100;
  const resolvedSubCategory = showCustomSub ? customSubCategory : subCategory;

  const STAT_CARDS = [
    { label: 'Store Status', value: isPublished ? 'Published' : 'Draft', icon: isPublished ? Eye : EyeOff, colorVar: '--fi-green', active: isPublished },
    { label: 'Subscription', value: subscription ? (subscription.pos_subscription_plans?.name || 'Active') : 'No Plan', icon: Crown, colorVar: '--fi-amber', active: !!subscription },
    { label: 'Category', value: category || 'Not set', icon: Tag, colorVar: '--fi-purple', active: !!category },
    { label: 'Location', value: city ? `${city}` : 'Not set', icon: MapPin, colorVar: '--fi-blue', active: !!city },
    { label: 'Completeness', value: `${Math.round(completionPct)}%`, icon: CheckCircle2, colorVar: completionPct === 100 ? '--fi-green' : '--fi-amber', active: completionPct === 100 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ═══ HERO HEADER ═══ */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl">
        {/* Background with pattern */}
        <div className="absolute inset-0 bg-[hsl(var(--fi-purple))]" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Store logo or default */}
              <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-7 h-7 text-white" strokeWidth={1.5} />
                )}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{storeName || 'Your Storefront'}</h1>
                <p className="text-white/60 text-sm mt-0.5 font-medium">Manage your marketplace presence and POS</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {subscription && (
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5">
                  <Crown className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
                  <span className="text-xs font-semibold text-white">{subscription.pos_subscription_plans?.name || 'Active'}</span>
                </div>
              )}
              {isPublished ? (
                <div className="flex items-center gap-1.5 bg-emerald-500/25 backdrop-blur-sm border border-emerald-400/30 rounded-full px-3 py-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-white">Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3 py-1.5">
                  <EyeOff className="w-3 h-3 text-white/60" />
                  <span className="text-xs font-medium text-white/70">Draft</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6 max-w-lg">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-white/50 font-medium uppercase tracking-wider">Profile completeness</span>
              <span className="text-xs text-white font-bold">{Math.round(completionPct)}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: completionPct === 100 ? 'hsl(var(--fi-green))' : 'hsl(var(--secondary))' }}
                initial={{ width: 0 }}
                animate={{ width: `${completionPct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ STAT CARDS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map((stat, i) => (
          <motion.div key={stat.label} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
            <Card className="border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group cursor-default">
              <CardContent className="p-4 relative">
                {/* Accent top stripe */}
                <div className="absolute top-0 left-0 right-0 h-[3px] transition-opacity" style={{ backgroundColor: `hsl(var(${stat.colorVar}))`, opacity: stat.active ? 1 : 0.2 }} />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: `hsl(var(${stat.colorVar}) / 0.1)` }}>
                    <stat.icon className="w-5 h-5" style={{ color: `hsl(var(${stat.colorVar}))` }} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                    <p className="text-sm font-bold text-foreground truncate mt-0.5">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ═══ TABS ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Modern scrollable tab navigation */}
        <div className="relative">
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="inline-flex w-auto min-w-full bg-card border border-border/50 p-1.5 rounded-2xl shadow-sm h-auto gap-1">
              {TAB_ITEMS.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={`
                      relative rounded-xl px-3.5 py-2.5 text-xs font-semibold gap-2 transition-all duration-200 whitespace-nowrap
                      data-[state=active]:shadow-md
                    `}
                    style={isActive ? { backgroundColor: `hsl(var(${tab.color}))`, color: 'white' } : {}}
                  >
                    <TabIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>

        {/* ══ SETUP GUIDE ══ */}
        <TabsContent value="guide">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Setup Guide</h2>
                    <p className="text-xs text-muted-foreground">Complete these steps to launch your store</p>
                  </div>
                </div>

                {GUIDE_STEPS.map((step, i) => {
                  const isExpanded = expandedStep === step.id;
                  const StepIcon = step.icon;
                  return (
                    <motion.div key={step.id} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                      <Card className={`border overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-md border-border' : 'shadow-sm border-border/40 hover:border-border/70'}`}>
                        <button
                          onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                          className="w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-muted/20"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${step.color}15` }}>
                            <span className="text-sm font-bold" style={{ color: step.color }}>{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground">{step.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{step.description}</p>
                          </div>
                          <StepIcon className="w-4 h-4 flex-shrink-0" style={{ color: step.color }} strokeWidth={1.5} />
                          <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} strokeWidth={1.5} />
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-0 border-t border-border/30">
                                <ul className="mt-3 space-y-2">
                                  {step.tips.map((tip, j) => (
                                    <li key={j} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: step.color }} strokeWidth={1.5} />
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                                <Button variant="outline" size="sm" className="mt-4 text-xs gap-1.5 rounded-xl h-9 font-semibold border-border/60 hover:border-border"
                                  onClick={() => {
                                    if (step.id === 'subscribe') setActiveTab('subscription');
                                    else if (['publish', 'profile', 'brand', 'country', 'category'].includes(step.id)) setActiveTab('profile');
                                    else if (step.id === 'attributes') setActiveTab('attributes');
                                  }}>
                                  Go to this step <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-amber))]/10 flex items-center justify-center">
                        <HelpCircle className="w-4 h-4 text-[hsl(var(--fi-amber))]" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-bold text-foreground">Quick Tips</p>
                    </div>
                    <div className="space-y-3">
                      {[
                        { text: 'Complete all profile fields for better visibility', icon: CheckCircle2, color: '--fi-green' },
                        { text: 'A subscription is required for the consumer app', icon: Crown, color: '--fi-amber' },
                        { text: 'Print your QR code for your checkout counter', icon: QrCode, color: '--fi-purple' },
                        { text: 'Set accurate POS attributes for inventory', icon: Package, color: '--fi-blue' },
                      ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <tip.icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: `hsl(var(${tip.color}))` }} strokeWidth={1.5} />
                          <p className="text-xs text-muted-foreground leading-relaxed">{tip.text}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                  <div className="relative">
                    <img src={posKob} alt="KOB POS Terminal" className="w-full h-44 object-cover" />
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-white text-sm font-bold">KOB POS Terminal</p>
                      <p className="text-white/60 text-[11px] mt-0.5">Accept payments in-store & online</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ══ STORE PROFILE ══ */}
        <TabsContent value="profile">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                {/* Basic Info */}
                <Card className="border border-border/40 shadow-sm overflow-hidden">
                  <div className="h-1 bg-[hsl(var(--fi-blue))]" />
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-blue))]/10 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-[hsl(var(--fi-blue))]" strokeWidth={1.5} />
                      </div>
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-foreground">Store Name</Label>
                        <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="e.g. Chez Marie" className="h-11 rounded-xl border-border/60 focus:border-[hsl(var(--fi-blue))] transition-colors" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-foreground">Category</Label>
                        <Select value={category} onValueChange={v => { setCategory(v); setSubCategory(''); setShowCustomSub(false); }}>
                          <SelectTrigger className="h-11 rounded-xl border-border/60"><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            {STORE_CATEGORIES.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {selectedCategoryObj && selectedCategoryObj.subs.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-foreground">Sub-Category</Label>
                        {!showCustomSub ? (
                          <div className="flex gap-2">
                            <Select value={subCategory} onValueChange={setSubCategory}>
                              <SelectTrigger className="h-11 rounded-xl border-border/60 flex-1"><SelectValue placeholder="Select sub-category (optional)" /></SelectTrigger>
                              <SelectContent>
                                {selectedCategoryObj.subs.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl flex-shrink-0 border-border/60" onClick={() => setShowCustomSub(true)}>
                              <Plus className="w-4 h-4" strokeWidth={1.5} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Input value={customSubCategory} onChange={e => setCustomSubCategory(e.target.value)} placeholder="Enter custom sub-category" className="h-11 rounded-xl border-border/60 flex-1" />
                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl flex-shrink-0 border-border/60" onClick={() => { setShowCustomSub(false); setCustomSubCategory(''); }}>
                              <X className="w-4 h-4" strokeWidth={1.5} />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-foreground">Description</Label>
                      <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell customers what makes your store special..." rows={3} className="rounded-xl border-border/60 resize-none focus:border-[hsl(var(--fi-blue))]" />
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-foreground">Country</Label>
                        <Select value={country} onValueChange={v => { setCountry(v); setCity(''); }}>
                          <SelectTrigger className="h-11 rounded-xl border-border/60"><SelectValue placeholder="Select country" /></SelectTrigger>
                          <SelectContent>
                            {supportedCountries.length > 0 ? supportedCountries.map(c => (
                              <SelectItem key={`${c.code}-${c.country}`} value={c.code}>{c.flag} {c.country}</SelectItem>
                            )) : <SelectItem value="CM">Cameroon</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-foreground">Currency</Label>
                        <div className="h-11 rounded-xl border border-border/60 bg-muted/30 px-3 flex items-center text-sm font-medium text-muted-foreground">
                          {currencyInfo.currency} ({currencyInfo.symbol})
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-foreground">City / Town</Label>
                        {cities.length > 0 ? (
                          <Select value={city} onValueChange={setCity}>
                            <SelectTrigger className="h-11 rounded-xl border-border/60"><SelectValue placeholder="Select city" /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(cityRegions).map(([region, regionCities]) => (
                                <React.Fragment key={region}>
                                  <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{region}</div>
                                  {regionCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </React.Fragment>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Enter city name" className="h-11 rounded-xl border-border/60" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Brand Assets */}
                <Card className="border border-border/40 shadow-sm overflow-hidden">
                  <div className="h-1 bg-[hsl(var(--fi-purple))]" />
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center">
                        <Image className="w-4 h-4 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      </div>
                      Brand Assets
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <ImageUpload label="Store Logo" value={logoUrl} onChange={setLogoUrl} folder="logos" placeholder="Upload logo or paste URL" previewClass="w-16 h-16 rounded-xl object-cover" />
                    <ImageUpload label="Cover / Banner Image" value={bannerUrl} onChange={setBannerUrl} folder="banners" placeholder="Upload banner or paste URL" previewClass="w-full h-24 rounded-xl object-cover" />
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                {/* Publish card */}
                <Card className="border border-border/40 shadow-sm overflow-hidden">
                  <div className={`h-1.5 ${isPublished ? 'bg-[hsl(var(--fi-green))]' : 'bg-muted-foreground/20'}`} />
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {isPublished ? <div className="w-3 h-3 rounded-full bg-[hsl(var(--fi-green))] animate-pulse" /> : <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />}
                        <span className="text-sm font-bold text-foreground">{isPublished ? 'Published' : 'Draft'}</span>
                      </div>
                      <Switch checked={isPublished} onCheckedChange={handlePublishToggle} />
                    </div>
                    {showUnpublishConfirm && (
                      <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
                        <p className="text-xs font-medium text-destructive">Are you sure? Your store will be hidden from the marketplace.</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" className="text-xs rounded-lg" onClick={() => { confirmUnpublish(); }}>Yes, Unpublish</Button>
                          <Button size="sm" variant="outline" className="text-xs rounded-lg" onClick={() => setShowUnpublishConfirm(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {isPublished ? 'Your store is visible on the marketplace.' : 'Toggle to publish your store and start receiving orders.'}
                    </p>
                    {isPublished && !subscription && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[hsl(var(--fi-amber))]/8 border border-[hsl(var(--fi-amber))]/20">
                        <AlertCircle className="w-4 h-4 text-[hsl(var(--fi-amber))] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">Subscribe to a plan to appear on the marketplace.</p>
                      </div>
                    )}
                    <Button onClick={handleSave} disabled={saving || !storeName}
                      className="w-full gap-2 rounded-xl h-11 text-xs font-bold bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white shadow-md">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" strokeWidth={1.5} />}
                      Save Changes
                    </Button>
                  </div>
                </Card>

                {/* Quick Actions */}
                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="p-4 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2 px-1">Quick Actions</p>
                    {[
                      { label: 'Setup Guide', action: () => setActiveTab('guide'), icon: BookOpen, color: '--fi-purple' },
                      { label: 'Store Preview', action: () => setActiveTab('preview'), icon: Monitor, color: '--fi-blue' },
                      { label: 'QR Payments', action: () => setActiveTab('qr'), icon: QrCode, color: '--fi-teal' },
                      { label: 'Subscription', action: () => setActiveTab('subscription'), icon: Crown, color: '--fi-amber' },
                      { label: 'Products', action: () => setActiveTab('products'), icon: Layers, color: '--fi-green' },
                    ].map((item) => (
                      <button key={item.label} onClick={item.action}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl text-xs text-foreground hover:bg-muted/50 transition-all group text-left">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `hsl(var(${item.color}) / 0.1)` }}>
                          <item.icon className="w-3.5 h-3.5" style={{ color: `hsl(var(${item.color}))` }} strokeWidth={1.5} />
                        </div>
                        <span className="font-medium">{item.label}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* POS image */}
                <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                  <div className="relative">
                    <img src={posKob} alt="KOB POS" className="w-full h-36 object-cover" />
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="absolute bottom-3 left-3">
                      <p className="text-white text-xs font-bold">KOB POS</p>
                      <p className="text-white/60 text-[10px]">Accept payments in-store</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ══ POS ATTRIBUTES ══ */}
        <TabsContent value="attributes">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <Card className="border border-border/40 shadow-sm overflow-hidden">
                  <div className="h-1 bg-[hsl(var(--fi-amber))]" />
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-amber))]/10 flex items-center justify-center">
                        <ListChecks className="w-4 h-4 text-[hsl(var(--fi-amber))]" strokeWidth={1.5} />
                      </div>
                      Standard Product Attributes
                    </CardTitle>
                    <CardDescription className="text-xs">Built-in attributes for every product in your POS.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {POS_PRODUCT_ATTRIBUTES.map((attr) => (
                        <div key={attr.key} className="flex items-center gap-3 p-3.5 rounded-xl border border-border/40 hover:border-border/70 transition-colors bg-card">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--fi-amber) / 0.08)' }}>
                            {attr.type === 'number' ? <DollarSign className="w-4 h-4 text-[hsl(var(--fi-amber))]" strokeWidth={1.5} /> :
                             attr.type === 'select' ? <Layers className="w-4 h-4 text-[hsl(var(--fi-amber))]" strokeWidth={1.5} /> :
                             <Tag className="w-4 h-4 text-[hsl(var(--fi-amber))]" strokeWidth={1.5} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground">{attr.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {attr.type === 'select' ? `Options: ${attr.options?.join(', ')}` : `Type: ${attr.type}${attr.placeholder ? ` • e.g. ${attr.placeholder}` : ''}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/40 shadow-sm overflow-hidden">
                  <div className="h-1 bg-[hsl(var(--fi-green))]" />
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-green))]/10 flex items-center justify-center">
                        <Settings className="w-4 h-4 text-[hsl(var(--fi-green))]" strokeWidth={1.5} />
                      </div>
                      Custom Attributes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input value={newAttrLabel} onChange={e => setNewAttrLabel(e.target.value)} placeholder="e.g. Origin Country, Fabric Type..."
                        className="h-11 rounded-xl border-border/60 flex-1" onKeyDown={e => e.key === 'Enter' && addCustomAttribute()} />
                      <Button onClick={addCustomAttribute} disabled={!newAttrLabel.trim()}
                        className="h-11 gap-1.5 rounded-xl text-xs font-bold bg-[hsl(var(--fi-green))] hover:bg-[hsl(var(--fi-green))]/90 text-white px-5">
                        <Plus className="w-4 h-4" strokeWidth={1.5} /> Add
                      </Button>
                    </div>
                    {customAttributes.length > 0 ? (
                      <div className="space-y-2">
                        {customAttributes.map(attr => (
                          <div key={attr.key} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-green))]/10 flex items-center justify-center">
                                <Tag className="w-3.5 h-3.5 text-[hsl(var(--fi-green))]" strokeWidth={1.5} />
                              </div>
                              <span className="text-xs font-semibold text-foreground">{attr.label}</span>
                              <Badge variant="outline" className="text-[10px] font-bold">Custom</Badge>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg" onClick={() => removeCustomAttribute(attr.key)}>
                              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" strokeWidth={1.5} />
                        No custom attributes yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-blue))]/10 flex items-center justify-center">
                        <HelpCircle className="w-4 h-4 text-[hsl(var(--fi-blue))]" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-bold text-foreground">About Attributes</p>
                    </div>
                    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                      <p>Attributes define the data fields for each product in your POS system.</p>
                      <p><strong>Standard</strong> attributes (SKU, price, stock) are always available.</p>
                      <p><strong>Custom</strong> attributes let you track additional info specific to your business.</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-xs font-bold text-foreground mb-3">Summary</p>
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Standard</span>
                        <Badge variant="secondary" className="text-[10px] h-5 font-bold">{POS_PRODUCT_ATTRIBUTES.length}</Badge>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Custom</span>
                        <Badge variant="secondary" className="text-[10px] h-5 font-bold">{customAttributes.length}</Badge>
                      </div>
                      <div className="border-t border-border/40 pt-2 flex justify-between text-xs">
                        <span className="text-muted-foreground font-bold">Total</span>
                        <Badge className="text-[10px] h-5 font-bold bg-[hsl(var(--fi-purple))] text-white">{POS_PRODUCT_ATTRIBUTES.length + customAttributes.length}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ══ SUBSCRIPTION ══ */}
        <TabsContent value="subscription">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
            {subscription ? (
              <Card className="border border-border/40 shadow-md overflow-hidden">
                <div className="h-1.5 bg-[hsl(var(--fi-purple))]" />
                <div className="p-6 sm:p-8">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[hsl(var(--fi-purple))] shadow-lg">
                        <Crown className="w-7 h-7 text-white" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-foreground">{subscription.pos_subscription_plans?.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {subscription.pos_subscription_plans?.price?.toLocaleString()} {currency} / {subscription.pos_subscription_plans?.duration_days} days
                        </p>
                      </div>
                    </div>
                    {subscription.status === 'active' ? (
                      <Badge className="bg-[hsl(var(--fi-green))]/10 text-[hsl(var(--fi-green))] border-[hsl(var(--fi-green))]/20 px-4 py-2 text-xs font-bold">Active</Badge>
                    ) : (
                      <Badge variant="destructive" className="px-4 py-2 text-xs font-bold">Expired</Badge>
                    )}
                  </div>

                  {/* Expiry warning */}
                  {(() => {
                    const expiresAt = new Date(subscription.expires_at);
                    const now = new Date();
                    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysLeft <= 7 && daysLeft > 0) {
                      return (
                        <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-[hsl(var(--fi-amber))]/8 border border-[hsl(var(--fi-amber))]/25">
                          <AlertCircle className="w-5 h-5 text-[hsl(var(--fi-amber))] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-foreground">Subscription expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Renew now to keep your store visible on the marketplace.</p>
                          </div>
                          <Button
                            size="sm"
                            className="rounded-lg text-xs font-bold bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white gap-1.5"
                            onClick={() => { setSelectedPlan(subscription.pos_subscription_plans); setUpgradeModalOpen(true); }}
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Renew
                          </Button>
                        </div>
                      );
                    }
                    if (daysLeft <= 0) {
                      return (
                        <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-destructive/8 border border-destructive/25">
                          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-destructive">Subscription has expired</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Your store is no longer visible on the marketplace. Renew to restore visibility.</p>
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-lg text-xs font-bold gap-1.5"
                            onClick={() => { setSelectedPlan(subscription.pos_subscription_plans); setUpgradeModalOpen(true); }}
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Renew Now
                          </Button>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="grid sm:grid-cols-2 gap-4 mt-6">
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Started</p>
                      <p className="text-sm font-bold text-foreground mt-1">{new Date(subscription.starts_at).toLocaleDateString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Expires</p>
                      <p className="text-sm font-bold text-foreground mt-1">{new Date(subscription.expires_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Renewal button for active plans */}
                  <div className="mt-4 flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl h-10 text-xs font-semibold gap-2"
                      onClick={() => { setSelectedPlan(subscription.pos_subscription_plans); setUpgradeModalOpen(true); }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Renew / Change Plan
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <>
                <div className="text-center max-w-lg mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center mx-auto mb-4">
                    <Crown className="w-7 h-7 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">Choose Your Plan</h2>
                  <p className="text-sm text-muted-foreground mt-2">Get listed on the KOB marketplace and start receiving orders</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {plans.map((plan, i) => {
                    const isPremium = i === plans.length - 1;
                    return (
                      <motion.div key={plan.id} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                        <Card className={`border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-lg relative ${isPremium ? 'border-[hsl(var(--fi-purple))]/40 ring-1 ring-[hsl(var(--fi-purple))]/20' : 'border-border/40'}`}>
                          <div className={`h-1.5 ${isPremium ? 'bg-[hsl(var(--fi-purple))]' : 'bg-muted-foreground/15'}`} />
                          <CardContent className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPremium ? 'bg-[hsl(var(--fi-purple))]' : 'bg-muted'}`}>
                                {isPremium ? <Sparkles className="w-5 h-5 text-white" strokeWidth={1.5} /> : <Shield className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />}
                              </div>
                              {isPremium && <Badge className="text-[10px] bg-[hsl(var(--fi-purple))]/10 text-[hsl(var(--fi-purple))] border-[hsl(var(--fi-purple))]/20 font-bold">Popular</Badge>}
                            </div>
                            <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                            <div className="mt-2 flex items-baseline gap-1">
                              <span className="text-3xl font-extrabold text-foreground">{plan.price?.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground font-medium">{currency} / {plan.duration_days}d</span>
                            </div>
                            {plan.features_json && (
                              <ul className="mt-5 space-y-2.5">
                                {(Array.isArray(plan.features_json) ? plan.features_json : []).map((f: string, j: number) => (
                                  <li key={j} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                                    <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isPremium ? 'text-[hsl(var(--fi-purple))]' : 'text-[hsl(var(--fi-green))]'}`} strokeWidth={1.5} />
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <Button
                              className={`w-full mt-6 rounded-xl h-11 text-xs font-bold gap-2 shadow-sm ${isPremium ? 'bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white' : ''}`}
                              disabled={subscribing} onClick={() => { setSelectedPlan(plan); setUpgradeModalOpen(true); }} variant={isPremium ? 'default' : 'outline'}>
                              {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Get Started <ArrowRight className="w-3.5 h-3.5" /></>}
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                  {plans.length === 0 && (
                    <div className="col-span-full text-center py-16">
                      <Crown className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" strokeWidth={1.5} />
                      <p className="text-sm font-bold text-foreground">No plans available</p>
                      <p className="text-xs text-muted-foreground mt-1">Plans will appear here once configured.</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Feature highlights */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Users, title: 'Consumer Visibility', desc: 'Appear in the KOB marketplace for thousands of consumers', color: '--fi-blue' },
                { icon: Wallet, title: 'Wallet Payments', desc: 'Accept instant wallet payments with zero processing delay', color: '--fi-green' },
                { icon: BarChart3, title: 'Analytics', desc: 'Track orders, revenue, and customer engagement metrics', color: '--fi-purple' },
              ].map((f, i) => (
                <motion.div key={f.title} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                  <Card className="border border-border/40 shadow-sm hover:shadow-md transition-all">
                    <CardContent className="p-5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `hsl(var(${f.color}) / 0.1)` }}>
                        <f.icon className="w-5 h-5" style={{ color: `hsl(var(${f.color}))` }} strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-bold text-foreground">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* ══ QR PAYMENTS ══ */}
        <TabsContent value="qr">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-5">
                <Card className="border border-border/40 shadow-sm overflow-hidden">
                  <div className="h-1 bg-[hsl(var(--fi-teal))]" />
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-teal))]/10 flex items-center justify-center">
                        <QrCode className="w-4 h-4 text-[hsl(var(--fi-teal))]" strokeWidth={1.5} />
                      </div>
                      Generate QR Code
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-foreground">Payment Amount ({currency})</Label>
                      <Input type="number" value={qrAmount} onChange={e => setQrAmount(e.target.value)} placeholder="Leave empty for flexible amount" className="h-11 rounded-xl border-border/60" />
                      <p className="text-[10px] text-muted-foreground">Empty = customer enters their own amount</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-foreground">Store</Label>
                      <div className="h-11 rounded-xl border border-border/60 bg-muted/30 px-3 flex items-center text-sm text-muted-foreground">
                        {storeName || 'Not configured'}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-xs font-bold text-foreground mb-4">How QR Payments Work</p>
                    <div className="space-y-4">
                      {[
                        { step: '1', text: 'Display the QR code at your counter or on receipts', icon: Smartphone, color: '--fi-purple' },
                        { step: '2', text: 'Customer opens KOB app and scans the code', icon: QrCode, color: '--fi-blue' },
                        { step: '3', text: 'Customer confirms payment from their wallet', icon: Wallet, color: '--fi-teal' },
                        { step: '4', text: 'Funds are instantly credited to your account', icon: CreditCard, color: '--fi-green' },
                      ].map((s) => (
                        <div key={s.step} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `hsl(var(${s.color}))` }}>
                            <span className="text-[11px] font-extrabold text-white">{s.step}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-1.5">
                            <s.icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                            <p className="text-xs text-muted-foreground">{s.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-5">
                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-col items-center">
                      {merchantId ? (
                        <>
                          <div id="kob-qr-code" className="p-8 rounded-3xl bg-white border border-border/30 shadow-lg">
                            <QRCodeSVG value={qrPayloadUrl || qrPayload} size={220} level="M" fgColor="hsl(258, 80%, 58%)" bgColor="white" />
                          </div>
                          <div className="text-center mt-5 space-y-1">
                            <p className="text-base font-bold text-foreground">{storeName || 'Your Store'}</p>
                            <p className="text-sm text-muted-foreground">
                              {qrAmount ? `${Number(qrAmount).toLocaleString()} ${currency}` : 'Flexible amount'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-5 w-full">
                            <Button variant="outline" className="flex-1 gap-2 rounded-xl h-10 text-xs font-semibold" onClick={copyQr}>
                              {qrCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {qrCopied ? 'Copied' : 'Copy'}
                            </Button>
                            <Button variant="outline" className="flex-1 gap-2 rounded-xl h-10 text-xs font-semibold" onClick={() => window.print()}>
                              <Printer className="w-3.5 h-3.5" /> Print
                            </Button>
                            <Button variant="outline" className="flex-1 gap-2 rounded-xl h-10 text-xs font-semibold" onClick={downloadQr}>
                              <Download className="w-3.5 h-3.5" /> Save
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-12">
                          <QrCode className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" strokeWidth={1.5} />
                          <p className="text-sm font-bold text-foreground">No Merchant Account</p>
                          <p className="text-xs text-muted-foreground mt-1">Set up your merchant profile first</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                  <div className="relative">
                    <img src={posPaymentSuccess} alt="POS Payment" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-white text-sm font-bold">Seamless POS Payments</p>
                      <p className="text-white/60 text-[11px] mt-0.5">Accept mobile, card, and QR payments</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ══ STORE PREVIEW ══ */}
        <TabsContent value="preview">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-5">
                <Card className="border border-border/40 shadow-sm overflow-hidden">
                  <div className="h-1 bg-[hsl(var(--fi-blue))]" />
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-blue))]/10 flex items-center justify-center">
                        <Monitor className="w-4 h-4 text-[hsl(var(--fi-blue))]" strokeWidth={1.5} />
                      </div>
                      Consumer App Preview
                    </CardTitle>
                    <CardDescription className="text-xs">How your store appears on the marketplace</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StorePreview storeName={storeName} description={description} category={category} city={city} country={country} currency={currency} logoUrl={logoUrl} bannerUrl={bannerUrl} isPublished={isPublished} rating={profile?.rating} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                {/* Store Checklist */}
                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <p className="text-xs font-bold text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(var(--fi-green))]" /> Store Checklist
                    </p>
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
                      <div key={item.label} className="flex items-center gap-3 py-1">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${item.done ? 'bg-[hsl(var(--fi-green))] border-[hsl(var(--fi-green))]' : 'border-border'}`}>
                          {item.done && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                        </div>
                        <span className={`text-xs font-medium ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Button onClick={() => setActiveTab('profile')} variant="outline" className="w-full gap-2 text-xs rounded-xl h-10 font-semibold">
                  <Settings className="w-3.5 h-3.5" strokeWidth={1.5} /> Edit Store Profile
                </Button>

                {/* Public Store Link */}
                {isPublished && merchantId && (
                  <Card className="border border-[hsl(var(--fi-green))]/30 shadow-sm overflow-hidden">
                    <div className="h-1 bg-[hsl(var(--fi-green))]" />
                    <CardContent className="p-4">
                      <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-[hsl(var(--fi-green))]" /> Public Store Link
                      </p>
                      <div className="flex items-center gap-2">
                        <Input readOnly value={getCanonicalUrl(`/store/${merchantId}`)} className="h-9 text-[11px] font-mono bg-muted/30 rounded-xl border-border/40" />
                        <Button variant="outline" size="sm" className="h-9 text-xs shrink-0 gap-1 rounded-xl font-semibold"
                          onClick={() => { navigator.clipboard.writeText(getCanonicalUrl(`/store/${merchantId}`)); toast.success('Store URL copied!'); }}>
                          <Copy className="w-3 h-3" /> Copy
                        </Button>
                      </div>
                      <a href={`/store/${merchantId}`} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-[hsl(var(--fi-green))] hover:underline mt-2 inline-flex items-center gap-1 font-semibold">
                        Open store page <ExternalLink className="w-3 h-3" />
                      </a>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ══ SHIPPING ══ */}
        <TabsContent value="shipping">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <Card className="border border-border/40 shadow-sm overflow-hidden">
                  <div className="h-1 bg-[hsl(var(--fi-amber))]" />
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-amber))]/10 flex items-center justify-center">
                        <Truck className="w-4 h-4 text-[hsl(var(--fi-amber))]" strokeWidth={1.5} />
                      </div>
                      Confirm Shipping
                    </CardTitle>
                    <CardDescription className="text-xs">Notify customers that their order has been shipped.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ShippingForm storeName={storeName} currency={currency} merchantId={merchantId} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--fi-amber))]/10 flex items-center justify-center">
                        <HelpCircle className="w-4 h-4 text-[hsl(var(--fi-amber))]" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-bold text-foreground">Shipping Guide</p>
                    </div>
                    <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                      <p>Enter the order ID and the customer will receive an email and in-app notification.</p>
                      <p>Add tracking number and carrier so customers can follow their package.</p>
                      <p>Provide estimated delivery date to manage expectations.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-xs font-bold text-foreground mb-3">Supported Carriers</p>
                    <div className="space-y-2">
                      {['DHL Express', 'EMS Cameroon', 'CamPost', 'FedEx', 'Aramex', 'Custom / Local'].map(c => (
                        <div key={c} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                          <div className="w-6 h-6 rounded-lg bg-[hsl(var(--fi-amber))]/10 flex items-center justify-center">
                            <Truck className="w-3 h-3 text-[hsl(var(--fi-amber))]" strokeWidth={1.5} />
                          </div>
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

        {/* ══ PRODUCTS ══ */}
        <TabsContent value="products">
          <ProductsTab merchantId={merchantId} currency={currency} standardAttributes={POS_PRODUCT_ATTRIBUTES} customAttributes={customAttributes} />
        </TabsContent>

        {/* ══ INTEGRATIONS ══ */}
        <TabsContent value="woo-connect">
          <WooConnectTab merchantId={merchantId} />
        </TabsContent>

        {/* ══ DEMO STORE ══ */}
        <TabsContent value="demo">
          <DemoStoreTab merchantId={merchantId} onDataChanged={loadData} />
        </TabsContent>

        {/* ══ ENTERPRISE ══ */}
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

      <EnterpriseUpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        plan={selectedPlan}
        plans={plans}
        currency={currency}
        subscribing={subscribing}
        walletBalance={walletBalance}
        onFundWallet={() => {
          setUpgradeModalOpen(false);
          window.location.href = '/merchant/wallet';
        }}
        onConfirm={(planId?: string) => {
          const id = planId || selectedPlan?.id;
          if (id) {
            handleSubscribe(id);
            setUpgradeModalOpen(false);
          }
        }}
      />
    </div>
  );
}
