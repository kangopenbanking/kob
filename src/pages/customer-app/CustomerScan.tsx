import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ScanLine, Keyboard, QrCode, Camera, Share2, Copy, CheckCircle2, X, RefreshCw, Store, CreditCard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useCustomerProfile } from '@/hooks/useCustomerData';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { QRPaymentSuccess } from '@/components/customer-app/QRPaymentSuccess';
import { useQRScanner } from '@/hooks/useQRScanner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { useQueryClient } from '@tanstack/react-query';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';
import { logQrEvent, classifyParseError } from '@/lib/qr-telemetry';

type Tab = 'scan' | 'receive';
type ParseHint = { code: string; suggestion: string } | null;

const CustomerScan: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const location = useLocation();
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
  const [paymentSuccess, setPaymentSuccess] = useState<any>(null);
  const [showPin, setShowPin] = useState(false);
  const [storeChoice, setStoreChoice] = useState<any>(null); // v2 kob_store payload — show Visit/Pay chooser
  const [parseHint, setParseHint] = useState<ParseHint>(null);
  const [payAttempt, setPayAttempt] = useState(0);
  const queryClient = useQueryClient();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Receive tab state
  const [receiveAmount, setReceiveAmount] = useState('');
  const userAccountId = user?.kangId || accounts?.[0]?.account_id || profile?.linked_account_number || user?.id?.slice(0, 16).toUpperCase() || '';

  /* ─── Scan handler — ref-based to avoid stale closures ─── */
  const handleScanDetected = useCallback((data: any) => {
    setParseHint(null);
    if (data.type === 'kob_store' && data.merchant_id) {
      logQrEvent({ event_type: 'scan', status: 'success', qr_type: 'kob_store', surface: 'CustomerScan', merchant_id: data.merchant_id });
      if (data.v === 2 && data.pay_enabled && data.pay?.decoded) {
        setStoreChoice(data);
        return;
      }
      toast.success('Opening store...');
      navigate(`/app/stores/${data.merchant_id}`);
      return;
    }
    if (data.type === 'kob_pos_pay' && data.merchant_id) {
      setScanResult({ account: data.merchant_id, amount: data.amount });
      setPayAmount(data.amount ? String(data.amount) : '');
      setMerchantQR(data);
      logQrEvent({ event_type: 'scan', status: 'success', qr_type: 'kob_pos_pay', surface: 'CustomerScan', merchant_id: data.merchant_id, amount: data.amount });
      toast.success(`Merchant: ${data.merchant_name || 'Store'}`);
    } else if (data.type === 'kob_pay' && (data.account || data.kang_id)) {
      const acct = data.account || data.kang_id;
      setScanResult({ account: acct, amount: data.amount });
      setPayAmount(data.amount ? String(data.amount) : '');
      setMerchantQR(null);
      logQrEvent({ event_type: 'scan', status: 'success', qr_type: 'kob_pay', surface: 'CustomerScan', amount: data.amount });
      toast.success(data.name ? `Pay ${data.name}` : 'QR Code scanned successfully!');
    } else {
      const hint = classifyParseError(data);
      setParseHint(hint);
      logQrEvent({
        event_type: 'parse', status: 'error', surface: 'CustomerScan',
        error_code: hint.code, error_message: hint.suggestion,
        qr_type: data?.type, client_meta: { raw_keys: data && typeof data === 'object' ? Object.keys(data) : [] },
      });
    }
  }, [navigate]);

  const handleRawScan = useCallback((rawValue: string) => {
    try {
      const parsed = JSON.parse(rawValue);
      handleScanDetected(parsed);
    } catch {
      // Try the legacy bare-account fallback. If it doesn't look like an
      // account code either, surface a parse hint instead of guessing.
      if (/^[A-Z0-9-]{4,32}$/i.test(rawValue.trim())) {
        handleScanDetected({ type: 'kob_pay', account: rawValue.trim() });
      } else {
        const hint = { code: 'QR_PARSE_INVALID_JSON', suggestion: 'This QR is not a Kang code. Tap Rescan to try another.' };
        setParseHint(hint);
        logQrEvent({ event_type: 'parse', status: 'error', surface: 'CustomerScan', error_code: hint.code, error_message: hint.suggestion });
      }
    }
  }, [handleScanDetected]);

  // Consume prefillQR from deep-links (e.g. PayMerchantSlug → /app/scan)
  const prefillConsumedRef = useRef(false);
  useEffect(() => {
    const prefill = (location.state as any)?.prefillQR;
    if (!prefill || prefillConsumedRef.current) return;
    prefillConsumedRef.current = true;
    handleScanDetected(prefill);
    window.history.replaceState({}, '');
  }, [location.state, handleScanDetected]);

  const scanEnabled = activeTab === 'scan' && !showManualEntry && !scanResult && !paymentSuccess && !parseHint;

  const {
    videoRef: qrVideoRef,
    cameraActive: qrCameraActive,
    cameraError: qrCameraError,
    isHtml5,
    needsHtml5Container,
    stopCamera: qrStopCamera,
    resetProcessed,
  } = useQRScanner({
    onScan: handleRawScan,
    enabled: scanEnabled,
    containerId: 'customer-qr-scanner',
  });

  const handleRescan = useCallback(() => {
    setParseHint(null);
    setScanResult(null);
    setMerchantQR(null);
    setPayAmount('');
    resetProcessed();
  }, [resetProcessed]);

  // Surface camera errors to telemetry once per session.
  const cameraErrLoggedRef = useRef(false);
  useEffect(() => {
    if (qrCameraError && !cameraErrLoggedRef.current) {
      cameraErrLoggedRef.current = true;
      const code = /denied|permission/i.test(qrCameraError) ? 'QR_SCAN_CAMERA_DENIED' : 'QR_SCAN_NO_CAMERA';
      logQrEvent({ event_type: 'scan', status: 'error', surface: 'CustomerScan', error_code: code, error_message: qrCameraError });
    }
  }, [qrCameraError]);

  /* ─── Handlers ─── */
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

  const handlePayNow = () => {
    if (!scanResult) return;
    if (!payAmount || Number(payAmount) <= 0) {
      logQrEvent({ event_type: 'payment', status: 'error', surface: 'CustomerScan', error_code: 'QR_PAY_INVALID_AMOUNT' });
      toast.error('Enter a valid amount');
      return;
    }
    setShowPin(true);
  };

  const executePayment = async () => {
    if (!scanResult) return;
    const finalAmount = payAmount ? Number(payAmount) : undefined;
    const attempt = payAttempt + 1;
    setPayAttempt(attempt);
    const t0 = Date.now();

    if (merchantQR) {
      setProcessing(true);
      try {
        const { data, error } = await supabase.functions.invoke('pos-qr-payment', {
          body: {
            action: 'pay',
            merchant_id: merchantQR.merchant_id,
            amount: finalAmount,
            order_id: merchantQR.order_id,
            decoded: merchantQR.sig ? merchantQR : undefined,
          },
          headers: { 'Idempotency-Key': `qr_pay_${Date.now()}_${crypto.randomUUID().slice(0, 8)}` },
        });
        if (error) throw error;
        if (data?.error) {
          logQrEvent({
            event_type: 'payment', status: attempt > 1 ? 'retry' : 'error',
            surface: 'CustomerScan', qr_type: 'kob_pos_pay',
            error_code: 'QR_PAY_EDGE_ERROR', error_message: data.message || data.error,
            merchant_id: merchantQR.merchant_id, amount: finalAmount, latency_ms: Date.now() - t0, attempt,
          });
          toast.error(data.message || data.error);
          return;
        }
        logQrEvent({
          event_type: 'payment', status: 'success', surface: 'CustomerScan', qr_type: 'kob_pos_pay',
          merchant_id: merchantQR.merchant_id, amount: finalAmount, currency: data.currency || 'XAF',
          latency_ms: Date.now() - t0, attempt,
        });
        setPaymentSuccess({
          merchantName: merchantQR.merchant_name || 'Merchant',
          amount: finalAmount || data.amount,
          currency: data.currency || 'XAF',
          orderNumber: data.order_number,
          orderId: data.order_id,
          timestamp: new Date().toISOString(),
        });
        setScanResult(null);
        setPayAttempt(0);
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['customer-accounts'] }),
          queryClient.refetchQueries({ queryKey: ['account-balances'] }),
        ]);
      } catch (err: any) {
        const msg = extractEdgeFunctionError(err, 'Payment failed');
        logQrEvent({
          event_type: 'payment', status: attempt > 1 ? 'retry' : 'error',
          surface: 'CustomerScan', qr_type: 'kob_pos_pay',
          error_code: 'QR_PAY_EDGE_ERROR', error_message: msg,
          merchant_id: merchantQR.merchant_id, amount: finalAmount, latency_ms: Date.now() - t0, attempt,
        });
        toast.error(msg);
      } finally {
        setProcessing(false);
      }
      return;
    }

    logQrEvent({
      event_type: 'payment', status: 'success', surface: 'CustomerScan', qr_type: 'kob_pay',
      amount: finalAmount, latency_ms: Date.now() - t0, attempt,
    });
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
    setPaymentSuccess(null);
    setMerchantQR(null);
    resetProcessed();
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
        <h1 className="text-lg font-bold text-foreground">{tr('QR Pay')}</h1>
        <div className="w-6" />
      </div>

      {/* Tab Switcher */}
      <div className="mx-5 flex rounded-2xl bg-muted p-1">
        {(['scan', 'receive'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setScanResult(null); setShowManualEntry(false); resetProcessed(); }}
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
            {paymentSuccess ? (
              <QRPaymentSuccess
                merchantName={paymentSuccess.merchantName}
                amount={paymentSuccess.amount}
                currency={paymentSuccess.currency}
                orderNumber={paymentSuccess.orderNumber}
                orderId={paymentSuccess.orderId}
                timestamp={paymentSuccess.timestamp}
                onDone={resetScan}
              />
            ) : scanResult ? (
              /* ─── Scan Result ─── */
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
                  <CheckCircle2 className="h-10 w-10 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  {merchantQR ? (
                    <>
                      <p className="text-lg font-bold text-foreground">{merchantQR.merchant_name || 'Merchant'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {merchantQR.description || 'Order Payment'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-foreground">{tr('QR Code Scanned')}</p>
                      <p className="mt-1 font-mono text-sm text-muted-foreground">{scanResult.account}</p>
                    </>
                  )}
                </div>

                {/* Amount Display */}
                <div className="w-full">
                  {merchantQR && merchantQR.amount > 0 ? (
                    <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{tr('Total to Pay')}</p>
                      <p className="text-3xl font-black tabular-nums text-foreground">
                        {Number(merchantQR.amount).toLocaleString('fr-CM')} <span className="text-lg font-bold text-muted-foreground">XAF</span>
                      </p>
                      {merchantQR.order_id && (
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Order #{merchantQR.order_id.slice(0, 8).toUpperCase()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Amount to Pay
                      </label>
                      <Input
                        type="number"
                        placeholder={tr('Enter amount in XAF')}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="h-12 rounded-2xl text-center text-lg font-bold"
                      />
                    </>
                  )}
                </div>

                <div className="flex w-full flex-col gap-3 pt-4">
                  <Button
                    className="w-full rounded-2xl h-12 text-sm font-bold"
                    disabled={!payAmount || processing}
                    onClick={handlePayNow}
                  >
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Processing...
                      </span>
                    ) : (
                      `Pay ${payAmount ? `${Number(payAmount).toLocaleString('fr-CM')} XAF` : 'Now'}`
                    )}
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
                  <p className="text-sm font-bold text-foreground">{tr('Enter Payment Code')}</p>
                  <button onClick={() => setShowManualEntry(false)}>
                    <X className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <Input
                    placeholder={tr('e.g. KOB-XXXX-XXXX-XXXX')}
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
                {/* Scanner viewport — uses width calc to stay within safe area */}
                <div className="relative mx-auto flex aspect-square w-full max-w-[300px] items-center justify-center overflow-hidden rounded-3xl bg-[hsl(0,0%,8%)]">
                  {/* html5-qrcode container — always in DOM, hidden when not needed */}
                  <div
                    id="customer-qr-scanner"
                    className="absolute inset-0 z-[1] [&>div]:!w-full [&>div]:!h-full [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_video]:!max-w-none [&_video]:!min-width-0"
                    style={{
                      display: needsHtml5Container ? 'block' : 'none',
                      width: '100%',
                      height: '100%',
                    }}
                  />

                  {/* Native camera feed — hidden when using html5 fallback */}
                  {!needsHtml5Container && (
                    <video
                      ref={qrVideoRef}
                      className="absolute inset-0 h-full w-full object-cover"
                      playsInline
                      muted
                    />
                  )}
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Overlay scanning frame */}
                  <div className="absolute inset-0 z-10 pointer-events-none">
                    <div className="absolute left-4 top-4 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-primary" />
                    <div className="absolute right-4 top-4 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-primary" />
                    <div className="absolute bottom-4 left-4 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-primary" />
                    <div className="absolute bottom-4 right-4 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-primary" />
                  </div>

                  {/* Scanning line animation */}
                  {qrCameraActive && (
                    <motion.div
                      className="absolute left-6 right-6 z-20 h-0.5 bg-primary shadow-[0_0_8px_hsl(var(--primary))] pointer-events-none"
                      initial={{ top: '15%' }}
                      animate={{ top: ['15%', '85%', '15%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}

                  {/* Camera not active state */}
                  {!qrCameraActive && !qrCameraError && (
                    <div className="z-20 flex flex-col items-center gap-3">
                      <Camera className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
                      <p className="text-xs text-muted-foreground">{tr('Starting camera…')}</p>
                    </div>
                  )}

                  {/* Camera error state */}
                  {qrCameraError && (
                    <div className="z-20 flex flex-col items-center gap-3 px-6 text-center">
                      <Camera className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
                      <p className="text-xs text-muted-foreground">{qrCameraError}</p>
                    </div>
                  )}
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  {qrCameraActive
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
              <QRCodeSVG value={qrData} size={220} />
            </div>

            <div className="text-center">
              <p className="font-mono text-sm font-bold text-foreground">{userAccountId}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tr('Share this QR code to receive payments')}</p>
            </div>

            {/* Amount Input */}
            <div className="w-full">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Request Amount (optional)
              </label>
              <Input
                type="number"
                placeholder={tr('Enter amount in XAF')}
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
      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={executePayment} />

      {/* Store QR chooser — Visit Store or Pay any amount */}
      <Dialog open={!!storeChoice} onOpenChange={(o) => { if (!o) { setStoreChoice(null); resetProcessed(); } }}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-base">{storeChoice?.merchant_name || 'Store'}</DialogTitle>
          </DialogHeader>
          <p className="text-center text-xs text-muted-foreground -mt-2 mb-2">{tr('What would you like to do?')}</p>
          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => {
                const id = storeChoice.merchant_id;
                setStoreChoice(null);
                navigate(`/app/stores/${id}`);
              }}
              className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-4 text-left transition hover:bg-muted/40 active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Store className="h-5 w-5 text-emerald-600" strokeWidth={1.7} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{tr('Visit Store')}</p>
                <p className="text-[11px] text-muted-foreground">{tr('Browse products and place an order')}</p>
              </div>
            </button>
            <button
              onClick={() => {
                // Switch to pay flow using the signed pay payload from the store QR.
                const pay = storeChoice.pay?.decoded;
                setStoreChoice(null);
                if (pay && pay.merchant_id) {
                  setScanResult({ account: pay.merchant_id, amount: pay.amount });
                  setPayAmount(pay.amount ? String(pay.amount) : '');
                  setMerchantQR({ ...pay, merchant_name: storeChoice.merchant_name });
                } else {
                  toast.error('Pay is not enabled for this store');
                }
              }}
              className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-4 text-left transition hover:bg-muted/40 active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" strokeWidth={1.7} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{tr('Pay this Business')}</p>
                <p className="text-[11px] text-muted-foreground">{tr('Enter any amount and confirm with PIN')}</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerScan;
