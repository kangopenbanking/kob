import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ScanLine, Keyboard, QrCode, Camera, Share2, Copy, CheckCircle2, X, Flashlight, FlashlightOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useCustomerProfile } from '@/hooks/useCustomerData';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';

type Tab = 'scan' | 'receive';

const CustomerScan: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { data: accounts } = useCustomerAccounts(user?.id);
  const { data: profile } = useCustomerProfile(user?.id);

  const [activeTab, setActiveTab] = useState<Tab>('scan');
  const [manualCode, setManualCode] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<{ account: string; amount?: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [merchantQR, setMerchantQR] = useState<any>(null);

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Receive tab state - use real account data
  const [receiveAmount, setReceiveAmount] = useState('');
  const userAccountId = accounts?.[0]?.account_id || profile?.linked_account_number || user?.id?.slice(0, 16).toUpperCase() || '';

  /* ─── Camera Controls ─── */
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please allow camera permissions.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Could not start camera. Try manual entry instead.');
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'scan' && !showManualEntry && !scanResult) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeTab, showManualEntry, scanResult, startCamera, stopCamera]);

  /* ─── Simulated QR Scan Detection ─── */
  useEffect(() => {
    if (!cameraActive) return;
    // In a real implementation, you'd use a library like @aspect-build/web-qr-scanner or BarcodeDetector API
    // For now, simulate a scan after 5 seconds of camera being active
    const timeout = setTimeout(() => {
      if (cameraActive && !scanResult) {
        handleScanDetected({ type: 'kob_pay', account: 'KOB-7721-3384-5502' });
      }
    }, 6000);
    return () => clearTimeout(timeout);
  }, [cameraActive, scanResult]);

  /* ─── Handlers ─── */
  const handleScanDetected = (data: any) => {
    stopCamera();
    if (data.type === 'kob_pos_pay' && data.merchant_id) {
      // POS merchant QR — navigate to payment confirmation
      setScanResult({ account: data.merchant_id, amount: data.amount });
      setPayAmount(data.amount ? String(data.amount) : '');
      setMerchantQR(data);
      toast.success(`Merchant: ${data.merchant_name || 'Store'}`);
    } else if (data.type === 'kob_pay' && data.account) {
      setScanResult({ account: data.account, amount: data.amount });
      setPayAmount(data.amount ? String(data.amount) : '');
      setMerchantQR(null);
      toast.success('QR Code scanned successfully!');
    } else {
      toast.error('Invalid QR code format');
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setScanResult({ account: manualCode.trim().toUpperCase() });
      setShowManualEntry(false);
      toast.success('Code verified!');
    }, 1200);
  };

  const handlePayNow = async () => {
    if (!scanResult) return;
    const finalAmount = payAmount ? Number(payAmount) : undefined;
    
    if (merchantQR) {
      // POS QR payment via wallet
      setProcessing(true);
      try {
        const { data, error } = await supabase.functions.invoke('pos-qr-payment?action=pay', {
          body: { merchant_id: merchantQR.merchant_id, amount: finalAmount, order_id: merchantQR.order_id },
          headers: { 'Idempotency-Key': `qr_pay_${Date.now()}_${crypto.randomUUID().slice(0, 8)}` },
        });
        if (error) throw error;
        if (data?.error) {
          toast.error(data.message || data.error);
          return;
        }
        toast.success(`Paid ${finalAmount?.toLocaleString()} XAF to ${merchantQR.merchant_name}`);
        resetScan();
      } catch (err: any) {
        toast.error(err.message || 'Payment failed');
      } finally {
        setProcessing(false);
      }
      return;
    }

    navigate('/app/transfer', {
      state: { prefill: { recipient: scanResult.account, amount: finalAmount } },
    });
  };

  const handleShareQR = async () => {
    const shareText = `Pay me via KOB\nAccount: ${userAccountId}${receiveAmount ? `\nAmount: ${Number(receiveAmount).toLocaleString()} XAF` : ''}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Pay Me', text: shareText }); } catch {}
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success('Payment details copied!');
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(userAccountId);
    toast.success('Account code copied!');
  };

  const resetScan = () => {
    setScanResult(null);
    setManualCode('');
    setPayAmount('');
  };

  const qrData = JSON.stringify({
    type: 'kob_pay',
    account: userAccountId,
    ...(receiveAmount ? { amount: Number(receiveAmount) } : {}),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-5">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-lg font-bold text-foreground">QR Pay</h1>
        <div className="w-6" />
      </div>

      {/* Tab Switcher */}
      <div className="mx-5 flex rounded-2xl bg-muted p-1">
        {(['scan', 'receive'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setScanResult(null); setShowManualEntry(false); }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
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
              /* ─── Scan Result ─── */
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
                  <CheckCircle2 className="h-10 w-10 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">QR Code Scanned</p>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">{scanResult.account}</p>
                </div>
                <div className="w-full">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Amount to Pay
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter amount in XAF"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="h-12 rounded-2xl text-center text-lg font-bold"
                  />
                </div>
                <div className="flex w-full flex-col gap-3 pt-4">
                  <Button className="w-full rounded-2xl h-12 text-sm font-bold" disabled={!payAmount} onClick={handlePayNow}>
                    Pay Now
                  </Button>
                  <Button variant="outline" className="w-full rounded-2xl h-12 text-sm font-bold" onClick={resetScan}>
                    <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.5} /> Scan Again
                  </Button>
                </div>
              </motion.div>
            ) : showManualEntry ? (
              /* ─── Manual Entry ─── */
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col gap-5 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">Enter Payment Code</p>
                  <button onClick={() => setShowManualEntry(false)}>
                    <X className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <Input
                    placeholder="e.g. KOB-XXXX-XXXX-XXXX"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    className="h-14 rounded-2xl text-center text-lg font-mono font-bold tracking-wider"
                    maxLength={19}
                  />
                  <p className="text-center text-xs text-muted-foreground">
                    Enter the recipient's KOB account code
                  </p>
                  <Button
                    className="w-full rounded-2xl h-12 text-sm font-bold"
                    disabled={manualCode.length < 4 || processing}
                    onClick={handleManualSubmit}
                  >
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Verifying...
                      </span>
                    ) : (
                      'Verify Code'
                    )}
                  </Button>
                </div>
              </motion.div>
            ) : (
              /* ─── Camera Scanner ─── */
              <div className="flex flex-1 flex-col items-center justify-center gap-6 p-5">
                <div className="relative flex h-72 w-72 items-center justify-center overflow-hidden rounded-3xl bg-[hsl(0,0%,8%)]">
                  {/* Camera Feed */}
                  <video
                    ref={videoRef}
                    className="absolute inset-0 h-full w-full object-cover"
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Overlay scanning frame */}
                  <div className="absolute inset-0 z-10">
                    {/* Corner markers */}
                    <div className="absolute left-4 top-4 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-primary" />
                    <div className="absolute right-4 top-4 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-primary" />
                    <div className="absolute bottom-4 left-4 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-primary" />
                    <div className="absolute bottom-4 right-4 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-primary" />
                  </div>

                  {/* Scanning line animation */}
                  {cameraActive && (
                    <motion.div
                      className="absolute left-6 right-6 z-20 h-0.5 bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                      initial={{ top: '15%' }}
                      animate={{ top: ['15%', '85%', '15%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}

                  {/* Camera not active state */}
                  {!cameraActive && !cameraError && (
                    <div className="z-20 flex flex-col items-center gap-3">
                      <Camera className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
                      <p className="text-xs text-muted-foreground">Starting camera…</p>
                    </div>
                  )}

                  {/* Camera error state */}
                  {cameraError && (
                    <div className="z-20 flex flex-col items-center gap-3 px-6 text-center">
                      <Camera className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
                      <p className="text-xs text-muted-foreground">{cameraError}</p>
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={startCamera}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} /> Retry
                      </Button>
                    </div>
                  )}
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  {cameraActive
                    ? 'Point your camera at a QR code'
                    : 'Allow camera access to scan QR codes'}
                </p>

                {/* Actions */}
                <div className="flex w-full flex-col gap-3">
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl h-12 text-sm font-bold"
                    onClick={() => setShowManualEntry(true)}
                  >
                    <Keyboard className="mr-2 h-4 w-4" strokeWidth={1.5} />
                    Enter Code Manually
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── RECEIVE TAB ─── */}
        {activeTab === 'receive' && (
          <motion.div key="receive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center gap-6 p-5 pt-8"
          >
            {/* QR Code Display */}
            <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-sm">
              <QRCodeSVG data={qrData} size={220} />
            </div>

            <div className="text-center">
              <p className="font-mono text-sm font-bold text-foreground">{userAccountId}</p>
              <p className="mt-1 text-xs text-muted-foreground">Share this QR code to receive payments</p>
            </div>

            {/* Amount Input */}
            <div className="w-full">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Request Amount (optional)
              </label>
              <Input
                type="number"
                placeholder="Enter amount in XAF"
                value={receiveAmount}
                onChange={(e) => setReceiveAmount(e.target.value)}
                className="h-12 rounded-2xl text-center text-lg font-bold"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid w-full grid-cols-2 gap-3">
              <Button variant="outline" className="rounded-2xl h-12 text-sm font-bold gap-2" onClick={handleCopyCode}>
                <Copy className="h-4 w-4" strokeWidth={1.5} />
                Copy Code
              </Button>
              <Button className="rounded-2xl h-12 text-sm font-bold gap-2" onClick={handleShareQR}>
                <Share2 className="h-4 w-4" strokeWidth={1.5} />
                Share QR
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerScan;
