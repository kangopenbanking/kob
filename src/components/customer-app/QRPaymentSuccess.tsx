import React from 'react';
import { CheckCircle2, Store, Receipt, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

interface QRPaymentSuccessProps {
  merchantName: string;
  amount: number;
  currency?: string;
  orderNumber?: string;
  orderId?: string;
  timestamp: string;
  onDone: () => void;
}

export const QRPaymentSuccess: React.FC<QRPaymentSuccessProps> = ({
  merchantName,
  amount,
  currency = 'XAF',
  orderNumber,
  orderId,
  timestamp,
  onDone,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-1 flex-col items-center justify-center gap-6 p-6"
    >
      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]"
      >
        <CheckCircle2 className="h-12 w-12 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
      </motion.div>

      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">Payment Successful</p>
        <p className="mt-2 text-3xl font-black tabular-nums text-foreground">
          {Number(amount).toLocaleString('fr-CM <span className="text-lg font-bold text-muted-foreground">{currency}</span>
        </p>
      </div>

      {/* Details Card */}
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Store className="h-5 w-5 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{merchantName}</p>
            <p className="text-xs text-muted-foreground">Merchant</p>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="space-y-2.5 text-sm">
          {orderNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order</span>
              <span className="font-mono font-bold text-foreground">#{orderNumber}</span>
            </div>
          )}
          {orderId && !orderNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono font-bold text-foreground">{orderId.slice(0, 8).toUpperCase()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Method</span>
            <span className="font-bold text-foreground">Wallet</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium text-foreground">
              {format(new Date(timestamp), 'dd MMM yyyy, HH:mm
            </span>
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3 pt-2">
        <Button className="w-full rounded-2xl h-12 text-sm font-bold" onClick={onDone}>
          Done
        </Button>
      </div>
    </motion.div>
  );
};
