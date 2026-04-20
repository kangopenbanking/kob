import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, ChevronRight, Loader2, CheckCircle2, Receipt,
  GraduationCap, Zap, Droplets, Wifi, Tv, Phone, Shield, Landmark,
  MapPin, FileText, Share2, RotateCcw, Building2, Clock, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import {
  useBillCategories, useBillProviders, useBillLocations, useBillProducts,
  useCreateBillIntent, usePayBillIntent, useBillPayments,
} from '@/hooks/useBillsV2';
import { useCustomerAccounts, useAccountBalances } from '@/hooks/useCustomerData';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

// ─── Icon mapping ───
const iconMap: Record<string, React.ElementType> = {
  'graduation-cap': GraduationCap, zap: Zap, droplets: Droplets, wifi: Wifi,
  tv: Tv, phone: Phone, shield: Shield, landmark: Landmark,
  receipt: Receipt, 'building-2': Building2,
};
const getIcon = (name?: string) => iconMap[name || ''] || Receipt;

// Category card solid bg colors (no gradients)
const catCardColor: Record<string, string> = {
  'graduation-cap': 'bg-indigo-100 dark:bg-indigo-900/40',
  zap: 'bg-amber-100 dark:bg-amber-900/40',
  droplets: 'bg-sky-100 dark:bg-sky-900/40',
  wifi: 'bg-emerald-100 dark:bg-emerald-900/40',
  tv: 'bg-violet-100 dark:bg-violet-900/40',
  phone: 'bg-rose-100 dark:bg-rose-900/40',
  shield: 'bg-orange-100 dark:bg-orange-900/40',
  landmark: 'bg-teal-100 dark:bg-teal-900/40',
  receipt: 'bg-gray-100 dark:bg-gray-800/40',
  'building-2': 'bg-slate-100 dark:bg-slate-800/40',
};
const catIconBg: Record<string, string> = {
  'graduation-cap': 'bg-indigo-500',
  zap: 'bg-amber-500',
  droplets: 'bg-sky-500',
  wifi: 'bg-emerald-500',
  tv: 'bg-violet-500',
  phone: 'bg-rose-500',
  shield: 'bg-orange-500',
  landmark: 'bg-teal-500',
  receipt: 'bg-gray-500',
  'building-2': 'bg-slate-500',
};

type Step = 'home' | 'providers' | 'provider-detail' | 'form' | 'confirm' | 'receipt';

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 14, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } } };
const slideIn = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 } };
const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };

const CustomerBillsV2: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [step, setStep] = useState<Step>('home');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [payerDetails, setPayerDetails] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [intent, setIntent] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [showPin, setShowPin] = useState(false);

  const { data: categories = [], isLoading: catLoading } = useBillCategories();
  const { data: providers = [], isLoading: provLoading } = useBillProviders(categoryId || undefined);
  const { data: locations = [] } = useBillLocations(providerId || undefined);
  const { data: products = [], isLoading: prodLoading } = useBillProducts(providerId || undefined, locationId || undefined);
  const { data: recentPayments = [], isLoading: recentLoading } = useBillPayments(10);
  const { data: accounts = [] } = useCustomerAccounts(user?.id);
  const accountIds = accounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);
  const primaryAccount = accounts[0] as any;
  const primaryBalance = primaryAccount ? balances.find((b: any) => b.account_id === primaryAccount.id) : null;
  const walletBalance = (primaryBalance?.amount as number) ?? 0;

  const createIntent = useCreateBillIntent();
  const payIntent = usePayBillIntent();

  const filteredCategories = useMemo(() => {
    if (!search) return categories;
    return categories.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [categories, search]);

  const handleBack = () => {
    if (step === 'receipt') { reset(); return; }
    if (step === 'confirm') { setStep('form'); return; }
    if (step === 'form') { setStep('provider-detail'); return; }
    if (step === 'provider-detail') { setStep('providers'); return; }
    if (step === 'providers') { setStep('home'); setCategoryId(null); return; }
    navigate(-1);
  };

  const reset = () => {
    setStep('home'); setCategoryId(null); setProviderId(null);
    setLocationId(null); setProductId(null); setSelectedProduct(null);
    setSelectedProvider(null); setSelectedLocation(null);
    setPayerDetails({}); setAmount(''); setIntent(null); setPayment(null);
  };

  const selectCategory = (id: string) => { setCategoryId(id); setStep('providers'); };
  const selectProvider = (provider: any) => {
    setProviderId(provider.id);
    setSelectedProvider(provider);
    setStep('provider-detail');
  };
  const selectProduct = (product: any) => {
    setProductId(product.id);
    setSelectedProduct(product);
    setPayerDetails({});
    setAmount(product.amount_type === 'fixed' ? String(product.fixed_amount) : '');
    setStep('form');
  };

  const handleFieldChange = (key: string, value: string) => {
    setPayerDetails(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmitForm = async () => {
    try {
      const result = await createIntent.mutateAsync({
        provider_id: providerId!,
        location_id: locationId || undefined,
        product_id: productId!,
        amount: selectedProduct?.amount_type === 'variable' ? Number(amount) : undefined,
        payer_details: payerDetails,
      });
      setIntent(result);
      setStep('confirm');
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to create payment intent'));
    }
  };

  const handleConfirmPay = async () => {
    try {
      const result = await payIntent.mutateAsync(intent.id);
      setPayment(result);
      setStep('receipt');
      toast.success('Bill payment successful!');
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Payment failed'));
    }
  };

  const handleShare = async () => {
    if (navigator.share && payment) {
      try {
        await navigator.share({
          title: 'Bill Payment Receipt',
          text: `Bill Payment ${payment.receipt_number}\nAmount: ${Number(payment.total_amount).toLocaleString()} XAF\nDate: ${new Date(payment.paid_at).toLocaleString()}`,
        });
      } catch {}
    }
  };

  const fields = selectedProduct?.bill_product_fields || [];
  const stepTitle = step === 'home' ? 'Pay Bills' : step === 'providers' ? (categories.find((c: any) => c.id === categoryId)?.name || 'Providers') :
    step === 'provider-detail' ? (selectedProvider?.name || 'Provider') : step === 'form' ? (selectedProduct?.name || 'Payment') :
    step === 'confirm' ? 'Confirm Payment' : 'Receipt';

  return (
    <div className="flex flex-col gap-0 pb-28">
      {/* Header */}
      <div className="relative overflow-hidden bg-primary px-5 pb-7 pt-5">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleBack} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold text-primary-foreground">{stepTitle}</h1>
            <p className="text-xs text-primary-foreground/70">
              {step === 'home' ? 'Quick & secure bill payments' : step === 'providers' ? 'Select a provider' : step === 'form' ? 'Enter payment details' : step === 'confirm' ? 'Review your payment' : ''}
            </p>
          </div>
        </div>

        {/* Wallet Balance Pill */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="relative z-10 mt-4 flex items-center gap-2.5 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <CreditCard className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-primary-foreground/60">Available Balance</span>
            <span className="text-base font-bold text-primary-foreground">{walletBalance.toLocaleString()} <span className="text-xs font-normal text-primary-foreground/70">XAF</span></span>
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col gap-5 px-5 pt-5">
      <AnimatePresence mode="wait">
        {/* ─── HOME ─── */}
        {step === 'home' && (
          <motion.div key="home" {...fadeIn} className="flex flex-col gap-5">
            <motion.div variants={fadeUp} initial="initial" animate="animate" className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input placeholder="Search categories…" value={search} onChange={e => setSearch(e.target.value)}
                className="h-11 rounded-2xl border-border/50 bg-muted/40 pl-10 text-sm shadow-sm" />
            </motion.div>

            {catLoading ? <SkeletonList count={6} /> : (
              <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3">
                {filteredCategories.map((cat: any) => {
                  const Icon = getIcon(cat.icon);
                  const bgColor = catCardColor[cat.icon] || 'bg-muted';
                  const iconColor = catIconBg[cat.icon] || 'bg-primary';
                  return (
                    <motion.button key={cat.id} variants={fadeUp} whileTap={{ scale: 0.97 }}
                      onClick={() => selectCategory(cat.id)}
                      className={`flex items-center gap-3.5 rounded-2xl ${bgColor} p-4 shadow-sm transition-shadow active:shadow-md`}>
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconColor} text-white shadow-sm`}>
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-1 flex-col items-start">
                        <span className="text-sm font-bold text-foreground">{cat.name}</span>
                        {cat.description && <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{cat.description}</span>}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50" strokeWidth={1.5} />
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {/* Recent payments */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <h2 className="text-sm font-bold text-foreground">Recent Payments</h2>
              </div>
              {recentLoading ? <SkeletonList count={3} /> : recentPayments.length === 0 ? (
                <motion.div variants={fadeUp} initial="initial" animate="animate"
                  className="flex flex-col items-center gap-3 rounded-2xl bg-muted/30 py-10 ring-1 ring-border/30">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Receipt className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <p className="text-xs text-muted-foreground">No recent bill payments</p>
                </motion.div>
              ) : (
                <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-2.5">
                  {recentPayments.map((p: any) => {
                    const pIcon = p.bill_providers?.icon;
                    const bgColor = catCardColor[pIcon] || 'bg-muted';
                    const iconColor = catIconBg[pIcon] || 'bg-primary';
                    return (
                      <motion.div key={p.id} variants={fadeUp}
                        className={`flex items-center gap-3 rounded-2xl ${bgColor} p-3.5 shadow-sm`}>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconColor} text-white shadow-sm`}>
                          {React.createElement(getIcon(pIcon), { className: 'h-4 w-4', strokeWidth: 1.5 })}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-semibold text-foreground">{p.bill_providers?.name || 'Bill Payment'}</span>
                          <span className="text-[11px] text-muted-foreground">{p.bill_products?.name} · {new Date(p.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-bold text-foreground">{Number(p.total_amount).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">XAF</span></span>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                            <CheckCircle2 className="h-3 w-3" strokeWidth={2} /> Paid
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── PROVIDERS ─── */}
        {step === 'providers' && (
          <motion.div key="providers" {...slideIn} className="flex flex-col gap-3">
            {provLoading ? <SkeletonList count={5} /> : providers.length === 0 ? (
              <EmptyState message="No providers found in this category" />
            ) : providers.map((prov: any, i: number) => {
              const Icon = getIcon(prov.icon);
              const locCount = prov.bill_provider_locations?.[0]?.count || 0;
              return (
                <motion.button key={prov.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.98 }}
                  onClick={() => selectProvider(prov)}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 text-left transition-shadow hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{prov.name}</p>
                    {prov.description && <p className="text-[11px] text-muted-foreground truncate">{prov.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {locCount > 0 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <MapPin className="h-3 w-3" strokeWidth={1.5} />{locCount}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}

        {/* ─── PROVIDER DETAIL ─── */}
        {step === 'provider-detail' && selectedProvider && (
          <motion.div key="provider-detail" {...slideIn} className="flex flex-col gap-4">
            {/* Provider banner */}
            <div className="rounded-2xl border border-border/60 bg-primary/5 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
                  {React.createElement(getIcon(selectedProvider.icon), { className: 'h-6 w-6 text-primary', strokeWidth: 1.5 })}
                </div>
                <div>
                  <p className="text-base font-bold text-foreground">{selectedProvider.name}</p>
                  {selectedProvider.bill_categories && (
                    <p className="text-xs text-muted-foreground">{selectedProvider.bill_categories.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Location selector */}
            {locations.length > 1 && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} /> Select Location
                </label>
                <div className="flex flex-col gap-1.5">
                  {locations.map((loc: any) => (
                    <button key={loc.id} onClick={() => setLocationId(loc.id === locationId ? null : loc.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        locationId === loc.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60 bg-card'
                      }`}>
                      <MapPin className={`h-4 w-4 ${locationId === loc.id ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{loc.name}</p>
                        {loc.city && <p className="text-[11px] text-muted-foreground">{loc.city}{loc.region ? `, ${loc.region}` : ''}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Products */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" strokeWidth={1.5} /> Select Product
              </h3>
              {prodLoading ? <SkeletonList count={3} /> : products.length === 0 ? (
                <EmptyState message="No products available" />
              ) : products.map((prod: any, i: number) => (
                <motion.button key={prod.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.98 }}
                  onClick={() => selectProduct(prod)}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4 text-left transition-shadow hover:shadow-md">
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-foreground">{prod.name}</p>
                    {prod.description && <p className="text-[11px] text-muted-foreground">{prod.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {prod.amount_type === 'fixed' ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                        {Number(prod.fixed_amount).toLocaleString()} XAF
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Variable</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── PAYMENT FORM ─── */}
        {step === 'form' && selectedProduct && (
          <motion.div key="form" {...slideIn} className="flex flex-col gap-4">
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2">
              {['Details', 'Confirm', 'Done'].map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  <span className={`text-[10px] ${i === 0 ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{label}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
              {/* Dynamic fields */}
              {(fields as any[]).sort((a: any, b: any) => a.sort_order - b.sort_order).map((field: any) => (
                <div key={field.id} className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {field.label} {field.is_required && <span className="text-destructive">*</span>}
                  </label>
                  <Input
                    type={field.field_type === 'number' ? 'number' : field.field_type === 'phone' ? 'tel' : field.field_type === 'email' ? 'email' : 'text'}
                    value={payerDetails[field.field_key] || ''}
                    onChange={e => handleFieldChange(field.field_key, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="rounded-xl border-border h-11"
                  />
                </div>
              ))}

              {/* Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Amount (XAF)</label>
                {selectedProduct.amount_type === 'fixed' ? (
                  <div className="flex h-12 items-center justify-center rounded-xl bg-muted/50 text-lg font-bold text-foreground">
                    {Number(selectedProduct.fixed_amount).toLocaleString()} XAF
                  </div>
                ) : (
                  <Input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="Enter amount" className="rounded-xl border-border h-12 text-lg font-bold text-center" />
                )}
              </div>
            </div>

            <Button onClick={handleSubmitForm} disabled={createIntent.isPending}
              className="h-12 rounded-2xl text-sm font-semibold gap-2">
              {createIntent.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <>Review Payment <ChevronRight className="h-4 w-4" /></>}
            </Button>
          </motion.div>
        )}

        {/* ─── CONFIRM ─── */}
        {step === 'confirm' && intent && (
          <motion.div key="confirm" {...slideIn} className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-2">
              {['Details', 'Confirm', 'Done'].map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${i <= 1 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  <span className={`text-[10px] ${i <= 1 ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{label}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground mb-3">Payment Summary</h3>
              <SummaryRow label="Provider" value={selectedProvider?.name || ''} />
              {selectedLocation && <SummaryRow label="Location" value={selectedLocation.name} />}
              <SummaryRow label="Product" value={selectedProduct?.name || ''} />
              {Object.entries(intent.payer_details || {}).map(([k, v]) => {
                const fieldDef = fields.find((f: any) => f.field_key === k);
                return <SummaryRow key={k} label={fieldDef?.label || k} value={String(v)} />;
              })}
              <div className="my-2 border-t border-border/40" />
              <SummaryRow label="Amount" value={`${Number(intent.amount).toLocaleString()} XAF`} bold />
              <SummaryRow label="Fee" value={`${Number(intent.fee_amount).toLocaleString()} XAF`} />
              <SummaryRow label="Total" value={`${Number(intent.total_amount).toLocaleString()} XAF`} bold />
            </div>

            <Button onClick={() => setShowPin(true)} disabled={payIntent.isPending}
              className="h-12 rounded-2xl text-sm font-semibold gap-2">
              {payIntent.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : 'Confirm & Pay'}
            </Button>
          </motion.div>
        )}

        {/* ─── RECEIPT ─── */}
        {step === 'receipt' && payment && (
          <motion.div key="receipt" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5 py-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" strokeWidth={1.5} />
            </motion.div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-foreground">Payment Successful!</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Your bill has been paid successfully</p>
            </div>

            <div className="w-full rounded-2xl border border-border/60 bg-card p-5 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <span className="text-xs text-muted-foreground">Receipt No.</span>
                <span className="font-mono text-xs font-bold text-foreground">{payment.receipt_number}</span>
              </div>
              <SummaryRow label="Trace ID" value={payment.trace_id} mono />
              <SummaryRow label="Provider" value={selectedProvider?.name || ''} />
              {selectedLocation && <SummaryRow label="Location" value={selectedLocation.name} />}
              <SummaryRow label="Product" value={selectedProduct?.name || ''} />
              {Object.entries(payment.payer_details || {}).map(([k, v]) => {
                const fieldDef = fields.find((f: any) => f.field_key === k);
                return <SummaryRow key={k} label={fieldDef?.label || k} value={String(v)} />;
              })}
              <div className="my-1 border-t border-border/40" />
              <SummaryRow label="Amount" value={`${Number(payment.amount).toLocaleString()} XAF`} />
              <SummaryRow label="Fee" value={`${Number(payment.fee_amount).toLocaleString()} XAF`} />
              <SummaryRow label="Total Paid" value={`${Number(payment.total_amount).toLocaleString()} XAF`} bold />
              <SummaryRow label="Date" value={new Date(payment.paid_at).toLocaleString()} />
              <SummaryRow label="Status" value="Completed" status="success" />
            </div>

            <div className="flex w-full gap-2">
              {navigator.share && (
                <Button variant="outline" className="flex-1 h-11 rounded-2xl gap-1.5 text-xs" onClick={handleShare}>
                  <Share2 className="h-4 w-4" strokeWidth={1.5} /> Share
                </Button>
              )}
              <Button variant="outline" className="flex-1 h-11 rounded-2xl gap-1.5 text-xs" onClick={reset}>
                <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> Pay Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handleConfirmPay} />
    </div>
  );
};

// ─── Helper Components ───
const SummaryRow = ({ label, value, bold, mono, status }: { label: string; value: string; bold?: boolean; mono?: boolean; status?: 'success' }) => (
  <div className="flex justify-between items-center">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-xs ${bold ? 'font-bold' : 'font-medium'} ${mono ? 'font-mono' : ''} ${status === 'success' ? 'text-primary' : 'text-foreground'}`}>
      {value}
    </span>
  </div>
);

const SkeletonGrid = () => (
  <div className="grid grid-cols-4 gap-2.5">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/30 bg-muted/30 p-3 animate-pulse">
        <div className="h-11 w-11 rounded-xl bg-muted" />
        <div className="h-3 w-10 rounded bg-muted" />
      </div>
    ))}
  </div>
);

const SkeletonList = ({ count = 3 }: { count?: number }) => (
  <div className="flex flex-col gap-2.5">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/30 bg-muted/30 p-4 animate-pulse">
        <div className="h-11 w-11 rounded-xl bg-muted" />
        <div className="flex-1 space-y-1.5"><div className="h-3.5 w-2/3 rounded bg-muted" /><div className="h-3 w-1/3 rounded bg-muted" /></div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center gap-3 py-10">
    <Receipt className="h-10 w-10 text-muted-foreground/40" strokeWidth={1} />
    <p className="text-xs text-muted-foreground">{message}</p>
  </div>
);

export default CustomerBillsV2;
