import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, QrCode, Link2, Share2, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const CustomerRequest: React.FC = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [generated, setGenerated] = useState(false);

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Request Money</h1>
      </div>

      {/* Amount Input */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-2 rounded-3xl bg-[hsl(150,35%,30%)] p-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(0,0%,100%)]/60">Request Amount</p>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-[hsl(0,0%,100%)]/60">XAF</span>
          <input type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            placeholder="0" className="bg-transparent text-4xl font-bold text-[hsl(0,0%,100%)] outline-none w-full text-center placeholder:text-[hsl(0,0%,100%)]/30" />
        </div>
      </motion.div>

      {!generated ? (
        <Button className="w-full rounded-2xl h-12 text-sm font-bold" disabled={!amount} onClick={() => setGenerated(true)}>
          Generate Payment Request
        </Button>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
          {/* QR Code Placeholder */}
          <div className="flex h-48 w-48 items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/30">
            <QrCode className="h-20 w-20 text-muted-foreground" strokeWidth={1} />
          </div>
          <p className="text-sm font-semibold text-foreground">Scan to pay {Number(amount).toLocaleString()} XAF</p>

          {/* Share Options */}
          <div className="grid grid-cols-3 gap-3 w-full">
            <button className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(210,80%,93%)] p-4">
              <Copy className="h-5 w-5 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
              <span className="text-[10px] font-bold text-foreground">Copy Link</span>
            </button>
            <button className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(150,40%,90%)] p-4">
              <Share2 className="h-5 w-5 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
              <span className="text-[10px] font-bold text-foreground">Share</span>
            </button>
            <button className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(45,70%,90%)] p-4">
              <Link2 className="h-5 w-5 text-[hsl(45,60%,35%)]" strokeWidth={1.5} />
              <span className="text-[10px] font-bold text-foreground">Pay Link</span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CustomerRequest;
