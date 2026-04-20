// Public landing for /pay/m/:slug — anyone can scan a printed merchant QR.
// Resolves slug → shows merchant + amount entry → routes to login if needed → opens Customer scan flow.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Store, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PayMerchantSlug: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<any>(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('merchant-qr', { body: { action: 'resolve', slug } });
        if (error) throw error;
        if (data?.error) { toast.error(data.error); return; }
        setResolved(data);
        if (data.amount) setAmount(String(data.amount));
      } catch (e: any) {
        toast.error('QR code not found or expired');
      } finally { setLoading(false); }
    })();
  }, [slug]);

  const handleContinue = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      sessionStorage.setItem('post_login_redirect', `/pay/m/${slug}`);
      navigate('/app/auth');
      return;
    }
    navigate('/app/scan', { state: { prefillQR: { ...resolved.decoded, amount: Number(amount) || resolved.amount } } });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!resolved) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <p className="text-base font-bold text-foreground">QR code not found</p>
      <p className="mt-2 text-sm text-muted-foreground">This payment code is invalid, inactive, or expired.</p>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background p-6 max-w-md mx-auto">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <Store className="h-10 w-10 text-primary" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pay</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{resolved.merchant_name}</p>
          {resolved.description && <p className="mt-1 text-sm text-muted-foreground">{resolved.description}</p>}
        </div>

        <div className="w-full rounded-2xl border border-border/40 bg-card p-5">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount (XAF)</label>
          <Input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={resolved.qr_type === 'dynamic' && resolved.amount}
            className="h-14 rounded-xl text-center text-2xl font-bold"
          />
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
          <span className="text-[11px] font-bold text-emerald-700">Verified merchant</span>
        </div>

        <Button className="w-full rounded-2xl h-12 text-sm font-bold" disabled={!amount || Number(amount) <= 0} onClick={handleContinue}>
          Continue to pay
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">You'll confirm with your PIN on the next screen</p>
      </div>
    </div>
  );
};

export default PayMerchantSlug;
