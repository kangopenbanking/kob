import React, { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Printer, Share2, Copy, RefreshCw, Download, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useBusinessData } from '@/hooks/useBusinessData';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { formatDistanceToNow } from 'date-fns';

const BusinessQRCode: React.FC = () => {
  const { merchantId } = useMerchantContext();
  const { merchant } = useBusinessData(merchantId);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [qr, setQr] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const qrRef = useRef<HTMLDivElement>(null);

  const loadQR = async (rotate = false) => {
    if (!merchantId) return;
    rotate ? setRotating(true) : setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('merchant-qr', {
        body: { action: 'issue', merchant_id: merchantId, qr_type: 'static', rotate },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.message || data.error); return; }
      setQr(data);
      if (rotate) toast.success('New QR code generated. Old code is now disabled.');
    } catch (e: any) {
      toast.error(extractEdgeFunctionError(e, 'Failed to load QR code'));
    } finally {
      setLoading(false); setRotating(false);
    }
  };

  const loadStats = async () => {
    if (!merchantId) return;
    const { data } = await supabase.functions.invoke('merchant-qr', { body: { action: 'stats', merchant_id: merchantId } });
    if (data?.stats) setStats(data.stats);
  };

  const loadRecentScans = async () => {
    if (!merchantId) return;
    const { data } = await supabase.functions.invoke('merchant-qr', {
      body: { action: 'recent_scans', merchant_id: merchantId, limit: 20 },
    });
    if (data?.scans) setRecentScans(data.scans);
  };

  useEffect(() => { loadQR(); loadStats(); loadRecentScans(); }, [merchantId]);

  const handlePrint = () => {
    if (!qr) return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    const svg = qrRef.current?.querySelector('svg')?.outerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>${merchant?.business_name || 'QR Code'}</title>
      <style>body{font-family:system-ui;text-align:center;padding:40px;}
        h1{margin:0 0 8px;font-size:28px;font-weight:800;}
        .qr{display:inline-block;padding:20px;border:2px solid #111;border-radius:24px;background:#fff;}
        .url{margin-top:20px;font-family:monospace;font-size:14px;color:#444;}
        .help{margin-top:24px;font-size:14px;color:#666;max-width:480px;margin-left:auto;margin-right:auto;}
      </style></head><body>
      <h1>${merchant?.business_name || 'Pay this Business'}</h1>
      <p style="font-size:16px;color:#666;margin:0 0 24px;">Scan with the Kang App to pay any amount</p>
      <div class="qr">${svg}</div>
      <div class="url">${qr.url}</div>
      <div class="help">Open Kang → Tap Scan → Point camera at this code → Enter amount → Confirm with PIN</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
      </body></html>`);
    win.document.close();
  };

  const handleShare = async () => {
    if (!qr) return;
    const text = `Pay ${merchant?.business_name || 'us'} on Kang: ${qr.url}`;
    if (navigator.share) { try { await navigator.share({ title: merchant?.business_name, text, url: qr.url }); } catch {} }
    else { await navigator.clipboard.writeText(qr.url); toast.success('Link copied'); }
  };

  const handleCopy = async () => {
    if (!qr?.url) return;
    await navigator.clipboard.writeText(qr.url);
    toast.success('Link copied');
  };

  const handleDownload = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = `${merchant?.business_name || 'qr'}.svg`; a.click();
    URL.revokeObjectURL(u);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <header className="pt-4 md:pt-0 mb-5">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">My Business QR Code</h1>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">
          One unique code. Print it, share it, accept payments anywhere.
        </p>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : qr ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border/40 bg-card p-6 flex flex-col items-center gap-4">
            <div ref={qrRef} className="rounded-3xl bg-white p-5 border border-border/30">
              <QRCodeSVG value={qr.payload} size={240} level="M" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-foreground">{merchant?.business_name || 'Your Business'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Customers can pay you any amount</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
              <span className="text-[11px] font-bold text-emerald-700">Signed & verified</span>
            </div>
            <div className="w-full rounded-xl bg-muted/40 p-3">
              <p className="break-all text-center font-mono text-[11px] text-muted-foreground">{qr.url}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="rounded-xl h-11 text-xs font-semibold gap-2" onClick={handlePrint}>
              <Printer className="h-4 w-4" strokeWidth={1.5} /> Print
            </Button>
            <Button variant="outline" className="rounded-xl h-11 text-xs font-semibold gap-2" onClick={handleShare}>
              <Share2 className="h-4 w-4" strokeWidth={1.5} /> Share
            </Button>
            <Button variant="outline" className="rounded-xl h-11 text-xs font-semibold gap-2" onClick={handleCopy}>
              <Copy className="h-4 w-4" strokeWidth={1.5} /> Copy Link
            </Button>
            <Button variant="outline" className="rounded-xl h-11 text-xs font-semibold gap-2" onClick={handleDownload}>
              <Download className="h-4 w-4" strokeWidth={1.5} /> Download
            </Button>
          </div>

          {stats && (
            <div className="rounded-2xl border border-border/40 bg-card p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Last 30 days</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-2xl font-black text-foreground">{stats.scanned}</p><p className="text-[10px] text-muted-foreground">Scans</p></div>
                <div><p className="text-2xl font-black text-foreground">{stats.paid}</p><p className="text-[10px] text-muted-foreground">Payments</p></div>
                <div><p className="text-2xl font-black text-foreground">{Number(stats.total_paid_amount).toLocaleString('fr-CM')}</p><p className="text-[10px] text-muted-foreground">XAF received</p></div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent activity</p>
              <button onClick={loadRecentScans} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground">Refresh</button>
            </div>
            {recentScans.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No scans yet. Print and share your code to start receiving payments.</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {recentScans.map((s) => {
                  const Icon = s.scan_outcome === 'paid' ? CheckCircle2
                    : s.scan_outcome === 'tampered' ? AlertTriangle
                    : s.scan_outcome === 'failed' ? XCircle
                    : s.scan_outcome === 'expired' ? Clock
                    : ShieldCheck;
                  const tone = s.scan_outcome === 'paid' ? 'text-emerald-600'
                    : s.scan_outcome === 'tampered' ? 'text-amber-600'
                    : s.scan_outcome === 'failed' ? 'text-rose-600'
                    : s.scan_outcome === 'expired' ? 'text-muted-foreground'
                    : 'text-foreground';
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <Icon className={`h-4 w-4 shrink-0 ${tone}`} strokeWidth={2} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground capitalize">
                          {s.scan_outcome}{s.failure_reason ? ` · ${s.failure_reason}` : ''}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {s.amount && (
                        <p className="text-xs font-bold text-foreground tabular-nums">
                          {Number(s.amount).toLocaleString('fr-CM')} XAF
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Button variant="ghost" className="text-xs text-muted-foreground gap-2" onClick={() => loadQR(true)} disabled={rotating}>
            {rotating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Rotate code (revoke and re-issue)
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default BusinessQRCode;
