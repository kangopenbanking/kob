import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Building2, Mail, Phone, Globe, CreditCard, Key, Webhook, Bell,
  ChevronRight, Shield, Save, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PaymentConnectorsPanel } from '@/components/connectors/PaymentConnectorsPanel';

const settingsLinks = [
  { icon: CreditCard, label: 'Settlement Accounts', subtitle: 'Bank, MoMo, Kang Wallet (max 2)', path: '/biz/settlement-accounts', color: 'text-emerald-600 bg-emerald-500/10' },
  { icon: Key, label: 'API Keys', subtitle: 'View & rotate credentials', path: '/biz/api-keys', color: 'text-violet-600 bg-violet-500/10' },
  { icon: Webhook, label: 'Webhooks', subtitle: 'Configure event endpoints', path: '/biz/webhooks', color: 'text-sky-600 bg-sky-500/10' },
  { icon: Bell, label: 'Notifications', subtitle: 'Alert preferences', path: '/biz/notifications', color: 'text-amber-600 bg-amber-500/10' },
  { icon: Shield, label: 'Compliance', subtitle: 'KYB & disputes', path: '/biz/compliance', color: 'text-rose-600 bg-rose-500/10' },
];

export default function BusinessSettings() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { merchantId } = useMerchantContext();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    business_name: '', business_email: '', business_phone: '',
    website_url: '', business_type: '', business_description: '',
    country: '', support_email: '', support_phone: '', logo_url: '',
  });

  const { data: merchant, isLoading } = useQuery({
    queryKey: ['biz-settings-merchant', merchantId],
    queryFn: async () => {
      if (!merchantId) return null;
      const { data, error } = await supabase.from('gateway_merchants').select('*').eq('id', merchantId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!merchantId,
  });

  useEffect(() => {
    if (!merchant) return;
    const meta = (merchant.metadata as any) || {};
    setForm({
      business_name: merchant.business_name || '',
      business_email: merchant.business_email || '',
      business_phone: merchant.business_phone || '',
      website_url: meta.website_url || '',
      business_type: meta.business_type || '',
      business_description: meta.business_description || '',
      country: meta.country || '',
      support_email: meta.support_email || '',
      support_phone: meta.support_phone || '',
      logo_url: meta.logo_url || '',
    });
  }, [merchant]);

  const handleSave = async () => {
    if (!merchantId || !form.business_name.trim()) {
      toast.error('Business name is required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('gateway_merchants').update({
        business_name: form.business_name,
        business_email: form.business_email || null,
        business_phone: form.business_phone || null,
        metadata: {
          ...(merchant?.metadata as any || {}),
          website_url: form.website_url,
          business_type: form.business_type,
          business_description: form.business_description,
          country: form.country,
          support_email: form.support_email,
          support_phone: form.support_phone,
          logo_url: form.logo_url,
        },
      }).eq('id', merchantId);
      if (error) throw error;
      toast.success('Settings saved');
    } catch (e: any) {
      toast.error(extractEdgeFunctionError(e, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value, onChange, type = 'text', placeholder = '' }: any) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <Input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} className="rounded-xl" />
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <header className="pt-4 md:pt-0 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Manage your business profile & configuration</p>
          </div>
          <Button size="sm" className="rounded-xl gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      <div className={cn(isMobile ? 'space-y-5' : 'grid grid-cols-3 gap-5')}>
        {/* Profile Form - 2 cols on desktop */}
        <div className={cn(!isMobile && 'col-span-2', 'space-y-5')}>
          {/* Business Info */}
          <div className="rounded-2xl border border-border/40 bg-card p-5">
            <h2 className="text-[15px] font-bold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" strokeWidth={1.8} />
              Business Information
            </h2>
            <div className="space-y-4">
              <div className={cn(isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-4')}>
                <Field label="Business Name" value={form.business_name} onChange={(v: string) => setForm(p => ({ ...p, business_name: v }))} placeholder="Your Business" />
                <Field label="Business Type" value={form.business_type} onChange={(v: string) => setForm(p => ({ ...p, business_type: v }))} placeholder="e.g. Retail, F&B" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                <Textarea value={form.business_description} onChange={e => setForm(p => ({ ...p, business_description: e.target.value }))} placeholder="Brief description..." rows={3} className="rounded-xl" />
              </div>
              <div className={cn(isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-4')}>
                <Field label="Country" value={form.country} onChange={(v: string) => setForm(p => ({ ...p, country: v }))} placeholder="e.g. CM" />
                <Field label="Website" value={form.website_url} onChange={(v: string) => setForm(p => ({ ...p, website_url: v }))} placeholder="https://..." />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="rounded-2xl border border-border/40 bg-card p-5">
            <h2 className="text-[15px] font-bold text-foreground mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" strokeWidth={1.8} />
              Contact Information
            </h2>
            <div className={cn(isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-4')}>
              <Field label="Business Email" value={form.business_email} onChange={(v: string) => setForm(p => ({ ...p, business_email: v }))} type="email" placeholder="business@example.com" />
              <Field label="Business Phone" value={form.business_phone} onChange={(v: string) => setForm(p => ({ ...p, business_phone: v }))} placeholder="+237 6XX..." />
              <Field label="Support Email" value={form.support_email} onChange={(v: string) => setForm(p => ({ ...p, support_email: v }))} type="email" placeholder="support@..." />
              <Field label="Support Phone" value={form.support_phone} onChange={(v: string) => setForm(p => ({ ...p, support_phone: v }))} placeholder="+237 6XX..." />
            </div>
          </div>

          {/* Branding */}
          <div className="rounded-2xl border border-border/40 bg-card p-5">
            <h2 className="text-[15px] font-bold text-foreground mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" strokeWidth={1.8} />
              Branding
            </h2>
            <Field label="Logo URL" value={form.logo_url} onChange={(v: string) => setForm(p => ({ ...p, logo_url: v }))} placeholder="https://..." />
            {form.logo_url && (
              <div className="mt-3 flex items-center gap-3">
                <img src={form.logo_url} alt="Logo" className="h-12 w-12 rounded-xl object-cover border border-border/40" onError={e => (e.currentTarget.style.display = 'none')} />
                <p className="text-xs text-muted-foreground">Preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links - 1 col on desktop */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2 px-1">Quick Access</h2>
          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden divide-y divide-border/30">
            {settingsLinks.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.path}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="w-full flex items-center gap-3.5 p-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
                  onClick={() => navigate(item.path)}
                >
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', item.color.split(' ')[1])}>
                    <Icon className={cn('h-[1.1rem] w-[1.1rem]', item.color.split(' ')[0])} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.subtitle}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" strokeWidth={2} />
                </motion.button>
              );
            })}
          </div>

          {/* Merchant Info */}
          {merchant && (
            <div className="rounded-2xl border border-border/40 bg-card p-4 mt-4">
              <h3 className="text-xs font-bold text-muted-foreground mb-3">Account Info</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={merchant.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                    {merchant.status || 'pending'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Environment</span>
                  <span className="font-medium">{merchant.environment || 'sandbox'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{merchant.plan_tier || 'standard'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{new Date(merchant.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {merchantId && (
        <div className="mt-6">
          <PaymentConnectorsPanel ownerType="merchant" ownerId={merchantId} />
        </div>
      )}
    </div>
  );
}
