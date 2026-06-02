import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Copy, Share2, Users, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

const CustomerReferral: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [referredCount, setReferredCount] = useState(0);
  const [pendingRewards, setPendingRewards] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        // Derive a stable, human-friendly code from the user id
        const derived = ('KOB' + user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6)).toUpperCase();
        setCode(derived);

        const { count } = await (supabase
          .from('profiles') as any)
          .select('id', { count: 'exact', head: true })
          .eq('referred_by', user.id);
        setReferredCount(count || 0);
        setPendingRewards((count || 0) * 1000);
      } catch {
        // graceful fallback — still show the code
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/app/auth?ref=${code}`
    : `https://kang.app/app/auth?ref=${code}`;

  const handleCopy = async (val: string, label: string) => {
    await navigator.clipboard.writeText(val);
    toast.success(`${label} ${tr('copied')}`);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Kang Open Banking',
          text: tr('Join me on Kang Open Banking and we both earn rewards!'),
          url: shareUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      handleCopy(shareUrl, tr('Link'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col p-5 pb-28">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold text-foreground">{tr('Refer & Earn')}</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-border bg-card p-6 text-center"
      >
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Gift className="h-7 w-7 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-bold text-foreground">
          {tr('Invite friends, earn rewards')}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {tr('You both get 1,000 XAF when your friend joins and completes a transaction.')}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" strokeWidth={1.5} />
            <p className="text-[11px] font-semibold uppercase tracking-widest">{tr('Friends Joined')}</p>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{referredCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
            <p className="text-[11px] font-semibold uppercase tracking-widest">{tr('Earned')}</p>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">
            {pendingRewards.toLocaleString()} <span className="text-xs text-muted-foreground">XAF</span>
          </p>
        </div>
      </div>

      {/* Code */}
      <div className="mt-5 space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {tr('Your Referral Code')}
        </label>
        <div className="flex gap-2">
          <Input value={code} readOnly className="rounded-xl font-mono text-lg font-bold tracking-widest text-center" />
          <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={() => handleCopy(code, tr('Code'))}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Share Link */}
      <div className="mt-4 space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {tr('Share Link')}
        </label>
        <div className="flex gap-2">
          <Input value={shareUrl} readOnly className="rounded-xl text-xs" />
          <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={() => handleCopy(shareUrl, tr('Link'))}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={handleShare} className="mt-2 w-full gap-2 rounded-xl">
          <Share2 className="h-4 w-4" /> {tr('Share with friends')}
        </Button>
      </div>

      {/* How it works */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground">{tr('How it works')}</h3>
        <ol className="mt-3 space-y-2 text-xs text-muted-foreground">
          <li>1. {tr('Share your code or link with a friend.')}</li>
          <li>2. {tr('They sign up and complete their first transaction.')}</li>
          <li>3. {tr('You both receive 1,000 XAF in your wallets.')}</li>
        </ol>
      </div>
    </div>
  );
};

export default CustomerReferral;
