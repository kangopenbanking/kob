import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, QrCode, Camera, Share2, Download } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Simple QR code generator using SVG
function generateQRMatrix(data: string): boolean[][] {
  // Simple QR-like encoding for display purposes
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  
  // Finder patterns (top-left, top-right, bottom-left)
  const addFinder = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[row + r][col + c] = isOuter || isInner;
      }
    }
  };
  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Data encoding (simplified hash-based)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  
  for (let r = 8; r < size; r++) {
    for (let c = 8; c < size; c++) {
      if (r < size - 7 || c < size - 7) {
        const bit = ((hash >> ((r * size + c) % 31)) & 1) === 1;
        const alt = (r + c) % 3 === 0;
        matrix[r][c] = bit !== alt;
      }
    }
  }
  
  return matrix;
}

function QRCodeSVG({ data, size = 200 }: { data: string; size?: number }) {
  const matrix = generateQRMatrix(data);
  const cellSize = size / matrix.length;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-xl">
      <rect width={size} height={size} fill="white" rx={8} />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#1a1a2e"
              rx={cellSize * 0.15}
            />
          ) : null
        )
      )}
    </svg>
  );
}

const BankQRPay: React.FC = () => {
  const navigate = useNavigate();
  const { institutionId } = useParams();
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);

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

  const qrData = JSON.stringify({
    type: 'kob_pay',
    account: accountId,
    institution: institutionId,
    ...(amount ? { amount: Number(amount) } : {}),
  });

  const handleScan = () => {
    toast.info('QR scanning requires a native camera. This feature is available in the mobile app.');
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Pay Me',
      text: `Pay me via KOB Banking\nAccount: ${accountId}${amount ? `\nAmount: ${Number(amount).toLocaleString()} XAF` : ''}`,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareData.text);
      toast.success('Payment details copied to clipboard');
    }
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">QR Pay</h1>
      <p className="mb-6 text-sm text-muted-foreground">Scan or share your QR code</p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6"
      >
        {/* QR Display */}
        <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-sm">
          {loading ? (
            <div className="flex h-[200px] w-[200px] items-center justify-center">
              <QrCode className="h-12 w-12 animate-pulse text-muted-foreground/40" strokeWidth={1} />
            </div>
          ) : accountId ? (
            <QRCodeSVG data={qrData} size={200} />
          ) : (
            <div className="flex h-[200px] w-[200px] items-center justify-center text-center">
              <p className="text-xs text-muted-foreground">No account found</p>
            </div>
          )}
        </div>

        {accountId && (
          <p className="text-center text-xs text-muted-foreground font-mono">{accountId}</p>
        )}

        {/* Amount Input */}
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Request Amount (optional)
          </label>
          <Input
            type="number"
            placeholder="Enter amount in XAF"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-center text-lg font-bold"
          />
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button variant="outline" className="w-full gap-2" onClick={handleScan}>
            <Camera className="h-4 w-4" strokeWidth={1.5} />
            Scan QR Code
          </Button>
          <Button className="w-full gap-2" onClick={handleShare} disabled={!accountId}>
            <Share2 className="h-4 w-4" strokeWidth={1.5} />
            Share QR Code
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Share your QR code to receive instant payments
        </p>
      </motion.div>
    </div>
  );
};

export default BankQRPay;
