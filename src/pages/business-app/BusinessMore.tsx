import React, { useState } from 'react';
import { Settings, QrCode, Copy, Share2, Wallet, Store, ShoppingBag, BarChart3, Users, Star, Ticket, Package, Monitor, ScanLine, Bell, ChevronRight, LogOut, UserCog, Bus, Building2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useBusinessData } from '@/hooks/useBusinessData';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getCanonicalUrl } from '@/config/api';

interface MenuSection {
  title: string;
  items: { icon: React.ElementType; label: string; subtitle?: string; path?: string; action?: () => void; color: string }[];
}

const BusinessMore: React.FC = () => {
  const navigate = useNavigate();
  const { merchantId } = useMerchantContext();
  const { merchant } = useBusinessData(merchantId);
  const [showStoreQR, setShowStoreQR] = useState(false);
  const basePath = '/biz';

  const storeQRData = JSON.stringify({
    type: 'kob_store',
    merchant_id: merchantId,
    merchant_name: merchant?.business_name || 'Store',
  });
  const storeUrl = getCanonicalUrl(`/app/stores/${merchantId}`);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/biz/auth');
  };

  const handleShareStoreQR = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: merchant?.business_name || 'Store', text: 'Visit our store on Kang', url: storeUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(storeUrl);
      toast.success('Store link copied!');
    }
  };

  const sections: MenuSection[] = [
    {
      title: 'Account',
      items: [
        { icon: Wallet, label: 'Wallet', subtitle: 'Balances & payouts', path: `${basePath}/wallet`, color: 'bg-violet-500/10 text-violet-600' },
        { icon: UserCog, label: 'Staff', subtitle: 'Team & roles', path: `${basePath}/staff`, color: 'bg-sky-500/10 text-sky-600' },
      ],
    },
    {
      title: 'Store',
      items: [
        { icon: Store, label: 'Storefront', subtitle: 'Customize online store', path: `${basePath}/storefront`, color: 'bg-emerald-500/10 text-emerald-600' },
        { icon: Package, label: 'Products', subtitle: 'Catalog & pricing', path: `${basePath}/products`, color: 'bg-amber-500/10 text-amber-600' },
        { icon: ShoppingBag, label: 'Inventory', subtitle: 'Stock levels', path: `${basePath}/inventory`, color: 'bg-rose-500/10 text-rose-600' },
        { icon: Ticket, label: 'Coupons', subtitle: 'Discounts & promos', path: `${basePath}/coupons`, color: 'bg-indigo-500/10 text-indigo-600' },
      ],
    },
    {
      title: 'Sales',
      items: [
        { icon: Monitor, label: 'POS Till', subtitle: 'Point of sale', path: `${basePath}/till`, color: 'bg-cyan-500/10 text-cyan-600' },
        { icon: ScanLine, label: 'Receive Payment', subtitle: 'QR & payment links', path: `${basePath}/receive`, color: 'bg-teal-500/10 text-teal-600' },
        { icon: BarChart3, label: 'Analytics', subtitle: 'Revenue stats', path: `${basePath}/analytics`, color: 'bg-orange-500/10 text-orange-600' },
        { icon: Users, label: 'Customers', subtitle: 'Customer directory', path: `${basePath}/customers`, color: 'bg-pink-500/10 text-pink-600' },
        { icon: Star, label: 'Reviews', subtitle: 'Feedback & ratings', path: `${basePath}/reviews`, color: 'bg-yellow-500/10 text-yellow-600' },
        { icon: Bus, label: 'Travel', subtitle: 'Transport services', path: `${basePath}/travel`, color: 'bg-amber-500/10 text-amber-700' },
      ],
    },
    {
      title: 'Management',
      items: [
        { icon: ShieldCheck, label: 'Trust Score', subtitle: 'Credibility & risk profile', path: `${basePath}/trust-score`, color: 'bg-violet-500/10 text-violet-600' },
        { icon: Settings, label: 'Settings', subtitle: 'Business profile & config', path: `${basePath}/settings`, color: 'bg-slate-500/10 text-slate-600' },
        { icon: QrCode, label: 'Compliance', subtitle: 'KYB & verification', path: `${basePath}/compliance`, color: 'bg-emerald-500/10 text-emerald-700' },
        { icon: Star, label: 'Enterprise', subtitle: 'Advanced features', path: `${basePath}/enterprise`, color: 'bg-amber-500/10 text-amber-700' },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { icon: QrCode, label: 'Store QR Code', subtitle: 'Share with customers', action: () => setShowStoreQR(true), color: 'bg-stone-500/10 text-stone-600' },
        { icon: Bell, label: 'Notifications', subtitle: 'Alert preferences', path: `${basePath}/notifications`, color: 'bg-blue-500/10 text-blue-600' },
      ],
    },
    {
      title: 'Other Apps',
      items: [
        { icon: Building2, label: 'Banking App', subtitle: 'Access your bank accounts', path: '/bank', color: 'bg-violet-500/10 text-violet-600' },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      {/* Header */}
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">{merchant?.business_name || 'Business settings'}</p>
      </header>

      {/* Sections */}
      <div className="px-5 space-y-6">
        {sections.map(section => (
          <div key={section.title}>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2 px-1">{section.title}</h2>
            <div className="rounded-2xl border border-border/40 bg-card overflow-hidden divide-y divide-border/30">
              {section.items.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    className="w-full flex items-center gap-3.5 p-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
                    onClick={() => item.path ? navigate(item.path) : item.action?.()}
                  >
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', item.color)}>
                      <Icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">{item.label}</p>
                      {item.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{item.subtitle}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30" strokeWidth={2} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full rounded-2xl h-12 text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 font-semibold"
        >
          <LogOut className="h-4 w-4 mr-2" strokeWidth={2} /> Sign Out
        </Button>
      </div>

      {/* Store QR Dialog */}
      <Dialog open={showStoreQR} onOpenChange={setShowStoreQR}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">Store QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-3xl bg-white p-6 shadow-inner">
              <QRCodeSVG value={storeQRData} size={180} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{merchant?.business_name}</p>
              <p className="text-xs text-muted-foreground mt-1">Customers scan this to visit your store</p>
            </div>
            <div className="grid w-full grid-cols-2 gap-3">
              <Button variant="outline" className="rounded-full gap-2 h-10" onClick={async () => {
                await navigator.clipboard.writeText(storeUrl);
                toast.success('Link copied!');
              }}>
                <Copy className="h-3.5 w-3.5" strokeWidth={2} /> Copy
              </Button>
              <Button className="rounded-full gap-2 h-10 bg-foreground text-background hover:bg-foreground/90" onClick={handleShareStoreQR}>
                <Share2 className="h-3.5 w-3.5" strokeWidth={2} /> Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessMore;
