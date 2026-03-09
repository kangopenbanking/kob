import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Settings, QrCode, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useBusinessData } from '@/hooks/useBusinessData';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const BusinessMore: React.FC = () => {
  const navigate = useNavigate();
  const { merchantId } = useParams<{ merchantId?: string }>();
  const { merchant } = useBusinessData(merchantId);
  const [showStoreQR, setShowStoreQR] = useState(false);

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

  return (
    <div className="p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">More</h1>
        <p className="text-sm text-muted-foreground">Settings and account options</p>
      </header>

      <div className="space-y-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <button className="w-full flex items-center gap-3 text-left" onClick={() => setShowStoreQR(true)}>
              <QrCode className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              <div>
                <span className="text-sm font-medium">Store QR Code</span>
                <p className="text-xs text-muted-foreground">Customers scan to visit your store</p>
              </div>
            </button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <button className="w-full flex items-center gap-3 text-left">
              <Settings className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </CardContent>
        </Card>

        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full rounded-2xl"
        >
          Logout
        </Button>
      </div>

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
            <p className="text-xs text-muted-foreground text-center">
              Customers scan this code to visit your storefront
            </p>
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
