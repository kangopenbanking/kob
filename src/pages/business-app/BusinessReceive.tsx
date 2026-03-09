import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Share2, Link2, Plus, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useParams } from 'react-router-dom';
import { useBusinessData } from '@/hooks/useBusinessData';
import { supabase } from '@/integrations/supabase/client';
import { sounds } from '@/lib/sounds';

type Tab = 'qr' | 'links';

const BusinessReceive: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const { merchant } = useBusinessData(merchantId);

  const [activeTab, setActiveTab] = useState<Tab>('qr');

  // QR tab state
  const [qrAmount, setQrAmount] = useState('');
  const [qrDescription, setQrDescription] = useState('');
  const [generatedQR, setGeneratedQR] = useState<any>(null);
  const [generatingQR, setGeneratingQR] = useState(false);

  // Payment links tab state
  const [linkTitle, setLinkTitle] = useState('');
  const [linkAmount, setLinkAmount] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [creatingLink, setCreatingLink] = useState(false);
  const [createdLink, setCreatedLink] = useState<any>(null);
  const [recentLinks, setRecentLinks] = useState<any[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const formatXAF = (amount: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

  // Realtime payment notification for this merchant
  useEffect(() => {
    if (!merchantId) return;
    const channel = supabase
      .channel(`receive-payments-${merchantId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pos_order_payments',
        filter: `merchant_id=eq.${merchantId}`,
      }, (payload: any) => {
        if (payload.new?.status === 'succeeded') {
          sounds.success();
          toast.success(`Payment received: ${formatXAF(payload.new.amount)}`, {
            description: `Via ${payload.new.method || 'wallet'}`,
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchantId]);

  /* ─── QR Generation ─── */
  const handleGenerateQR = async () => {
    if (!merchantId) return;
    setGeneratingQR(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-qr-payment?action=generate', {
        body: {
          merchant_id: merchantId,
          ...(qrAmount ? { amount: Number(qrAmount) } : {}),
          ...(qrDescription ? { description: qrDescription } : {}),
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setGeneratedQR(data);
      toast.success('QR code generated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate QR');
    } finally {
      setGeneratingQR(false);
    }
  };

  const handleShareQR = async () => {
    if (!generatedQR) return;
    const decoded = generatedQR.decoded || {};
    const text = `Pay ${decoded.merchant_name}\n${decoded.amount ? `Amount: ${formatXAF(decoded.amount)}\n` : ''}${decoded.description || ''}`.trim();
    if (navigator.share) {
      try { await navigator.share({ title: `Pay ${decoded.merchant_name}`, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Payment details copied');
    }
  };

  const handleCopyQR = async () => {
    if (!generatedQR?.qr_payload) return;
    await navigator.clipboard.writeText(generatedQR.qr_payload);
    toast.success('QR payload copied');
  };

  const resetQR = () => {
    setGeneratedQR(null);
    setQrAmount('');
    setQrDescription('');
  };

  /* ─── Payment Links ─── */
  const handleCreateLink = async () => {
    if (!merchantId || !linkTitle || !linkAmount) return;
    setCreatingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('gateway-create-payment-link', {
        body: {
          merchant_id: merchantId,
          title: linkTitle,
          amount: Number(linkAmount),
          currency: 'XAF',
          description: linkDescription || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.message || data.error); return; }
      setCreatedLink(data);
      setRecentLinks(prev => [data, ...prev]);
      toast.success('Payment link created');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create link');
    } finally {
      setCreatingLink(false);
    }
  };

  const handleShareLink = async (link: any) => {
    const url = `${window.location.origin}/pay/${link.slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: link.title, text: `Pay ${formatXAF(link.amount)} - ${link.title}`, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  };

  const resetLink = () => {
    setCreatedLink(null);
    setLinkTitle('');
    setLinkAmount('');
    setLinkDescription('');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="bg-primary px-4 pt-6 pb-8 text-primary-foreground rounded-b-[2rem]">
        <h1 className="text-2xl font-bold tracking-tight">Receive Payment</h1>
        <p className="text-sm text-primary-foreground/80 font-medium mt-1">
          {merchant?.business_name || 'Generate QR codes or payment links'}
        </p>
      </header>

      <div className="p-4 -mt-6 flex flex-1 flex-col">

      {/* Tab Switcher */}
      <div className="mb-5 flex rounded-2xl bg-muted p-1.5">
        {([['qr', 'QR Code'], ['links', 'Payment Links']] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
              activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ─── QR CODE TAB ─── */}
        {activeTab === 'qr' && (
          <motion.div key="qr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col gap-5">
            {generatedQR ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
                {/* QR Display */}
                <Card className="border-0 shadow-md">
                  <CardContent className="flex flex-col items-center gap-4 p-6">
                    <div className="rounded-3xl border-2 border-border bg-white p-5">
                      <QRCodeSVG value={generatedQR.qr_payload} size={220} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-foreground">
                        {generatedQR.decoded?.merchant_name}
                      </p>
                      {generatedQR.decoded?.amount && (
                        <p className="mt-1 text-2xl font-bold text-primary">
                          {formatXAF(generatedQR.decoded.amount)}
                        </p>
                      )}
                      {generatedQR.decoded?.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{generatedQR.decoded.description}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="grid w-full grid-cols-2 gap-3">
                  <Button variant="outline" className="rounded-2xl h-12 text-sm font-bold gap-2" onClick={handleCopyQR}>
                    <Copy className="h-4 w-4" strokeWidth={1.5} /> Copy
                  </Button>
                  <Button className="rounded-2xl h-12 text-sm font-bold gap-2" onClick={handleShareQR}>
                    <Share2 className="h-4 w-4" strokeWidth={1.5} /> Share
                  </Button>
                </div>
                <Button variant="ghost" className="text-sm text-muted-foreground gap-2" onClick={resetQR}>
                  <RefreshCw className="h-4 w-4" strokeWidth={1.5} /> Generate New
                </Button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                <Card className="border-0 shadow-md">
                  <CardContent className="flex flex-col gap-4 p-5">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Amount (optional)
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 5000"
                        value={qrAmount}
                        onChange={(e) => setQrAmount(e.target.value)}
                        className="h-12 rounded-2xl text-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Description (optional)
                      </label>
                      <Input
                        placeholder="e.g. Table 4 dinner"
                        value={qrDescription}
                        onChange={(e) => setQrDescription(e.target.value)}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <Button
                      className="w-full rounded-2xl h-12 text-sm font-bold"
                      onClick={handleGenerateQR}
                      disabled={generatingQR}
                    >
                      {generatingQR ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                        </span>
                      ) : (
                        'Generate QR Code'
                      )}
                    </Button>
                  </CardContent>
                </Card>
                <p className="text-center text-xs text-muted-foreground">
                  Customer scans this code with Kang app to pay instantly
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ─── PAYMENT LINKS TAB ─── */}
        {activeTab === 'links' && (
          <motion.div key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col gap-5">
            {createdLink ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
                <Card className="border-0 shadow-md w-full">
                  <CardContent className="flex flex-col items-center gap-4 p-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
                      <CheckCircle2 className="h-8 w-8 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-bold text-foreground">{createdLink.title}</p>
                    <p className="text-2xl font-bold text-primary">{formatXAF(createdLink.amount)}</p>
                    <div className="w-full rounded-xl bg-muted p-3">
                      <p className="break-all text-center font-mono text-xs text-muted-foreground">
                        {window.location.origin}/pay/{createdLink.slug}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <div className="grid w-full grid-cols-2 gap-3">
                  <Button variant="outline" className="rounded-2xl h-12 text-sm font-bold gap-2" onClick={() => handleShareLink(createdLink)}>
                    <Copy className="h-4 w-4" strokeWidth={1.5} /> Copy Link
                  </Button>
                  <Button className="rounded-2xl h-12 text-sm font-bold gap-2" onClick={() => handleShareLink(createdLink)}>
                    <Share2 className="h-4 w-4" strokeWidth={1.5} /> Share
                  </Button>
                </div>
                <Button variant="ghost" className="text-sm text-muted-foreground gap-2" onClick={resetLink}>
                  <Plus className="h-4 w-4" strokeWidth={1.5} /> Create Another
                </Button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                <Card className="border-0 shadow-md">
                  <CardContent className="flex flex-col gap-4 p-5">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Title *
                      </label>
                      <Input
                        placeholder="e.g. Invoice #1234"
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Amount (XAF) *
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 25000"
                        value={linkAmount}
                        onChange={(e) => setLinkAmount(e.target.value)}
                        className="h-12 rounded-2xl text-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Description (optional)
                      </label>
                      <Input
                        placeholder="e.g. Payment for web design services"
                        value={linkDescription}
                        onChange={(e) => setLinkDescription(e.target.value)}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <Button
                      className="w-full rounded-2xl h-12 text-sm font-bold"
                      onClick={handleCreateLink}
                      disabled={creatingLink || !linkTitle || !linkAmount}
                    >
                      {creatingLink ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                        </span>
                      ) : (
                        <>
                          <Link2 className="mr-2 h-4 w-4" strokeWidth={1.5} /> Create Payment Link
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Recent Links */}
                {recentLinks.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent Links</p>
                    {recentLinks.map((link) => (
                      <Card key={link.id} className="border-0 shadow-sm">
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-foreground">{link.title}</p>
                            <p className="text-xs text-muted-foreground">{formatXAF(link.amount)}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => handleShareLink(link)}>
                            <Share2 className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusinessReceive;
