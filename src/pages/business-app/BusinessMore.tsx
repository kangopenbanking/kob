import React, { useState, useEffect } from 'react';
import { Settings, QrCode, Copy, Share2, Wallet, Store, ShoppingBag, BarChart3, Users, Star, Ticket, Package, Monitor, ScanLine, Bell, ChevronRight, LogOut, UserCog, Bus, Building2, ShieldCheck, Loader2, Printer, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useBusinessData } from '@/hooks/useBusinessData';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [signedQR, setSignedQR] = useState<any>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const basePath = '/biz';

  const storeUrl = getCanonicalUrl(`/app/stores/${merchantId}`);

  // Build a unified Store QR payload: customers can either visit the store OR pay any amount.
  // We embed the signed pay payload (slug + sig) alongside merchant_id so the Customer app
  // can offer the user a choice on scan.
  const storeQRData = JSON.stringify({
    type: 'kob_store',
    v: 2,
    merchant_id: merchantId,
    merchant_name: merchant?.business_name || 'Store',
    store_url: storeUrl,
    pay_enabled: !!signedQR,
    ...(signedQR ? {
      pay: {
        slug: signedQR.slug,
        url: signedQR.url,
        decoded: signedQR.decoded, // signed payload (HMAC verified server-side)
      },
    } : {}),
  });

  // Lazy-load the signed QR the first time the dialog opens.
  useEffect(() => {
    if (!showStoreQR || signedQR || !merchantId) return;
    setLoadingQR(true);
    supabase.functions.invoke('merchant-qr', {
      body: { action: 'issue', merchant_id: merchantId, qr_type: 'static' },
    }).then(({ data, error }) => {
      if (error || data?.error) {
        toast.error('Could not load secure pay code');
      } else {
        setSignedQR(data);
      }
    }).finally(() => setLoadingQR(false));
  }, [showStoreQR, merchantId, signedQR]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/biz/auth');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }
    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.functions.invoke('account-delete-request', {
        body: {
          source: 'business_app',
          merchant_id: merchantId,
          user_email: user?.email,
          reason: 'User-initiated deletion from Business app',
        },
      });
      if (error) throw error;
      toast.success('Deletion request submitted. Our team will be in touch within 48 hours.');
      setShowDeleteDialog(false);
      setDeleteConfirm('');
    } catch (e: any) {
      // Fallback: surface support contact if backend route is unavailable.
      toast.message('Request received', {
        description: 'Please email support@kangopenbanking.com to finalise account deletion.',
      });
      setShowDeleteDialog(false);
      setDeleteConfirm('');
    } finally {
      setDeleting(false);
    }
  };

  const handleShareStoreQR = async () => {
    const text = `Visit ${merchant?.business_name || 'our store'} on Kang or pay any amount: ${storeUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: merchant?.business_name || 'Store', text, url: storeUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(storeUrl);
      toast.success('Store link copied!');
    }
  };

  const handlePrintStoreQR = () => {
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    const svg = document.getElementById('store-qr-svg')?.outerHTML || '';
    const payUrl = signedQR?.url || storeUrl;
    win.document.write(`<!DOCTYPE html><html><head><title>${merchant?.business_name || 'Store'}</title>
      <style>body{font-family:system-ui;text-align:center;padding:40px;}
        h1{margin:0 0 8px;font-size:28px;font-weight:800;}
        .qr{display:inline-block;padding:20px;border:2px solid #111;border-radius:24px;background:#fff;}
        .url{margin-top:16px;font-family:monospace;font-size:13px;color:#444;}
        .help{margin-top:20px;font-size:14px;color:#666;max-width:480px;margin-left:auto;margin-right:auto;}
        .row{display:flex;gap:24px;justify-content:center;margin-top:16px;}
        .row div{font-size:12px;color:#666;}
        .row strong{display:block;font-size:13px;color:#111;margin-bottom:4px;}
      </style></head><body>
      <h1>${merchant?.business_name || 'Visit & Pay'}</h1>
      <p style="font-size:16px;color:#666;margin:0 0 24px;">Scan with the Kang App to visit our store or pay any amount</p>
      <div class="qr">${svg}</div>
      <div class="url">${payUrl}</div>
      <div class="row"><div><strong>Visit Store</strong>Browse products & order</div><div><strong>Pay Any Amount</strong>Quick checkout with PIN</div></div>
      <div class="help">Open Kang → Tap Scan → Point camera at this code → Choose Visit or Pay</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
      </body></html>`);
    win.document.close();
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
        { icon: QrCode, label: 'Store QR Code', subtitle: 'Visit store or accept any amount', action: () => setShowStoreQR(true), color: 'bg-stone-500/10 text-stone-600' },
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
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-3xl bg-white p-5 shadow-inner border border-border/30">
              {loadingQR ? (
                <div className="flex h-[200px] w-[200px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <QRCodeSVG id="store-qr-svg" value={storeQRData} size={200} level="M" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{merchant?.business_name}</p>
              <p className="text-[11px] text-muted-foreground mt-1">One scan — visit your store or pay any amount</p>
            </div>

            <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
              <span className="text-[10px] font-bold text-emerald-700">Signed & verified payment</span>
            </div>

            <div className="grid w-full grid-cols-3 gap-2">
              <Button variant="outline" className="rounded-xl h-10 text-[11px] font-semibold gap-1.5" onClick={async () => {
                await navigator.clipboard.writeText(storeUrl);
                toast.success('Link copied!');
              }}>
                <Copy className="h-3.5 w-3.5" strokeWidth={2} /> Copy
              </Button>
              <Button variant="outline" className="rounded-xl h-10 text-[11px] font-semibold gap-1.5" onClick={handlePrintStoreQR} disabled={loadingQR}>
                <Printer className="h-3.5 w-3.5" strokeWidth={2} /> Print
              </Button>
              <Button className="rounded-xl h-10 text-[11px] font-semibold gap-1.5" onClick={handleShareStoreQR}>
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
