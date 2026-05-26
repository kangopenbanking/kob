// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// Public landing page for invoice payment links. Resolves invoice via public
// edge function, then routes the recipient into the Customer wallet's transfer
// flow (prefilled) once authenticated.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, FileText, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PayInvoice: React.FC = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('customer-invoice-public-resolve', {
          body: { invoice_id: invoiceId },
        });
        if (error) throw error;
        if (data?.error) { toast.error(data.error); return; }
        setData(data);
      } catch {
        toast.error('Invoice not found or no longer available');
      } finally { setLoading(false); }
    })();
  }, [invoiceId]);

  const handlePay = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const target = `/pay/invoice/${invoiceId}`;
    if (!session) {
      sessionStorage.setItem('post_login_redirect', target);
      navigate('/app/auth');
      return;
    }
    if (!data?.sender?.kang_id) {
      toast.error('This invoice cannot be paid via wallet yet — contact the sender');
      return;
    }
    navigate('/app/transfer', {
      state: {
        prefill: {
          recipient: data.sender.kang_id,
          amount: data.invoice.amount,
          note: `Invoice ${data.invoice.invoice_number}`,
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <p className="text-base font-bold text-foreground">Invoice not found</p>
        <p className="mt-2 text-sm text-muted-foreground">This payment link is invalid or has expired.</p>
      </div>
    );
  }

  const inv = data.invoice;
  const isPaid = inv.status === 'paid' || !!inv.paid_at;

  return (
    <div className="flex min-h-screen flex-col bg-background p-6 max-w-md mx-auto">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          {isPaid
            ? <CheckCircle2 className="h-10 w-10 text-emerald-600" strokeWidth={1.5} />
            : <FileText className="h-10 w-10 text-primary" strokeWidth={1.5} />}
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Invoice</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{inv.invoice_number}</p>
          <p className="mt-1 text-sm text-muted-foreground">From {data.sender.full_name}</p>
        </div>

        <div className="w-full rounded-2xl border border-border/40 bg-card p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount Due</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {Number(inv.amount).toLocaleString()} {inv.currency}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Due {new Date(inv.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {inv.notes && (
          <p className="text-center text-sm text-muted-foreground italic border-l-2 border-border pl-3 self-stretch">
            {inv.notes}
          </p>
        )}

        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
          <span className="text-[11px] font-bold text-emerald-700">Secure wallet payment</span>
        </div>

        {isPaid ? (
          <div className="w-full rounded-2xl bg-emerald-500/10 px-4 py-3 text-center text-sm font-bold text-emerald-700">
            This invoice has already been paid
          </div>
        ) : (
          <Button className="w-full rounded-2xl h-12 text-sm font-bold" onClick={handlePay}>
            Pay with Kang Wallet
          </Button>
        )}
        <p className="text-center text-[11px] text-muted-foreground">
          You'll confirm with your PIN on the next screen
        </p>
      </div>
    </div>
  );
};

export default PayInvoice;
