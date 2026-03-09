import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Settings, QrCode, Copy, Share2, Wallet, Store, ShoppingBag, BarChart3, Users, Star, Ticket, Package, Monitor, ScanLine, Bell, ChevronRight, LogOut, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useBusinessData } from '@/hooks/useBusinessData';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface MenuSection {
  title: string;
  items: { icon: React.ElementType; label: string; subtitle?: string; path?: string; action?: () => void; badge?: string }[];
}

const BusinessMore: React.FC = () => {
  const navigate = useNavigate();
  const { merchantId } = useParams<{ merchantId?: string }>();
  const { merchant } = useBusinessData(merchantId);
  const [showStoreQR, setShowStoreQR] = useState(false);
  const basePath = merchantId ? `/biz/${merchantId}` : '/biz';

  const storeQRData = JSON.stringify({
    type: 'kob_store',
    merchant_id: merchantId,
    merchant_name: merchant?.business_name || 'Store',
  });

  const storeUrl = `${window.location.origin}/app/stores/${merchantId}`;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate(merchantId ? `/biz/${merchantId}/auth` : '/biz/auth');
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
        { icon: Wallet, label: 'Wallet', subtitle: 'Balances, funding & payouts', path: `${basePath}/wallet` },
        { icon: UserCog, label: 'Staff', subtitle: 'Team members & roles', path: `${basePath}/staff` },
      ],
    },
    {
      title: 'Store',
      items: [
        { icon: Store, label: 'Storefront', subtitle: 'Customize your online store', path: `${basePath}/storefront` },
        { icon: Package, label: 'Products', subtitle: 'Manage catalog & pricing', path: `${basePath}/products` },
        { icon: ShoppingBag, label: 'Inventory', subtitle: 'Track stock levels', path: `${basePath}/inventory` },
        { icon: Ticket, label: 'Coupons', subtitle: 'Discounts & promotions', path: `${basePath}/coupons` },
      ],
    },
    {
      title: 'Sales',
      items: [
        { icon: Monitor, label: 'POS Till', subtitle: 'Point of sale terminal', path: `${basePath}/till` },
        { icon: ScanLine, label: 'Receive Payment', subtitle: 'QR code & payment links', path: `${basePath}/receive` },
        { icon: BarChart3, label: 'Analytics', subtitle: 'Revenue & performance stats', path: `${basePath}/analytics` },
        { icon: Users, label: 'Customers', subtitle: 'Customer directory', path: `${basePath}/customers` },
        { icon: Star, label: 'Reviews', subtitle: 'Customer feedback & ratings', path: `${basePath}/reviews` },
      ],
    },
    {
      title: 'Settings',
      items: [
        { icon: QrCode, label: 'Store QR Code', subtitle: 'Share with customers', action: () => setShowStoreQR(true) },
        { icon: Bell, label: 'Notifications', subtitle: 'Alerts & sound preferences', path: `${basePath}/notifications` },
      ],
    },
  ];

  return (
    <div className="p-4 space-y-6 pb-20">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">More</h1>
        <p className="text-sm text-muted-foreground">{merchant?.business_name || 'Business settings'}</p>
      </header>

      {sections.map(section => (
        <div key={section.title} className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">{section.title}</h2>
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0 divide-y divide-border">
              {section.items.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => item.path ? navigate(item.path) : item.action?.()}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                      <Icon className="h-4.5 w-4.5 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                    </div>
                    {item.badge && (
                      <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{item.badge}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ))}

      <Button onClick={handleLogout} variant="outline" className="w-full rounded-2xl">
        <LogOut className="h-4 w-4 mr-2" /> Logout
      </Button>

      {/* Store QR Dialog */}
      <Dialog open={showStoreQR} onOpenChange={setShowStoreQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Store QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-3xl border-2 border-border bg-white p-5">
              <QRCodeSVG value={storeQRData} size={200} />
            </div>
            <p className="text-sm font-bold text-foreground">{merchant?.business_name}</p>
            <p className="text-xs text-muted-foreground text-center">Customers scan this code to visit your storefront</p>
            <div className="grid w-full grid-cols-2 gap-3">
              <Button variant="outline" className="rounded-2xl gap-2" onClick={async () => {
                await navigator.clipboard.writeText(storeUrl);
                toast.success('Link copied!');
              }}>
                <Copy className="h-4 w-4" strokeWidth={1.5} /> Copy
              </Button>
              <Button className="rounded-2xl gap-2" onClick={handleShareStoreQR}>
                <Share2 className="h-4 w-4" strokeWidth={1.5} /> Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessMore;
