import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, QrCode, Camera, Share2, CheckCircle2, RefreshCw, Keyboard, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useQRScanner } from '@/hooks/useQRScanner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

type Tab = 'scan' | 'receive';

const BankQRPay: React.FC = () => {
  const navigate = useNavigate();
  const { institutionId } = useParams();
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('scan');

  // Scan state
  const [scanResult, setScanResult] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [merchantQR, setMerchantQR] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Receive state
  const [receiveAmount, setReceiveAmount] = useState('');

  useEffect(() => {
    const fetchAccount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('accounts')
          .select('account_id')
          .eq('user_id', user.id)
          .eq('institution_id', institutionId!)
          .limit(1)
          .maybeSingle();
        if (data) setAccountId(data.account_id);
      }
      setLoading(false);
    };
    fetchAccount();
  }, [institutionId]);

  /* ─── QR Scan Detection ─── */
  const handleScanDetected = useCallback((data: any) => {
    if (data.type === 'kob_store' && data.merchant_id) {
      toast.success('Store found! Redirecting you to the store page...');
      navigate(`/app/stores/${data.merchant_id}`);
      return;
    }
    if (data.type === 'kob_pos_pay' && data.merchant_id) {
      setScanResult({ account: data.merchant_id, amount: data.amount });
      setPayAmount(data.amount ? String(data.amount) : '');
      setMerchantQR(data);
      toast.success(`Merchant "${data.merchant_name || 'Store'}" recognized — enter amount to pay`);
    } else if (data.type === 'kob_pay' && data.account) {
      setScanResult({ account: data.account, amount: data.amount });
      setPayAmount(data.amount ? String(data.amount) : '');
      setMerchantQR(null);
      toast.success('QR code scanned successfully — confirm your payment details');
    } else {
      toast.error('This QR code is not recognized. Please scan a valid Kang payment QR code.');
    }
  }, [navigate]);

  const handleRawScan = useCallback((rawValue: string) => {
    try {
      const parsed = JSON.parse(rawValue);
      handleScanDetected(parsed);
    } catch {
      handleScanDetected({ type: 'kob_pay', account: rawValue });
    }
  }, [handleScanDetected]);

  const scanEnabled = activeTab === 'scan' && !showManualEntry && !scanResult;

  const {
    videoRef,
    cameraActive,
    cameraError,
    needsHtml5Container,
    stopCamera,
    resetProcessed,
  } = useQRScanner({
    onScan: handleRawScan,
    enabled: scanEnabled,
    containerId: 'bank-qr-scanner',
  });

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    setScanResult({ account: manualCode.trim().toUpperCase() });
    setShowManualEntry(false);
    setManualCode('');
    toast.success('Payment code verified — ready to proceed');
  };

  const handlePayNow = async () => {
    if (!scanResult) return;
    const finalAmount = payAmount ? Number(payAmount) : undefined;

    if (merchantQR) {
      setProcessing(true);
      try {
        const { data, error } = await supabase.functions.invoke('pos-qr-payment', {
          body: {
            action: 'pay',
            merchant_id: merchantQR.merchant_id,
            amount: finalAmount,
            order_id: merchantQR.order_id,
            // v2: forward signed payload so the server can verify HMAC + canonical amount
            decoded: merchantQR.sig ? merchantQR : undefined,
          },
          headers: { 'Idempotency-Key': `qr_pay_${Date.now()}_${crypto.randomUUID().slice(0, 8)}` },
        });
        if (error) throw error;
        if (data?.error) { toast.error(data.message || 'Payment could not be processed. Please try again.'); return; }
        toast.success(`Payment of ${finalAmount?.toLocaleString()} XAF to ${merchantQR.merchant_name || 'merchant'} completed! ✅`);
        resetScan();
      } catch (err: any) {
        toast.error(extractEdgeFunctionError(err, 'Payment could not be completed. Please check your balance and try again.'));
      } finally {
        setProcessing(false);
      }
      return;
    }

    navigate(`/bank/${institutionId}/transfer`, {
      state: { prefill: { recipient: scanResult.account, amount: finalAmount } },
    });
  };

  const resetScan = () => {
    setScanResult(null);
    setManualCode('');
    setPayAmount('');
    setMerchantQR(null);
    resetProcessed();
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Pay Me',
      text: `Pay me via KOB Banking\nAccount: ${accountId}${receiveAmount ? `\nAmount: ${Number(receiveAmount).toLocaleString()} XAF` : ''}`,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(shareData.text);
      toast.success('Payment details copied — share with whoever needs to pay you');
    }
  };

  const qrData = JSON.stringify({
    type: 'kob_pay',
    account: accountId,
    institution: institutionId,
    ...(receiveAmount ? { amount: Number(receiveAmount) } : {}),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">QR Pay</h1>
      <p className="mb-4 text-sm text-muted-foreground">Scan to pay or share your code to receive</p>

      {/* Tab Switcher */}
      <div className="mb-5 flex rounded-2xl bg-muted p-1">
        {(['scan', 'receive'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); resetScan(); setShowManualEntry(false); }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
              activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {tab === 'scan' ? 'Scan & Pay' : 'Receive'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ─── SCAN TAB ─── */}
        {activeTab === 'scan' && (
          <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col">
            {scanResult ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5 p-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
                  <CheckCircle2 className="h-10 w-10 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  {merchantQR ? (
                    <>
                      <p className="text-lg font-bold text-foreground">{merchantQR.merchant_name || 'Merchant'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{merchantQR.description || 'Order Payment'}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-foreground">QR Code Scanned</p>
                      <p className="mt-1 font-mono text-sm text-muted-foreground">{scanResult.account}</p>
                    </>
                  )}
                </div>

                <div className="w-full">
                  {merchantQR && merchantQR.amount > 0 ? (
                    <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total to Pay</p>
                      <p className="text-3xl font-black tabular-nums text-foreground">
                        {Number(merchantQR.amount).toLocaleString('fr-CM')} <span className="text-lg font-bold text-muted-foreground">XAF</span>
                      </p>
                    </div>
                  ) : (
                    <>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount to Pay</label>
                      <Input type="number" placeholder="Enter amount in XAF" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="h-12 rounded-2xl text-center text-lg font-bold" />
                    </>
                  )}
                </div>

                <div className="flex w-full flex-col gap-3 pt-2">
                  <Button className="w-full rounded-2xl h-12 text-sm font-bold" disabled={!payAmount || processing} onClick={handlePayNow}>
                    {processing ? 'Processing...' : `Pay ${payAmount ? `${Number(payAmount).toLocaleString('fr-CM')} XAF` : 'Now'}`}
                  </Button>
                  <Button variant="outline" className="w-full rounded-2xl h-12 text-sm font-bold" onClick={resetScan}>
                    <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.5} /> Scan Again
                  </Button>
                </div>
              </motion.div>
            ) : showManualEntry ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">Enter Payment Code</p>
                  <button onClick={() => setShowManualEntry(false)}><X className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} /></button>
                </div>
                <Input placeholder="e.g. KOB-XXXX-XXXX" value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} className="h-14 rounded-2xl text-center text-lg font-mono font-bold tracking-wider" />
                <Button className="w-full rounded-2xl h-12" disabled={manualCode.length < 4} onClick={handleManualSubmit}>Verify Code</Button>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                {/* Scanner viewport — responsive width */}
                <div className="relative mx-auto flex aspect-square w-full max-w-[300px] items-center justify-center overflow-hidden rounded-3xl bg-[hsl(0,0%,8%)]">
                  {/* html5-qrcode container — always in DOM */}
                  <div
                    id="bank-qr-scanner"
                    className="absolute inset-0 z-[1] [&>div]:!w-full [&>div]:!h-full [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_video]:!max-w-none"
                    style={{
                      display: needsHtml5Container ? 'block' : 'none',
                      width: '100%',
                      height: '100%',
                    }}
                  />
                  {!needsHtml5Container && (
                    <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
                  )}

                  {/* Scanning frame overlay */}
                  <div className="absolute inset-0 z-10 pointer-events-none">
                    <div className="absolute left-4 top-4 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-primary" />
                    <div className="absolute right-4 top-4 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-primary" />
                    <div className="absolute bottom-4 left-4 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-primary" />
                    <div className="absolute bottom-4 right-4 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-primary" />
                  </div>

                  {cameraActive && (
                    <motion.div
                      className="absolute left-6 right-6 z-20 h-0.5 bg-primary shadow-[0_0_8px_hsl(var(--primary))] pointer-events-none"
                      initial={{ top: '15%' }}
                      animate={{ top: ['15%', '85%', '15%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                  {!cameraActive && !cameraError && (
                    <div className="z-20 flex flex-col items-center gap-3">
                      <Camera className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
                      <p className="text-xs text-muted-foreground">Starting camera…</p>
                    </div>
                  )}
                  {cameraError && (
                    <div className="z-20 flex flex-col items-center gap-3 px-6 text-center">
                      <Camera className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
                      <p className="text-xs text-muted-foreground">{cameraError}</p>
                    </div>
                  )}
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {cameraActive ? 'Point your camera at a QR code' : 'Allow camera access to scan'}
                </p>
                <Button variant="outline" className="w-full gap-2 rounded-2xl" onClick={() => setShowManualEntry(true)}>
                  <Keyboard className="h-4 w-4" strokeWidth={1.5} /> Enter Code Manually
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── RECEIVE TAB ─── */}
        {activeTab === 'receive' && (
          <motion.div key="receive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6">
            <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-sm">
              {loading ? (
                <div className="flex h-[200px] w-[200px] items-center justify-center">
                  <QrCode className="h-12 w-12 animate-pulse text-muted-foreground/40" strokeWidth={1} />
                </div>
              ) : accountId ? (
                <QRCodeSVG value={qrData} size={200} />
              ) : (
                <div className="flex h-[200px] w-[200px] items-center justify-center text-center">
                  <p className="text-xs text-muted-foreground">No account found</p>
                </div>
              )}
            </div>
            {accountId && <p className="text-center text-xs text-muted-foreground font-mono">{accountId}</p>}
            <div className="w-full">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Request Amount (optional)</label>
              <Input type="number" placeholder="Enter amount in XAF" value={receiveAmount} onChange={(e) => setReceiveAmount(e.target.value)} className="text-center text-lg font-bold" />
            </div>
            <Button className="w-full gap-2" onClick={handleShare} disabled={!accountId}>
              <Share2 className="h-4 w-4" strokeWidth={1.5} /> Share QR Code
            </Button>
            <p className="text-center text-xs text-muted-foreground">Share your QR code to receive instant payments</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BankQRPay;
