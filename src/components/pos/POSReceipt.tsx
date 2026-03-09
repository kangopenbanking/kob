import React from 'react';
import { ReceiptData } from '@/hooks/usePOSTill';
import { Button } from '@/components/ui/button';
import { Printer, Share2, X } from 'lucide-react';
import { format } from 'date-fns';

interface POSReceiptProps {
  receipt: ReceiptData;
  onClose: () => void;
  onNewSale: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-CM', { style: 'decimal', minimumFractionDigits: 0 }).format(amount);

export const POSReceipt: React.FC<POSReceiptProps> = ({ receipt, onClose, onNewSale }) => {
  const handlePrint = () => window.print();

  const handleShare = async () => {
    const text = [
      `🧾 ${receipt.merchant_name}`,
      `Order #${receipt.order_number}`,
      `Date: ${format(new Date(receipt.created_at), 'dd/MM/yyyy HH:mm')}`,
      '',
      ...receipt.items.map(i => `${i.quantity}x ${i.name} — ${formatCurrency(i.price * i.quantity)} XAF`),
      '',
      `Subtotal: ${formatCurrency(receipt.subtotal)} XAF`,
      receipt.discount > 0 ? `Discount: -${formatCurrency(receipt.discount)} XAF` : '',
      `Total: ${formatCurrency(receipt.total)} XAF`,
      `Paid: ${receipt.payment_method.replace('_', ' ').toUpperCase()}`,
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      await navigator.share({ title: `Receipt #${receipt.order_number}`, text });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Receipt Card */}
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lg print:shadow-none" id="pos-receipt">
        <div className="mb-4 text-center">
          <h3 className="text-lg font-bold text-foreground">{receipt.merchant_name}</h3>
          <p className="text-xs text-muted-foreground">
            {format(new Date(receipt.created_at), 'dd MMM yyyy • HH:mm')}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-primary">#{receipt.order_number}</p>
        </div>

        {receipt.customer_name && (
          <p className="mb-3 text-center text-sm text-muted-foreground">
            Customer: {receipt.customer_name} {receipt.customer_phone && `• ${receipt.customer_phone}`}
          </p>
        )}

        <div className="mb-4 space-y-2 border-y py-3">
          {receipt.items.map((item) => (
            <div key={item.variant_id} className="flex items-start justify-between text-sm">
              <div className="flex-1">
                <span className="font-medium text-foreground">{item.name}</span>
                {item.variant_name !== 'Default' && (
                  <span className="ml-1 text-xs text-muted-foreground">({item.variant_name})</span>
                )}
                <span className="ml-2 text-muted-foreground">×{item.quantity}</span>
              </div>
              <span className="font-medium tabular-nums text-foreground">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(receipt.subtotal)} XAF</span>
          </div>
          {receipt.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount</span>
              <span className="tabular-nums">-{formatCurrency(receipt.discount)} XAF</span>
            </div>
          )}
          {receipt.tax > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span className="tabular-nums">{formatCurrency(receipt.tax)} XAF</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold text-foreground">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(receipt.total)} XAF</span>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-center text-sm font-medium text-primary">
          Paid via {receipt.payment_method.replace('_', ' ').toUpperCase()}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex w-full max-w-sm gap-2 print:hidden">
        <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" /> Print
        </Button>
        <Button variant="outline" className="flex-1 gap-2" onClick={handleShare}>
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </div>
      <Button className="mt-3 w-full max-w-sm print:hidden" onClick={onNewSale}>
        New Sale
      </Button>
    </div>
  );
};
