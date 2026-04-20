import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Share2, Link2, CheckCircle2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useCustomerProfile } from '@/hooks/useCustomerData';
import { API_CONFIG } from '@/config/api';
import { QRCodeSVG } from 'qrcode.react';

const CustomerRequest: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { data: accounts } = useCustomerAccounts(user?.id);
  const { data: profile } = useCustomerProfile(user?.id);

  const [amount, setAmount] = useState('');
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use the user's permanent KANG ID as the receiving identifier
  const kangId = user?.kangId || '';
  const displayName = profile?.full_name || profile?.phone_number || 'User';

  // Build payment request data using KANG ID
  const paymentData = useMemo(() => JSON.stringify({
    type: 'kob_pay',
    kang_id: kangId,
    ...(amount ? { amount: Number(amount) } : {}),
    name: displayName,
  }), [kangId, amount, displayName]);

  // Build a shareable payment link
  const payLink = useMemo(() => {
    const base = API_CONFIG.SITE_URL;
    const params = new URLSearchParams({
      to: kangId,
      ...(amount ? { amt: amount } : {}),
    });
    return `${base}/app/transfer?${params.toString()}`;
  }, [kangId, amount]);

  const handleGenerate = () => {
    if (!amount) return;
    setGenerated(true);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(payLink);
      setCopied(true);
      toast.success('Payment link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    const shareText = `Pay me ${Number(amount).toLocaleString()} XAF via KOB\nKANG ID: ${kangId}\n\n${payLink}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payment Request – ${Number(amount).toLocaleString()} XAF`,
          text: shareText,
          url: payLink,
        });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success('Payment details copied to clipboard!');
    }
  };

  const handlePayLink = () => {
    // Open the pay link in a new tab (simulates hosted checkout)
    window.open(payLink, '_blank', 'noopener');
  };

  const handleReset = () => {
    setGenerated(false);
    setAmount('');
    setCopied(false);
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => generated ? handleReset() : navigate(-1)}>
          <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold text-foreground">Request Money</h1>
      </div>

      <AnimatePresence mode="wait">
        {!generated ? (
          <motion.div key="input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-5">
            {/* Amount Input */}
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-[hsl(150,35%,30%)] p-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(0,0%,100%)]/60">Request Amount</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-[hsl(0,0%,100%)]/60">XAF</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="bg-transparent text-4xl font-bold text-[hsl(0,0%,100%)] outline-none w-full text-center placeholder:text-[hsl(0,0%,100%)]/30"
                />
              </div>
            </div>

            {/* Account Info */}
            {kangId && (
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Your KANG ID</p>
                  <p className="font-mono text-sm font-bold text-foreground mt-0.5">{kangId}</p>
                </div>
              </div>
            )}

            <Button
              className="w-full rounded-2xl h-12 text-sm font-bold"
              disabled={!amount}
              onClick={handleGenerate}
            >
              Generate Payment Request
            </Button>
          </motion.div>
        ) : (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center gap-5">
            {/* QR Code */}
            <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-sm">
              <QRCodeSVG value={paymentData} size={220} />
            </div>

            {/* Request Details */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-[hsl(150,40%,35%)]" strokeWidth={2} />
                <p className="text-xs font-semibold text-[hsl(150,40%,35%)]">Payment Request Created</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{Number(amount).toLocaleString()} XAF</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{kangId}</p>
            </div>

            {/* Share Options */}
            <div className="grid grid-cols-3 gap-3 w-full">
              <button
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(210,80%,93%)] p-4 active:scale-95 transition-transform"
              >
                {copied ? (
                  <CheckCircle2 className="h-5 w-5 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                ) : (
                  <Copy className="h-5 w-5 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
                )}
                <span className="text-[10px] font-bold text-foreground">{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={handleShare}
                className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(150,40%,90%)] p-4 active:scale-95 transition-transform"
              >
                <Share2 className="h-5 w-5 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                <span className="text-[10px] font-bold text-foreground">Share</span>
              </button>

              <button
                onClick={handlePayLink}
                className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(45,70%,90%)] p-4 active:scale-95 transition-transform"
              >
                <ExternalLink className="h-5 w-5 text-[hsl(45,60%,35%)]" strokeWidth={1.5} />
                <span className="text-[10px] font-bold text-foreground">Pay Link</span>
              </button>
            </div>

            {/* Pay link preview */}
            <div className="w-full rounded-2xl border border-border bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Payment Link</p>
              <p className="font-mono text-[11px] text-foreground/70 break-all leading-relaxed">{payLink}</p>
            </div>

            <Button variant="outline" className="w-full rounded-2xl h-12 text-sm font-bold" onClick={handleReset}>
              New Request
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerRequest;
